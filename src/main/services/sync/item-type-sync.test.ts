import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase } from '../../database/connection'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applySchema } from '../../database/schema'
import { applyRemoteItemTypeChange, uploadItemType } from './item-type-sync'
import { getDb } from '../../database/connection'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn()
}

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('item-type-sync.ts', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('applyRemoteItemTypeChange', () => {
    it('inserts a new item type when name does not exist locally', async () => {
      const remoteRow = {
        id: 'remote-uuid-1',
        name: 'Spirits',
        description: 'Spirit beverages',
        default_profit_margin: 0.3,
        default_tax_rate: 0.08,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare(
          'SELECT id, name, description, default_profit_margin, cloud_id FROM item_types WHERE name = ?'
        )
        .get('Spirits') as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.name).toBe('Spirits')
      expect(row.description).toBe('Spirit beverages')
      expect(row.default_profit_margin).toBe(0.3)
      expect(row.cloud_id).toBe('remote-uuid-1')
    })

    it('updates an existing item type when remote is newer', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO item_types
         (name, description, default_profit_margin, default_tax_rate, cloud_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run('Wine', 'Old description', 0.3, 0.08, 'cloud-id-1', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-1',
        name: 'Wine',
        description: 'Updated wine description',
        default_profit_margin: 0.35,
        default_tax_rate: 0.09,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare(
          'SELECT description, default_profit_margin, default_tax_rate FROM item_types WHERE name = ?'
        )
        .get('Wine') as Record<string, unknown>
      expect(row.description).toBe('Updated wine description')
      expect(row.default_profit_margin).toBe(0.35)
      expect(row.default_tax_rate).toBe(0.09)
    })

    it('syncs product item_type references when item_type is updated (name stays same)', async () => {
      const db = getDb()
      // Create a local item type with name that exists
      db.prepare(
        `INSERT INTO item_types
         (name, description, cloud_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run('Wine', 'Old description', 'remote-uuid-2', '2026-04-01T12:00:00Z')

      // Create a product with the item_type
      db.prepare(
        `INSERT INTO products
         (sku, name, category, item_type, price, in_stock, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('WINE-001', 'Test Wine', 'Beverages', 'Wine', 15.0, 10, 0.08)

      // Remote change: same item type name, but description and other fields changed
      const remoteRow = {
        id: 'remote-uuid-2',
        name: 'Wine', // Same name (the lookup key)
        description: 'New description',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      // Verify item type was updated
      const itemType = db
        .prepare('SELECT description FROM item_types WHERE name = ?')
        .get('Wine') as Record<string, unknown>
      expect(itemType.description).toBe('New description')

      // Product item_type should remain unchanged (name didn't change)
      const product = db
        .prepare('SELECT item_type FROM products WHERE sku = ?')
        .get('WINE-001') as Record<string, unknown>
      expect(product.item_type).toBe('Wine')
    })

    it('does not sync product references when name stays the same (update only)', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO item_types
         (name, description, updated_at)
         VALUES (?, ?, ?)`
      ).run('Wine', 'Old desc', '2026-04-01T12:00:00Z')

      db.prepare(
        `INSERT INTO products
         (sku, name, category, item_type, price, in_stock, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('WINE-002', 'Test Wine 2', 'Beverages', 'Wine', 20.0, 5, 0.08)

      const remoteRow = {
        id: 'remote-uuid-3',
        name: 'Wine', // Same name
        description: 'New desc',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      // Product item_type should remain unchanged
      const product = db
        .prepare('SELECT item_type FROM products WHERE sku = ?')
        .get('WINE-002') as Record<string, unknown>
      expect(product.item_type).toBe('Wine')
    })

    it('skips update when local is newer (last-write-wins)', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO item_types
         (name, description, default_profit_margin, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run('Beer', 'Local newer', 0.25, '2026-04-06T12:00:00Z')

      const remoteRow = {
        id: 'remote-uuid-4',
        name: 'Beer',
        description: 'Remote older',
        default_profit_margin: 0.2,
        default_tax_rate: 0.08,
        device_id: 'remote-device',
        updated_at: '2026-04-01T12:00:00Z' // Older
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT description, default_profit_margin FROM item_types WHERE name = ?')
        .get('Beer') as Record<string, unknown>
      expect(row.description).toBe('Local newer') // Unchanged
      expect(row.default_profit_margin).toBe(0.25)
    })

    it('handles null description gracefully', async () => {
      const remoteRow = {
        id: 'remote-uuid-5',
        name: 'MinimalType',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT description FROM item_types WHERE name = ?')
        .get('MinimalType') as Record<string, unknown>
      expect(row.description).toBeNull()
    })

    it('handles default values for profit margin and tax rate', async () => {
      const remoteRow = {
        id: 'remote-uuid-6',
        name: 'DefaultMargins',
        description: null,
        default_profit_margin: null, // Missing, should default to 0
        default_tax_rate: null,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT default_profit_margin, default_tax_rate FROM item_types WHERE name = ?')
        .get('DefaultMargins') as Record<string, unknown>
      expect(row.default_profit_margin).toBe(0)
      expect(row.default_tax_rate).toBe(0)
    })

    it('tracks last_modified_by_device on insert', async () => {
      const remoteRow = {
        id: 'remote-uuid-7',
        name: 'DeviceTracking',
        description: null,
        default_profit_margin: 0.25,
        default_tax_rate: 0.08,
        device_id: 'specific-device-id',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT last_modified_by_device FROM item_types WHERE name = ?')
        .get('DeviceTracking') as Record<string, unknown>
      expect(row.last_modified_by_device).toBe('specific-device-id')
    })

    it('handles null device_id gracefully', async () => {
      const remoteRow = {
        id: 'remote-uuid-8',
        name: 'NullDeviceType',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0,
        device_id: null,
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT last_modified_by_device FROM item_types WHERE name = ?')
        .get('NullDeviceType') as Record<string, unknown>
      expect(row.last_modified_by_device).toBeNull()
    })

    it('sets synced_at when syncing', async () => {
      const remoteRow = {
        id: 'remote-uuid-9',
        name: 'SyncTimeType',
        description: null,
        default_profit_margin: 0.3,
        default_tax_rate: 0.08,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT synced_at FROM item_types WHERE name = ?')
        .get('SyncTimeType') as Record<string, unknown>
      expect(row.synced_at).toBeDefined()
      expect(typeof row.synced_at).toBe('string')
      // synced_at should be set to CURRENT_TIMESTAMP (just verify it exists and is a timestamp)
      expect(String(row.synced_at).length).toBeGreaterThan(0)
    })

    it('updates multiple item types when syncing', async () => {
      const db = getDb()
      // Create two local item types
      db.prepare(
        `INSERT INTO item_types
         (name, description, cloud_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run('Category1', 'Old desc 1', 'remote-uuid-10', '2026-04-01T12:00:00Z')

      db.prepare(
        `INSERT INTO item_types
         (name, description, cloud_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run('Category2', 'Old desc 2', 'remote-uuid-11', '2026-04-01T12:00:00Z')

      // Create products with these item_types
      db.prepare(
        `INSERT INTO products
         (sku, name, category, item_type, price, in_stock, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('PROD-001', 'Product 1', 'Beverages', 'Category1', 10.0, 1, 0.08)

      db.prepare(
        `INSERT INTO products
         (sku, name, category, item_type, price, in_stock, tax_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('PROD-002', 'Product 2', 'Beverages', 'Category2', 20.0, 2, 0.08)

      // Sync update for first item type
      const remoteRow1 = {
        id: 'remote-uuid-10',
        name: 'Category1',
        description: 'New desc 1',
        default_profit_margin: 0.3,
        default_tax_rate: 0.08,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      // Sync update for second item type
      const remoteRow2 = {
        id: 'remote-uuid-11',
        name: 'Category2',
        description: 'New desc 2',
        default_profit_margin: 0.25,
        default_tax_rate: 0.08,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow1
      )
      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow2
      )

      // Verify both item types were updated
      const cat1 = db
        .prepare('SELECT description FROM item_types WHERE name = ?')
        .get('Category1') as Record<string, unknown>
      const cat2 = db
        .prepare('SELECT description FROM item_types WHERE name = ?')
        .get('Category2') as Record<string, unknown>
      expect(cat1.description).toBe('New desc 1')
      expect(cat2.description).toBe('New desc 2')

      // Products should not change (names didn't change)
      const prod1 = db
        .prepare('SELECT item_type FROM products WHERE sku = ?')
        .get('PROD-001') as Record<string, unknown>
      const prod2 = db
        .prepare('SELECT item_type FROM products WHERE sku = ?')
        .get('PROD-002') as Record<string, unknown>
      expect(prod1.item_type).toBe('Category1')
      expect(prod2.item_type).toBe('Category2')
    })

    it('preserves cloud_id when updating', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO item_types
         (name, description, cloud_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run('PreserveCloudId', 'Old desc', 'cloud-id-original', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-original',
        name: 'PreserveCloudId',
        description: 'New desc',
        default_profit_margin: 0.35,
        default_tax_rate: 0.09,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT cloud_id FROM item_types WHERE name = ?')
        .get('PreserveCloudId') as Record<string, unknown>
      expect(row.cloud_id).toBe('cloud-id-original')
    })
  })

  describe('numeric field handling', () => {
    it('handles high profit margin values', async () => {
      const remoteRow = {
        id: 'remote-uuid-11',
        name: 'HighMargin',
        description: null,
        default_profit_margin: 0.99,
        default_tax_rate: 0.08,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT default_profit_margin FROM item_types WHERE name = ?')
        .get('HighMargin') as Record<string, unknown>
      expect(row.default_profit_margin).toBe(0.99)
    })

    it('handles numeric strings for rates', async () => {
      const remoteRow = {
        id: 'remote-uuid-12',
        name: 'StringRates',
        description: null,
        default_profit_margin: '0.25', // Potential string from API
        default_tax_rate: '0.08',
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteItemTypeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT default_profit_margin, default_tax_rate FROM item_types WHERE name = ?')
        .get('StringRates') as Record<string, unknown>
      expect(row.default_profit_margin).toBe(0.25)
      expect(row.default_tax_rate).toBe(0.08)
    })
  })
})

describe('uploadItemType (error handling)', () => {
  beforeEach(createTestDb)

  it('throws when uploadItemType receives Supabase error', async () => {
    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Invalid item type name' }
            })
          })
        })
      })
    }

    const payload = {
      item_type: {
        id: 1,
        name: 'Spirits',
        description: 'Spirit beverages',
        default_profit_margin: 0.3,
        default_tax_rate: 0.08,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadItemType(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Item type upload failed: Invalid item type name')
  })

  it('throws when uploadItemType Supabase request fails', async () => {
    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      })
    }

    const payload = {
      item_type: {
        id: 2,
        name: 'Wines',
        description: null,
        default_profit_margin: 0.25,
        default_tax_rate: 0.08,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadItemType(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow()
  })

  it('throws when uploadItemType returns null data without error', async () => {
    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      })
    }

    const payload = {
      item_type: {
        id: 3,
        name: 'Beer',
        description: 'Beer beverages',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadItemType(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Item type upload failed: unknown')
  })
})
