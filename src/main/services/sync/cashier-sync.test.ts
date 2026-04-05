import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase } from '../../database/connection'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applySchema } from '../../database/schema'
import { applyRemoteCashierChange, uploadCashier } from './cashier-sync'
import { getDb } from '../../database/connection'
import { hashPin } from '../../database/cashiers.repo'

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

describe('cashier-sync.ts', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('applyRemoteCashierChange', () => {
    it('inserts a new cashier when pin_hash does not exist locally', async () => {
      const pinHash = hashPin('1234')
      const remoteRow = {
        id: 'remote-uuid-1',
        name: 'John Cashier',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT id, name, role, pin_hash, cloud_id FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.name).toBe('John Cashier')
      expect(row.role).toBe('cashier')
      expect(row.pin_hash).toBe(pinHash)
      expect(row.cloud_id).toBe('remote-uuid-1')
    })

    it('updates an existing cashier when remote is newer (identified by pin_hash)', async () => {
      const db = getDb()
      const originalPinHash = hashPin('5555')
      db.prepare(
        `INSERT INTO cashiers
         (name, role, pin_hash, is_active, cloud_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run('Old Name', 'cashier', originalPinHash, 1, 'cloud-id-1', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-1',
        name: 'Updated Name',
        role: 'admin',
        pin_hash: originalPinHash,
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT name, role FROM cashiers WHERE pin_hash = ?')
        .get(originalPinHash) as Record<string, unknown>
      expect(row.name).toBe('Updated Name')
      expect(row.role).toBe('admin')
    })

    it('skips update when local is newer (last-write-wins)', async () => {
      const db = getDb()
      const pinHash = hashPin('2222')
      db.prepare(
        `INSERT INTO cashiers
         (name, role, pin_hash, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run('Newer Local', 'admin', pinHash, 1, '2026-04-06T12:00:00Z')

      const remoteRow = {
        id: 'remote-uuid-2',
        name: 'Older Remote',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-01T12:00:00Z' // Older
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT name, role FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.name).toBe('Newer Local') // Unchanged
      expect(row.role).toBe('admin') // Unchanged
    })

    it('handles null device_id gracefully', async () => {
      const pinHash = hashPin('3333')
      const remoteRow = {
        id: 'remote-uuid-3',
        name: 'No Device',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: null,
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT last_modified_by_device FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.last_modified_by_device).toBeNull()
    })

    it('preserves pin_hash on update (identity key)', async () => {
      const db = getDb()
      const originalPinHash = hashPin('4444')
      db.prepare(
        `INSERT INTO cashiers
         (name, role, pin_hash, is_active, cloud_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run('Update PIN', 'cashier', originalPinHash, 1, 'cloud-id-2', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-2',
        name: 'Still Same PIN',
        role: 'admin',
        pin_hash: originalPinHash,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT pin_hash FROM cashiers WHERE pin_hash = ?')
        .get(originalPinHash) as Record<string, unknown>
      expect(row.pin_hash).toBe(originalPinHash) // Unchanged
    })

    it('defaults role to cashier when null is provided', async () => {
      const pinHash = hashPin('6666')
      const remoteRow = {
        id: 'remote-uuid-4',
        name: 'Default Role',
        role: null, // Missing role
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db.prepare('SELECT role FROM cashiers WHERE pin_hash = ?').get(pinHash) as Record<
        string,
        unknown
      >
      expect(row.role).toBe('cashier')
    })

    it('defaults is_active to 1 when null is provided', async () => {
      const pinHash = hashPin('7777')
      const remoteRow = {
        id: 'remote-uuid-5',
        name: 'Default Active',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: null, // Missing
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT is_active FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.is_active).toBe(1)
    })

    it('updates is_active status correctly', async () => {
      const db = getDb()
      const pinHash = hashPin('8888')
      db.prepare(
        `INSERT INTO cashiers
         (name, role, pin_hash, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run('Deactivate Test', 'cashier', pinHash, 1, '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'remote-uuid-6',
        name: 'Deactivate Test',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 0, // Deactivate
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT is_active FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.is_active).toBe(0)
    })

    it('tracks last_modified_by_device', async () => {
      const pinHash = hashPin('9999')
      const remoteRow = {
        id: 'remote-uuid-7',
        name: 'Device Tracker',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'specific-device-xyz',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT last_modified_by_device FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.last_modified_by_device).toBe('specific-device-xyz')
    })

    it('sets synced_at when syncing', async () => {
      const pinHash = hashPin('0000')
      const remoteRow = {
        id: 'remote-uuid-8',
        name: 'Sync Time',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT synced_at FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.synced_at).toBeDefined()
      expect(typeof row.synced_at).toBe('string')
      // synced_at should be set to CURRENT_TIMESTAMP (just verify it exists and is a timestamp)
      expect(String(row.synced_at).length).toBeGreaterThan(0)
    })

    it('preserves cloud_id when updating', async () => {
      const db = getDb()
      const pinHash = hashPin('1111')
      db.prepare(
        `INSERT INTO cashiers
         (name, role, pin_hash, cloud_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run('Old Name', 'cashier', pinHash, 'cloud-id-original', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-original',
        name: 'New Name',
        role: 'admin',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT cloud_id FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.cloud_id).toBe('cloud-id-original')
    })

    it('handles pin_hash from deleted cashier (preserved in sync payload)', async () => {
      const pinHash = hashPin('DELETE_TEST')
      const remoteRow = {
        id: 'remote-uuid-9',
        name: 'Sync After Delete',
        role: 'cashier',
        pin_hash: pinHash, // This came from DELETE sync on another device
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      // Local DB doesn't have this cashier, but we can sync it from another device's DELETE
      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT name, pin_hash FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.name).toBe('Sync After Delete')
    })

    it('allows same pin_hash across updates (upsert semantics)', async () => {
      const db = getDb()
      const pinHash = hashPin('UPSERT_TEST')

      // First sync: insert
      const remoteRow1 = {
        id: 'remote-uuid-10',
        name: 'Cashier V1',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'device-1',
        updated_at: '2026-04-05T10:00:00Z'
      }
      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow1
      )

      let cashiers = db.prepare('SELECT * FROM cashiers WHERE pin_hash = ?').all(pinHash)
      expect(cashiers).toHaveLength(1)
      expect((cashiers[0] as Record<string, unknown>).name).toBe('Cashier V1')

      // Second sync: update same pin_hash
      const remoteRow2 = {
        id: 'remote-uuid-10', // Same cloud ID
        name: 'Cashier V2',
        role: 'admin',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'device-2',
        updated_at: '2026-04-05T12:00:00Z'
      }
      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow2
      )

      cashiers = db.prepare('SELECT * FROM cashiers WHERE pin_hash = ?').all(pinHash)
      expect(cashiers).toHaveLength(1) // Still only one
      expect((cashiers[0] as Record<string, unknown>).name).toBe('Cashier V2')
    })

    it('handles long name strings', async () => {
      const pinHash = hashPin('LONG_NAME_TEST')
      const longName = 'A'.repeat(255)
      const remoteRow = {
        id: 'remote-uuid-11',
        name: longName,
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db.prepare('SELECT name FROM cashiers WHERE pin_hash = ?').get(pinHash) as Record<
        string,
        unknown
      >
      expect(row.name).toBe(longName)
    })
  })

  describe('pin_hash identity semantics', () => {
    it('identifies cashiers by pin_hash, not by id or name', async () => {
      const db = getDb()
      const pinHash = hashPin('IDENTITY_TEST')
      db.prepare(
        `INSERT INTO cashiers
         (name, role, pin_hash, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run('Original Name', 'cashier', pinHash, 1, '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'different-cloud-id',
        name: 'Different Remote Name',
        role: 'admin',
        pin_hash: pinHash, // Same PIN hash = same cashier
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteCashierChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const rows = db
        .prepare('SELECT COUNT(*) AS count FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(rows.count).toBe(1) // Still one cashier
      const row = db
        .prepare('SELECT name, role FROM cashiers WHERE pin_hash = ?')
        .get(pinHash) as Record<string, unknown>
      expect(row.name).toBe('Different Remote Name')
      expect(row.role).toBe('admin')
    })
  })
})

describe('uploadCashier (error handling)', () => {
  beforeEach(createTestDb)

  it('throws when uploadCashier receives Supabase error', async () => {
    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Invalid cashier data' }
            })
          })
        })
      })
    }

    const pinHash = hashPin('1234')
    const payload = {
      cashier: {
        id: 1,
        name: 'John Doe',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadCashier(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Cashier upload failed: Invalid cashier data')
  })

  it('throws when uploadCashier Supabase request fails', async () => {
    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      })
    }

    const pinHash = hashPin('5678')
    const payload = {
      cashier: {
        id: 2,
        name: 'Jane Doe',
        role: 'admin',
        pin_hash: pinHash,
        is_active: 1,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadCashier(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow()
  })

  it('throws when uploadCashier returns null data without error', async () => {
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

    const pinHash = hashPin('9999')
    const payload = {
      cashier: {
        id: 3,
        name: 'Bob Smith',
        role: 'cashier',
        pin_hash: pinHash,
        is_active: 1,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadCashier(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Cashier upload failed: unknown')
  })
})
