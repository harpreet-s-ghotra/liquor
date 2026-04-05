import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase } from '../../database/connection'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applySchema } from '../../database/schema'
import { applyRemoteTaxCodeChange, uploadTaxCode } from './tax-code-sync'
import { getDb } from '../../database/connection'

// The applyRemoteTaxCodeChange functions don't use the supabase client argument
// (it is underscore-prefixed). Null is safe to pass from tests.
const mockSupabase = null as unknown as SupabaseClient

vi.mock('../../database/connection', async () => {
  const actual = await vi.importActual('../../database/connection')
  return actual
})

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('tax-code-sync.ts', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('applyRemoteTaxCodeChange', () => {
    it('inserts a new tax code when code does not exist locally', async () => {
      const remoteRow = {
        id: 'remote-uuid-1',
        code: 'CA_TAX',
        rate: 0.0725,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT id, code, rate, cloud_id FROM tax_codes WHERE code = ?')
        .get('CA_TAX') as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.code).toBe('CA_TAX')
      expect(row.rate).toBe(0.0725)
      expect(row.cloud_id).toBe('remote-uuid-1')
    })

    it('updates an existing tax code when remote is newer', async () => {
      const db = getDb()
      // Create a local tax code with an old timestamp
      db.prepare(
        'INSERT INTO tax_codes (code, rate, cloud_id, updated_at) VALUES (?, ?, ?, ?)'
      ).run('OLD_CODE', 0.08, 'cloud-id-1', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'remote-uuid-2',
        code: 'OLD_CODE',
        rate: 0.085,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z' // Newer
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT rate, cloud_id, last_modified_by_device FROM tax_codes WHERE code = ?')
        .get('OLD_CODE') as Record<string, unknown>
      expect(row.rate).toBe(0.085)
      expect(row.cloud_id).toBe('remote-uuid-2')
      expect(row.last_modified_by_device).toBe('remote-device')
    })

    it('skips update when local is newer (last-write-wins)', async () => {
      const db = getDb()
      // Create a local tax code with a newer timestamp
      db.prepare('INSERT INTO tax_codes (code, rate, updated_at) VALUES (?, ?, ?)').run(
        'NEWER_LOCAL',
        0.09,
        '2026-04-06T12:00:00Z'
      )

      const remoteRow = {
        id: 'remote-uuid-3',
        code: 'NEWER_LOCAL',
        rate: 0.08,
        device_id: 'remote-device',
        updated_at: '2026-04-01T12:00:00Z' // Older
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT rate FROM tax_codes WHERE code = ?')
        .get('NEWER_LOCAL') as Record<string, unknown>
      expect(row.rate).toBe(0.09) // Unchanged
    })

    it('skips update when timestamps are equal (no change)', async () => {
      const db = getDb()
      const timestamp = '2026-04-05T12:00:00Z'
      db.prepare('INSERT INTO tax_codes (code, rate, updated_at) VALUES (?, ?, ?)').run(
        'EQUAL_TIME',
        0.09,
        timestamp
      )

      const remoteRow = {
        id: 'remote-uuid-4',
        code: 'EQUAL_TIME',
        rate: 0.08,
        device_id: 'remote-device',
        updated_at: timestamp
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT rate FROM tax_codes WHERE code = ?')
        .get('EQUAL_TIME') as Record<string, unknown>
      expect(row.rate).toBe(0.09) // Unchanged (local wins in tie)
    })

    it('handles null device_id gracefully', async () => {
      const remoteRow = {
        id: 'remote-uuid-5',
        code: 'NULL_DEVICE',
        rate: 0.07,
        device_id: null,
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT last_modified_by_device FROM tax_codes WHERE code = ?')
        .get('NULL_DEVICE') as Record<string, unknown>
      expect(row.last_modified_by_device).toBeNull()
    })

    it('preserves cloud_id when updating', async () => {
      const db = getDb()
      db.prepare(
        'INSERT INTO tax_codes (code, rate, cloud_id, updated_at) VALUES (?, ?, ?, ?)'
      ).run('PRESERVE_CLOUD', 0.08, 'cloud-id-orig', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-orig', // Same cloud ID
        code: 'PRESERVE_CLOUD',
        rate: 0.085,
        device_id: 'device-2',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT cloud_id FROM tax_codes WHERE code = ?')
        .get('PRESERVE_CLOUD') as Record<string, unknown>
      expect(row.cloud_id).toBe('cloud-id-orig')
    })

    it('handles numeric string conversion for rate', async () => {
      const remoteRow = {
        id: 'remote-uuid-6',
        code: 'STRING_RATE',
        rate: '0.0825', // Potentially a string from API
        device_id: 'device-3',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT rate FROM tax_codes WHERE code = ?')
        .get('STRING_RATE') as Record<string, unknown>
      expect(row.rate).toBe(0.0825)
    })

    it('sets synced_at when updating', async () => {
      const db = getDb()
      db.prepare('INSERT INTO tax_codes (code, rate, updated_at) VALUES (?, ?, ?)').run(
        'SYNC_TIME',
        0.08,
        '2026-04-01T12:00:00Z'
      )

      const remoteRow = {
        id: 'remote-uuid-7',
        code: 'SYNC_TIME',
        rate: 0.085,
        device_id: 'device-4',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT synced_at FROM tax_codes WHERE code = ?')
        .get('SYNC_TIME') as Record<string, unknown>
      expect(row.synced_at).toBeDefined()
      expect(typeof row.synced_at).toBe('string')
      // synced_at should be set to CURRENT_TIMESTAMP (just verify it exists and is a timestamp)
      expect(String(row.synced_at).length).toBeGreaterThan(0)
    })

    it('maintains referential integrity with products table', async () => {
      const db = getDb()
      // Create a remote tax code
      const remoteRow = {
        id: 'remote-uuid-8',
        code: 'REF_TEST',
        rate: 0.08,
        device_id: 'device-5',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      // Create a product with tax references
      db.prepare(
        'INSERT INTO products (sku, name, category, price, in_stock, tax_rate) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('TEST-001', 'Test Product', 'Spirits', 10.0, 1, 0.08)

      // Verify the tax code still exists
      const taxCode = db.prepare('SELECT * FROM tax_codes WHERE code = ?').get('REF_TEST')
      expect(taxCode).toBeDefined()
    })
  })

  describe('numeric edge cases', () => {
    it('handles very high tax rates', async () => {
      const remoteRow = {
        id: 'remote-uuid-9',
        code: 'HIGH_TAX',
        rate: 0.99999,
        device_id: 'device-6',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db.prepare('SELECT rate FROM tax_codes WHERE code = ?').get('HIGH_TAX') as Record<
        string,
        unknown
      >
      expect(row.rate).toBe(0.99999)
    })

    it('handles zero tax rate', async () => {
      const remoteRow = {
        id: 'remote-uuid-10',
        code: 'ZERO_TAX',
        rate: 0,
        device_id: 'device-7',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteTaxCodeChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db.prepare('SELECT rate FROM tax_codes WHERE code = ?').get('ZERO_TAX') as Record<
        string,
        unknown
      >
      expect(row.rate).toBe(0)
    })
  })
})

describe('uploadTaxCode (error handling)', () => {
  beforeEach(createTestDb)

  it('throws when uploadTaxCode receives Supabase error', async () => {
    const db = getDb()
    const result = db.prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?)').run('TEST', 0.08)
    const taxId = result.lastInsertRowid as number

    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Invalid tax code format' }
            })
          })
        })
      })
    }

    const payload = {
      tax_code: {
        id: taxId,
        code: 'TEST',
        rate: 0.08,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadTaxCode(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Tax code upload failed: Invalid tax code format')
  })

  it('throws when uploadTaxCode Supabase request fails', async () => {
    const db = getDb()
    const result = db.prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?)').run('FAIL', 0.08)
    const taxId = result.lastInsertRowid as number

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
      tax_code: {
        id: taxId,
        code: 'FAIL',
        rate: 0.08,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadTaxCode(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow()
  })

  it('throws when uploadTaxCode returns null data without error', async () => {
    const db = getDb()
    const result = db.prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?)').run('NULL', 0.08)
    const taxId = result.lastInsertRowid as number

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
      tax_code: {
        id: taxId,
        code: 'NULL',
        rate: 0.08,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadTaxCode(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Tax code upload failed: unknown')
  })
})
