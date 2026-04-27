import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'
import {
  getTaxCodes,
  createTaxCode,
  updateTaxCode,
  deleteTaxCode,
  setDefaultTaxCode
} from './tax-codes.repo'
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

describe('tax-codes.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('getTaxCodes', () => {
    it('returns empty list on fresh DB', () => {
      const list = getTaxCodes()
      expect(list).toEqual([])
    })

    it('returns tax codes ordered by rate', () => {
      createTaxCode({ code: 'SAT', rate: 0.08875 })
      createTaxCode({ code: 'NYC', rate: 0.08 })
      createTaxCode({ code: 'IMPORT', rate: 0.05 })

      const list = getTaxCodes()
      expect(list.length).toBe(3)
      expect(list[0].rate).toBe(0.05)
      expect(list[1].rate).toBe(0.08)
      expect(list[2].rate).toBeLessThanOrEqual(0.089) // Allow rounding
    })
  })

  describe('createTaxCode', () => {
    it('creates a new tax code and enqueues INSERT sync', () => {
      const result = createTaxCode({ code: 'CA_TAX', rate: 0.0725 })

      expect(result.id).toBeGreaterThan(0)
      expect(result.code).toBe('CA_TAX')
      expect(result.rate).toBe(0.0725)

      const pending = getPendingItems()
      expect(pending).toHaveLength(1)
      expect(pending[0].entity_type).toBe('tax_code')
      expect(pending[0].entity_id).toBe(String(result.id))
      expect(pending[0].operation).toBe('INSERT')
      expect(pending[0].status).toBe('pending')
    })

    it('normalizes rate to 6 decimal places', () => {
      const result = createTaxCode({ code: 'TEST', rate: 0.123456789 })
      expect(result.rate).toBe(0.123457)
    })

    it('throws when code is empty', () => {
      expect(() => createTaxCode({ code: '', rate: 0.08 })).toThrow('Tax code name is required')
    })

    it('throws when code is whitespace-only', () => {
      expect(() => createTaxCode({ code: '   ', rate: 0.08 })).toThrow('Tax code name is required')
    })

    it('throws when rate is negative', () => {
      expect(() => createTaxCode({ code: 'BAD', rate: -0.01 })).toThrow(
        'Tax rate must be between 0 and 1'
      )
    })

    it('throws when rate exceeds 1', () => {
      expect(() => createTaxCode({ code: 'BAD', rate: 1.1 })).toThrow(
        'Tax rate must be between 0 and 1'
      )
    })

    it('throws when code already exists', () => {
      createTaxCode({ code: 'DUPE', rate: 0.08 })
      expect(() => createTaxCode({ code: 'DUPE', rate: 0.09 })).toThrow('Tax code already exists')
    })
  })

  describe('updateTaxCode', () => {
    it('updates an existing tax code and enqueues UPDATE sync', () => {
      const created = createTaxCode({ code: 'OLD', rate: 0.08 })

      const result = updateTaxCode({
        id: created.id,
        code: 'NEW',
        rate: 0.09
      })

      expect(result.id).toBe(created.id)
      expect(result.code).toBe('NEW')
      expect(result.rate).toBe(0.09)

      const pending = getPendingItems()
      const updates = pending.filter((p) => p.operation === 'UPDATE')
      expect(updates).toHaveLength(1)
      expect(updates[0].entity_id).toBe(String(created.id))
    })

    it('throws when code is empty', () => {
      const created = createTaxCode({ code: 'TEST', rate: 0.08 })
      expect(() => updateTaxCode({ id: created.id, code: '', rate: 0.08 })).toThrow(
        'Tax code name is required'
      )
    })

    it('throws when creating a duplicate code', () => {
      const code1 = createTaxCode({ code: 'FIRST', rate: 0.08 })
      createTaxCode({ code: 'SECOND', rate: 0.09 })

      expect(() =>
        updateTaxCode({
          id: code1.id,
          code: 'SECOND',
          rate: 0.085
        })
      ).toThrow('Tax code already exists')
    })

    it('allows updating to the same code (idempotent)', () => {
      const created = createTaxCode({ code: 'SAME', rate: 0.08 })

      const result = updateTaxCode({
        id: created.id,
        code: 'SAME',
        rate: 0.08
      })

      expect(result.code).toBe('SAME')
    })
  })

  describe('deleteTaxCode', () => {
    it('deletes a tax code and enqueues DELETE sync', () => {
      // A default tax code must exist so products can be reassigned away from
      // the deleted code.
      const fallback = createTaxCode({ code: 'DEFAULT', rate: 0.05 })
      setDefaultTaxCode(fallback.id)
      const created = createTaxCode({ code: 'TO_DELETE', rate: 0.08 })

      deleteTaxCode(created.id)

      const allPending = getPendingItems()
      const deleteOps = allPending.filter((p) => p.operation === 'DELETE')
      expect(deleteOps).toHaveLength(1)
      expect(deleteOps[0].entity_id).toBe(String(created.id))

      const list = getTaxCodes()
      expect(list.map((t) => t.code)).toEqual(['DEFAULT'])
    })

    it('throws when tax code does not exist', () => {
      expect(() => deleteTaxCode(9999)).toThrow('Tax code not found')
    })

    it('throws when no default tax code is set', () => {
      const tc = createTaxCode({ code: 'ORPHAN', rate: 0.1 })
      expect(() => deleteTaxCode(tc.id)).toThrow(/default tax code/i)
    })

    it('reassigns products from the deleted rate to the default rate', () => {
      const defaultTc = createTaxCode({ code: 'DEFAULT_TC', rate: 0.05 })
      setDefaultTaxCode(defaultTc.id)
      const oldTc = createTaxCode({ code: 'OLD_TC', rate: 0.13 })

      const db = getDb()
      db.prepare(
        `INSERT INTO products (sku, name, category, price, retail_price, in_stock, tax_1)
         VALUES ('A', 'A', 'Misc', 10, 10, 5, ?), ('B', 'B', 'Misc', 20, 20, 5, ?), ('C', 'C', 'Misc', 30, 30, 5, ?)`
      ).run(0.13, 0.13, 0.05)

      deleteTaxCode(oldTc.id)

      const rows = db
        .prepare('SELECT sku, COALESCE(tax_1, tax_rate) AS rate FROM products ORDER BY sku')
        .all() as { sku: string; rate: number }[]
      expect(rows.map((r) => `${r.sku}:${r.rate}`)).toEqual(['A:0.05', 'B:0.05', 'C:0.05'])
    })
  })

  describe('enqueue sync integrity', () => {
    it('enqueues payload with correct structure', () => {
      const created = createTaxCode({ code: 'PAYLOAD_TEST', rate: 0.0765 })

      const pending = getPendingItems()
      const insertOp = pending[0]

      expect(insertOp.device_id).toBe('test-device-uuid')

      const payload = JSON.parse(insertOp.payload)
      expect(payload.tax_code).toBeDefined()
      expect(payload.tax_code.id).toBe(created.id)
      expect(payload.tax_code.code).toBe('PAYLOAD_TEST')
      expect(payload.tax_code.rate).toBe(0.0765)
      expect(payload.tax_code.updated_at).toBeDefined()
    })

    it('enqueues multiple operations in FIFO order', () => {
      const tc1 = createTaxCode({ code: 'FIRST', rate: 0.08 })
      const tc2 = createTaxCode({ code: 'SECOND', rate: 0.09 })
      // Make tc1 the default so deleting tc2 has a fallback to reassign to.
      setDefaultTaxCode(tc1.id)

      updateTaxCode({ id: tc1.id, code: 'FIRST', rate: 0.085 })
      deleteTaxCode(tc2.id)

      const pending = getPendingItems()
      // INSERT (tc1), INSERT (tc2), UPDATE (default flag), UPDATE (rate edit), DELETE (tc2)
      expect(pending.map((p) => p.operation)).toEqual([
        'INSERT',
        'INSERT',
        'UPDATE',
        'UPDATE',
        'DELETE'
      ])
    })
  })
})
