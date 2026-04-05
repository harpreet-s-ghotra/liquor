import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from './connection'
import { applySchema } from './schema'
import {
  getDeltasByProduct,
  getInventoryDeltaById,
  getInventoryDeltaSyncPayload,
  getUnsyncedDeltas,
  markDeltaSynced,
  recordDelta
} from './inventory-deltas.repo'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)

  db.prepare(
    `
    INSERT INTO products (sku, name, category, price, quantity, in_stock, tax_rate)
    VALUES ('SYNC-001', 'Sync Product', 'Wine', 10, 5, 5, 0)
    `
  ).run()
}

describe('inventory-deltas.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  it('records a delta and returns the inserted id', () => {
    const id = recordDelta({
      product_id: 1,
      product_sku: 'SYNC-001',
      delta: -2,
      reason: 'sale',
      reference_id: 'TXN-123',
      device_id: 'device-1'
    })

    const saved = getInventoryDeltaById(id)
    expect(saved).not.toBeNull()
    expect(saved?.product_sku).toBe('SYNC-001')
    expect(saved?.delta).toBe(-2)
    expect(saved?.reason).toBe('sale')
    expect(saved?.reference_id).toBe('TXN-123')
    expect(saved?.synced_at).toBeNull()
  })

  it('returns unsynced deltas in insertion order', () => {
    recordDelta({ product_id: 1, product_sku: 'SYNC-001', delta: -1, reason: 'sale' })
    recordDelta({ product_id: 1, product_sku: 'SYNC-001', delta: 2, reason: 'refund' })

    const rows = getUnsyncedDeltas()
    expect(rows).toHaveLength(2)
    expect(rows[0].delta).toBe(-1)
    expect(rows[1].delta).toBe(2)
  })

  it('marks a delta as synced', () => {
    const id = recordDelta({
      product_id: 1,
      product_sku: 'SYNC-001',
      delta: 5,
      reason: 'receiving'
    })

    markDeltaSynced(id)

    const saved = getInventoryDeltaById(id)
    expect(saved?.synced_at).toBeTruthy()
    expect(getUnsyncedDeltas()).toEqual([])
  })

  it('filters deltas by product', () => {
    recordDelta({ product_id: 1, product_sku: 'SYNC-001', delta: -1, reason: 'sale' })
    recordDelta({ product_id: 1, product_sku: 'SYNC-001', delta: 3, reason: 'receiving' })

    const rows = getDeltasByProduct(1)
    expect(rows).toHaveLength(2)
    expect(rows[0].delta).toBe(3)
    expect(rows[1].delta).toBe(-1)
  })

  it('builds a sync payload from a stored delta', () => {
    const id = recordDelta({
      product_id: 1,
      product_sku: 'SYNC-001',
      delta: -4,
      reason: 'sale',
      reference_id: 'TXN-555'
    })

    expect(getInventoryDeltaSyncPayload(id)).toEqual({
      delta: {
        id,
        product_id: 1,
        product_sku: 'SYNC-001',
        delta: -4,
        reason: 'sale',
        reference_id: 'TXN-555',
        created_at: expect.any(String)
      }
    })
  })
})
