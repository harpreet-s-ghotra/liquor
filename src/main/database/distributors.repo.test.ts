import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'
import {
  getDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor
} from './distributors.repo'
import { getPendingItems } from './sync-queue.repo'

// Mock getDeviceConfig so enqueue doesn't fail
vi.mock('./device-config.repo', () => ({
  getDeviceConfig: () => ({
    device_id: 'test-device-uuid',
    merchant_id: 'test-merchant',
    subscription_status: 'active',
    created_at: new Date().toISOString()
  })
}))

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('distributors.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('getDistributors', () => {
    it('returns empty list on fresh DB', () => {
      const distributors = getDistributors()
      expect(distributors).toEqual([])
    })

    it('returns distributors ordered by name', () => {
      createDistributor({ distributor_name: 'Zebra Spirits' })
      createDistributor({ distributor_name: 'Alpha Wines' })
      const list = getDistributors()
      const names = list.map((d) => d.distributor_name)
      expect(names.indexOf('Alpha Wines')).toBeLessThan(names.indexOf('Zebra Spirits'))
    })
  })

  describe('createDistributor', () => {
    it('creates with name only', () => {
      const d = createDistributor({ distributor_name: 'Empire Merchants' })
      expect(d.distributor_number).toBeGreaterThan(0)
      expect(d.distributor_name).toBe('Empire Merchants')
      expect(d.license_id).toBeNull()
      expect(d.serial_number).toBeNull()
      expect(d.premises_name).toBeNull()
      expect(d.premises_address).toBeNull()
      expect(d.is_active).toBe(1)
    })

    it('creates with all fields', () => {
      const d = createDistributor({
        distributor_name: 'Full Dist',
        license_id: 'LIC-999',
        serial_number: 'SN-123',
        premises_name: 'Main Warehouse',
        premises_address: '123 Distillery Rd'
      })
      expect(d.license_id).toBe('LIC-999')
      expect(d.serial_number).toBe('SN-123')
      expect(d.premises_name).toBe('Main Warehouse')
      expect(d.premises_address).toBe('123 Distillery Rd')
    })

    it('trims name whitespace', () => {
      const d = createDistributor({ distributor_name: '  Padded Name  ' })
      expect(d.distributor_name).toBe('Padded Name')
    })

    it('throws on empty name', () => {
      expect(() => createDistributor({ distributor_name: '' })).toThrow(
        'Distributor name is required'
      )
    })

    it('throws on whitespace-only name', () => {
      expect(() => createDistributor({ distributor_name: '   ' })).toThrow(
        'Distributor name is required'
      )
    })

    it('throws on name exceeding max length', () => {
      const longName = 'A'.repeat(201)
      expect(() => createDistributor({ distributor_name: longName })).toThrow('characters or less')
    })
  })

  describe('updateDistributor', () => {
    it('updates name and license fields', () => {
      const created = createDistributor({ distributor_name: 'Old Name' })
      const updated = updateDistributor({
        distributor_number: created.distributor_number,
        distributor_name: 'New Name',
        license_id: 'LIC-001'
      })
      expect(updated.distributor_name).toBe('New Name')
      expect(updated.license_id).toBe('LIC-001')
    })

    it('throws on empty name', () => {
      const created = createDistributor({ distributor_name: 'Test' })
      expect(() =>
        updateDistributor({
          distributor_number: created.distributor_number,
          distributor_name: ''
        })
      ).toThrow('Distributor name is required')
    })

    it('throws on non-existent distributor', () => {
      expect(() =>
        updateDistributor({
          distributor_number: 99999,
          distributor_name: 'Ghost'
        })
      ).toThrow('Distributor not found')
    })
  })

  describe('deleteDistributor', () => {
    it('deletes a distributor with no products', () => {
      const created = createDistributor({ distributor_name: 'To Delete' })
      deleteDistributor(created.distributor_number)
      const list = getDistributors()
      expect(list.find((d) => d.distributor_number === created.distributor_number)).toBeUndefined()
    })

    it('throws on non-existent distributor', () => {
      expect(() => deleteDistributor(99999)).toThrow('Distributor not found')
    })

    it('throws when distributor is assigned to products', () => {
      const dist = createDistributor({ distributor_name: 'Has Products' })
      getDb()
        .prepare(
          `INSERT INTO products (sku, name, category, price, quantity, barcode, tax_rate, distributor_number)
           VALUES ('TEST-001', 'Test Product', 'Spirits', 9.99, 1, '111', 0.08, ?)`
        )
        .run(dist.distributor_number)

      expect(() => deleteDistributor(dist.distributor_number)).toThrow(
        'Cannot delete distributor that is assigned to products'
      )
    })
  })

  describe('enqueue sync for distributors', () => {
    it('enqueues INSERT when creating a distributor', () => {
      const created = createDistributor({
        distributor_name: 'Sync Dist 1',
        license_id: 'LIC-001',
        serial_number: 'SN-001'
      })

      const pending = getPendingItems()
      expect(pending).toHaveLength(1)
      expect(pending[0].entity_type).toBe('distributor')
      expect(pending[0].entity_id).toBe(String(created.distributor_number))
      expect(pending[0].operation).toBe('INSERT')
      expect(pending[0].status).toBe('pending')
      expect(pending[0].device_id).toBe('test-device-uuid')
    })

    it('enqueues UPDATE when updating a distributor', () => {
      const created = createDistributor({
        distributor_name: 'Original Name',
        license_id: 'LIC-001'
      })

      const updated = updateDistributor({
        distributor_number: created.distributor_number,
        distributor_name: 'Updated Name',
        license_id: 'LIC-002'
      })

      // Get all pending items and find the UPDATE
      const pending = getPendingItems()
      const updateOps = pending.filter(
        (p) =>
          p.entity_type === 'distributor' &&
          p.entity_id === String(updated.distributor_number) &&
          p.operation === 'UPDATE'
      )
      expect(updateOps).toHaveLength(1)
    })

    it('enqueues DELETE when deleting a distributor', () => {
      const created = createDistributor({
        distributor_name: 'To Delete Sync'
      })

      deleteDistributor(created.distributor_number)

      // Get all pending items and find the DELETE
      const pending = getPendingItems()
      const deleteOps = pending.filter(
        (p) =>
          p.entity_type === 'distributor' &&
          p.entity_id === String(created.distributor_number) &&
          p.operation === 'DELETE'
      )
      expect(deleteOps).toHaveLength(1)
    })

    it('enqueues payload with correct structure', () => {
      const created = createDistributor({
        distributor_name: 'Payload Test',
        license_id: 'LIC-999',
        serial_number: 'SN-999',
        premises_name: 'Main Office',
        premises_address: '123 Main St'
      })

      const pending = getPendingItems()
      const payload = JSON.parse(pending[0].payload)

      expect(payload.distributor).toBeDefined()
      expect(payload.distributor.distributor_number).toBe(created.distributor_number)
      expect(payload.distributor.distributor_name).toBe('Payload Test')
      expect(payload.distributor.license_id).toBe('LIC-999')
      expect(payload.distributor.serial_number).toBe('SN-999')
      expect(payload.distributor.premises_name).toBe('Main Office')
      expect(payload.distributor.premises_address).toBe('123 Main St')
      expect(payload.distributor.is_active).toBe(1)
      expect(payload.distributor.updated_at).toBeDefined()
    })

    it('enqueues multiple operations in FIFO order', () => {
      const d1 = createDistributor({ distributor_name: 'First' })
      const d2 = createDistributor({ distributor_name: 'Second' })

      updateDistributor({
        distributor_number: d1.distributor_number,
        distributor_name: 'First Updated'
      })
      deleteDistributor(d2.distributor_number)

      const pending = getPendingItems()
      expect(pending.map((p) => p.operation)).toEqual(['INSERT', 'INSERT', 'UPDATE', 'DELETE'])
    })
  })
})
