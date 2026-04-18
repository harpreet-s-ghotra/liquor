import { getDb } from './connection'

type ConsumeResult = {
  totalCost: number
  consumedQuantity: number
}

export type CostLayerRow = {
  id: number
  product_id: number
  received_at: string
  quantity_received: number
  quantity_remaining: number
  cost_per_unit: number
  source: string | null
  source_reference: string | null
  device_id: string | null
  created_at: string
}

export function listOpenCostLayers(productId: number): CostLayerRow[] {
  return getDb()
    .prepare(
      `SELECT
         id,
         product_id,
         received_at,
         quantity_received,
         quantity_remaining,
         cost_per_unit,
         source,
         source_reference,
         device_id,
         created_at
       FROM product_cost_layers
       WHERE product_id = ? AND quantity_remaining > 0
       ORDER BY received_at ASC, id ASC`
    )
    .all(productId) as CostLayerRow[]
}

export function createCostLayer(input: {
  productId: number
  quantity: number
  costPerUnit: number
  source: 'receiving' | 'manual_adjustment' | 'refund' | 'initial_import' | 'migration_seed'
  sourceReference?: string | null
  deviceId?: string | null
  receivedAt?: string
}): number {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Cost layer quantity must be a positive integer')
  }

  if (!Number.isFinite(input.costPerUnit) || input.costPerUnit < 0) {
    throw new Error('Cost layer unit cost must be a non-negative number')
  }

  const result = getDb()
    .prepare(
      `INSERT INTO product_cost_layers (
         product_id,
         received_at,
         quantity_received,
         quantity_remaining,
         cost_per_unit,
         source,
         source_reference,
         device_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.productId,
      input.receivedAt ?? new Date().toISOString(),
      input.quantity,
      input.quantity,
      input.costPerUnit,
      input.source,
      input.sourceReference ?? null,
      input.deviceId ?? null
    )

  return Number(result.lastInsertRowid)
}

export function consumeCostLayersForSale(input: {
  productId: number
  quantity: number
  fallbackUnitCost: number
}): ConsumeResult {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Consumed quantity must be a positive integer')
  }

  if (!Number.isFinite(input.fallbackUnitCost) || input.fallbackUnitCost < 0) {
    throw new Error('Fallback unit cost must be a non-negative number')
  }

  const db = getDb()
  const layers = listOpenCostLayers(input.productId)

  let remaining = input.quantity
  let totalCost = 0

  for (const layer of layers) {
    if (remaining <= 0) break

    const take = Math.min(layer.quantity_remaining, remaining)
    if (take <= 0) continue

    totalCost += take * layer.cost_per_unit
    remaining -= take

    db.prepare(
      'UPDATE product_cost_layers SET quantity_remaining = quantity_remaining - ? WHERE id = ?'
    ).run(take, layer.id)
  }

  if (remaining > 0) {
    // Keep checkout unblocked even when legacy data has thin/no layers.
    totalCost += remaining * input.fallbackUnitCost
    remaining = 0
  }

  return {
    totalCost: Math.round(totalCost * 10000) / 10000,
    consumedQuantity: input.quantity
  }
}
