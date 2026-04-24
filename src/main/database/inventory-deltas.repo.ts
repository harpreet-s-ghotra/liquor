import { getDb } from './connection'
import type { InventoryDeltaSyncPayload } from '../services/sync/types'

export type InventoryDeltaReason =
  | 'sale'
  | 'refund'
  | 'manual_adjustment'
  | 'receiving'
  | 'receiving_correction'

export type RecordInventoryDeltaInput = {
  product_id: number
  product_sku: string
  delta: number
  reason: InventoryDeltaReason
  reference_id?: string | null
  device_id?: string | null
}

export type InventoryDeltaRecord = {
  id: number
  product_id: number
  product_sku: string
  delta: number
  reason: InventoryDeltaReason
  reference_id: string | null
  device_id: string | null
  synced_at: string | null
  created_at: string
}

export function recordDelta(input: RecordInventoryDeltaInput): number {
  const db = getDb()
  const result = db
    .prepare(
      `
      INSERT INTO inventory_deltas (
        product_id,
        product_sku,
        delta,
        reason,
        reference_id,
        device_id
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.product_id,
      input.product_sku,
      input.delta,
      input.reason,
      input.reference_id ?? null,
      input.device_id ?? null
    )

  return Number(result.lastInsertRowid)
}

export function getInventoryDeltaById(id: number): InventoryDeltaRecord | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM inventory_deltas WHERE id = ?').get(id)
  return (row as InventoryDeltaRecord | undefined) ?? null
}

export function getInventoryDeltaSyncPayload(id: number): InventoryDeltaSyncPayload | null {
  const delta = getInventoryDeltaById(id)
  if (!delta) return null

  return {
    delta: {
      id: delta.id,
      product_id: delta.product_id,
      product_sku: delta.product_sku,
      delta: delta.delta,
      reason: delta.reason,
      reference_id: delta.reference_id,
      created_at: delta.created_at
    }
  }
}

export function getUnsyncedDeltas(limit = 100): InventoryDeltaRecord[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT *
      FROM inventory_deltas
      WHERE synced_at IS NULL
      ORDER BY id ASC
      LIMIT ?
      `
    )
    .all(limit) as InventoryDeltaRecord[]
}

export function markDeltaSynced(id: number): void {
  const db = getDb()
  db.prepare('UPDATE inventory_deltas SET synced_at = CURRENT_TIMESTAMP WHERE id = ?').run(id)
}

export function getDeltasByProduct(productId: number): InventoryDeltaRecord[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT *
      FROM inventory_deltas
      WHERE product_id = ?
      ORDER BY id DESC
      `
    )
    .all(productId) as InventoryDeltaRecord[]
}
