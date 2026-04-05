import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase } from '../../database/connection'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applySchema } from '../../database/schema'
import { applyRemoteDistributorChange, uploadDistributor } from './distributor-sync'
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

describe('distributor-sync.ts', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('applyRemoteDistributorChange', () => {
    it('inserts a new distributor when distributor_number does not exist locally', async () => {
      const remoteRow = {
        id: 'remote-uuid-1',
        distributor_number: 10001,
        distributor_name: 'Premium Spirits Co',
        license_id: 'LIC-10001',
        serial_number: 'SN-10001',
        premises_name: 'Main Warehouse',
        premises_address: '456 Distributor Ave',
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare(
          'SELECT distributor_number, distributor_name, license_id, cloud_id, is_active FROM distributors WHERE distributor_number = ?'
        )
        .get(10001) as Record<string, unknown>
      expect(row).toBeDefined()
      expect(row.distributor_name).toBe('Premium Spirits Co')
      expect(row.license_id).toBe('LIC-10001')
      expect(row.cloud_id).toBe('remote-uuid-1')
      expect(row.is_active).toBe(1)
    })

    it('updates an existing distributor when remote is newer', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO distributors
         (distributor_number, distributor_name, license_id, cloud_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(10002, 'Old Name Inc', 'LIC-OLD', 'cloud-uuid-1', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-uuid-1',
        distributor_number: 10002,
        distributor_name: 'Updated Name Inc',
        license_id: 'LIC-NEW',
        serial_number: 'SN-NEW',
        premises_name: 'New Warehouse',
        premises_address: '789 New St',
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare(
          'SELECT distributor_name, license_id, serial_number, premises_name FROM distributors WHERE distributor_number = ?'
        )
        .get(10002) as Record<string, unknown>
      expect(row.distributor_name).toBe('Updated Name Inc')
      expect(row.license_id).toBe('LIC-NEW')
      expect(row.serial_number).toBe('SN-NEW')
      expect(row.premises_name).toBe('New Warehouse')
    })

    it('skips update when local is newer (last-write-wins)', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO distributors
         (distributor_number, distributor_name, license_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run(10003, 'Newer Local', 'LIC-LOCAL', '2026-04-06T12:00:00Z')

      const remoteRow = {
        id: 'remote-uuid-3',
        distributor_number: 10003,
        distributor_name: 'Older Remote',
        license_id: 'LIC-REMOTE',
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        device_id: 'remote-device',
        updated_at: '2026-04-01T12:00:00Z' // Older
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT distributor_name FROM distributors WHERE distributor_number = ?')
        .get(10003) as Record<string, unknown>
      expect(row.distributor_name).toBe('Newer Local') // Unchanged
    })

    it('handles null optional fields gracefully', async () => {
      const remoteRow = {
        id: 'remote-uuid-4',
        distributor_number: 10004,
        distributor_name: 'Minimal Dist',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        device_id: null,
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare(
          'SELECT distributor_name, license_id, serial_number, premises_name, premises_address, last_modified_by_device FROM distributors WHERE distributor_number = ?'
        )
        .get(10004) as Record<string, unknown>
      expect(row.distributor_name).toBe('Minimal Dist')
      expect(row.license_id).toBeNull()
      expect(row.serial_number).toBeNull()
      expect(row.premises_name).toBeNull()
      expect(row.premises_address).toBeNull()
      expect(row.last_modified_by_device).toBeNull()
    })

    it('tracks last_modified_by_device', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO distributors
         (distributor_number, distributor_name, last_modified_by_device, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run(10005, 'Device Tracking', 'device-old', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'remote-uuid-5',
        distributor_number: 10005,
        distributor_name: 'Device Tracking',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        device_id: 'device-new',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT last_modified_by_device FROM distributors WHERE distributor_number = ?')
        .get(10005) as Record<string, unknown>
      expect(row.last_modified_by_device).toBe('device-new')
    })

    it('updates is_active field with default fallback', async () => {
      const remoteRow = {
        id: 'remote-uuid-6',
        distributor_number: 10006,
        distributor_name: 'Active Test',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: null, // Missing is_active
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT is_active FROM distributors WHERE distributor_number = ?')
        .get(10006) as Record<string, unknown>
      expect(row.is_active).toBe(1) // Defaults to active
    })

    it('sets synced_at when syncing', async () => {
      const db = getDb()
      const remoteRow = {
        id: 'remote-uuid-7',
        distributor_number: 10007,
        distributor_name: 'Sync Time Test',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT synced_at FROM distributors WHERE distributor_number = ?')
        .get(10007) as Record<string, unknown>
      expect(row.synced_at).toBeDefined()
      expect(typeof row.synced_at).toBe('string')
      // synced_at should be set to CURRENT_TIMESTAMP (just verify it exists and is a timestamp)
      expect(String(row.synced_at).length).toBeGreaterThan(0)
    })

    it('handles long text fields', async () => {
      const longAddress = 'A'.repeat(255)
      const remoteRow = {
        id: 'remote-uuid-8',
        distributor_number: 10008,
        distributor_name: 'Long Text Test',
        license_id: 'LIC-' + 'B'.repeat(40),
        serial_number: 'SN-' + 'C'.repeat(40),
        premises_name: 'D'.repeat(100),
        premises_address: longAddress,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT premises_address FROM distributors WHERE distributor_number = ?')
        .get(10008) as Record<string, unknown>
      expect(row.premises_address).toBe(longAddress)
    })

    it('preserves cloud_id when updating', async () => {
      const db = getDb()
      db.prepare(
        `INSERT INTO distributors
         (distributor_number, distributor_name, cloud_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run(10009, 'Old Name', 'cloud-id-original', '2026-04-01T12:00:00Z')

      const remoteRow = {
        id: 'cloud-id-original',
        distributor_number: 10009,
        distributor_name: 'Updated Name',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const row = db
        .prepare('SELECT cloud_id FROM distributors WHERE distributor_number = ?')
        .get(10009) as Record<string, unknown>
      expect(row.cloud_id).toBe('cloud-id-original')
    })
  })

  describe('distributor state consistency', () => {
    it('maintains numeric distributor_number as PK', async () => {
      const remoteRow = {
        id: 'remote-uuid-9',
        distributor_number: 99999,
        distributor_name: 'PK Test',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        device_id: 'device',
        updated_at: '2026-04-05T12:00:00Z'
      }

      await applyRemoteDistributorChange(
        mockSupabase as unknown as SupabaseClient,
        'merchant-1',
        remoteRow
      )

      const db = getDb()
      const row = db
        .prepare('SELECT distributor_number FROM distributors WHERE distributor_number = ?')
        .get(99999) as Record<string, unknown>
      expect(typeof row.distributor_number).toBe('number')
      expect(row.distributor_number).toBe(99999)
    })
  })
})

describe('uploadDistributor (error handling)', () => {
  beforeEach(createTestDb)

  it('throws when uploadDistributor receives Supabase error', async () => {
    const mockSupabaseWithError = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Invalid distributor number' }
            })
          })
        })
      })
    }

    const payload = {
      distributor: {
        distributor_number: 10001,
        distributor_name: 'Test Dist',
        license_id: 'LIC-001',
        serial_number: 'SN-001',
        premises_name: 'Main',
        premises_address: '123 Main St',
        is_active: 1,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadDistributor(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Distributor upload failed: Invalid distributor number')
  })

  it('throws when uploadDistributor Supabase request fails', async () => {
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
      distributor: {
        distributor_number: 10002,
        distributor_name: 'Test Dist',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadDistributor(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow()
  })

  it('throws when uploadDistributor returns null data without error', async () => {
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
      distributor: {
        distributor_number: 10003,
        distributor_name: 'Test Dist',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1,
        updated_at: new Date().toISOString()
      }
    }

    await expect(
      uploadDistributor(
        mockSupabaseWithError as unknown as SupabaseClient,
        'merchant-1',
        'device-1',
        payload
      )
    ).rejects.toThrow('Distributor upload failed: unknown')
  })
})
