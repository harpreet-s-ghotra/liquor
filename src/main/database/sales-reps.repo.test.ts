import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from './connection'
import { applySchema } from './schema'
import { createDistributor } from './distributors.repo'
import {
  getSalesRepsByDistributor,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep
} from './sales-reps.repo'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('sales-reps.repo', () => {
  let distNum: number

  beforeEach(() => {
    createTestDb()
    const dist = createDistributor({ distributor_name: 'Test Distributor' })
    distNum = dist.distributor_number
  })

  describe('getSalesRepsByDistributor', () => {
    it('returns empty array when no reps exist', () => {
      const reps = getSalesRepsByDistributor(distNum)
      expect(reps).toEqual([])
    })

    it('returns reps ordered by name', () => {
      createSalesRep({ distributor_number: distNum, rep_name: 'Zack' })
      createSalesRep({ distributor_number: distNum, rep_name: 'Alice' })
      const reps = getSalesRepsByDistributor(distNum)
      expect(reps[0].rep_name).toBe('Alice')
      expect(reps[1].rep_name).toBe('Zack')
    })

    it('only returns reps for the specified distributor', () => {
      const other = createDistributor({ distributor_name: 'Other Dist' })
      createSalesRep({ distributor_number: distNum, rep_name: 'Rep A' })
      createSalesRep({ distributor_number: other.distributor_number, rep_name: 'Rep B' })

      const reps = getSalesRepsByDistributor(distNum)
      expect(reps).toHaveLength(1)
      expect(reps[0].rep_name).toBe('Rep A')
    })
  })

  describe('createSalesRep', () => {
    it('creates with name only', () => {
      const rep = createSalesRep({ distributor_number: distNum, rep_name: 'John Doe' })
      expect(rep.sales_rep_id).toBeGreaterThan(0)
      expect(rep.rep_name).toBe('John Doe')
      expect(rep.distributor_number).toBe(distNum)
      expect(rep.phone).toBeNull()
      expect(rep.email).toBeNull()
      expect(rep.is_active).toBe(1)
    })

    it('creates with all fields', () => {
      const rep = createSalesRep({
        distributor_number: distNum,
        rep_name: 'Jane Smith',
        phone: '555-1234',
        email: 'jane@example.com'
      })
      expect(rep.phone).toBe('555-1234')
      expect(rep.email).toBe('jane@example.com')
    })

    it('trims name whitespace', () => {
      const rep = createSalesRep({ distributor_number: distNum, rep_name: '  Padded  ' })
      expect(rep.rep_name).toBe('Padded')
    })

    it('throws on empty name', () => {
      expect(() => createSalesRep({ distributor_number: distNum, rep_name: '' })).toThrow(
        'Sales rep name is required'
      )
    })

    it('throws on non-existent distributor', () => {
      expect(() => createSalesRep({ distributor_number: 99999, rep_name: 'Ghost' })).toThrow(
        'Distributor not found'
      )
    })

    it('throws on name exceeding max length', () => {
      const longName = 'A'.repeat(201)
      expect(() => createSalesRep({ distributor_number: distNum, rep_name: longName })).toThrow(
        'characters or less'
      )
    })
  })

  describe('updateSalesRep', () => {
    it('updates name and contact fields', () => {
      const created = createSalesRep({ distributor_number: distNum, rep_name: 'Old Name' })
      const updated = updateSalesRep({
        sales_rep_id: created.sales_rep_id,
        rep_name: 'New Name',
        phone: '555-9999',
        email: 'new@test.com'
      })
      expect(updated.rep_name).toBe('New Name')
      expect(updated.phone).toBe('555-9999')
      expect(updated.email).toBe('new@test.com')
      expect(updated.distributor_number).toBe(distNum)
    })

    it('throws on empty name', () => {
      const created = createSalesRep({ distributor_number: distNum, rep_name: 'Test' })
      expect(() => updateSalesRep({ sales_rep_id: created.sales_rep_id, rep_name: '' })).toThrow(
        'Sales rep name is required'
      )
    })

    it('throws on non-existent sales rep', () => {
      expect(() => updateSalesRep({ sales_rep_id: 99999, rep_name: 'Ghost' })).toThrow(
        'Sales rep not found'
      )
    })
  })

  describe('deleteSalesRep', () => {
    it('deletes a sales rep', () => {
      const created = createSalesRep({ distributor_number: distNum, rep_name: 'To Delete' })
      deleteSalesRep(created.sales_rep_id)
      const reps = getSalesRepsByDistributor(distNum)
      expect(reps.find((r) => r.sales_rep_id === created.sales_rep_id)).toBeUndefined()
    })

    it('throws on non-existent sales rep', () => {
      expect(() => deleteSalesRep(99999)).toThrow('Sales rep not found')
    })
  })
})
