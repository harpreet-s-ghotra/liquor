import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'
import {
  getDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor
} from './distributors.repo'

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
})
