import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { getInventoryDeltaSyncPayload, recordDelta } from './inventory-deltas.repo'
import { consumeCostLayersForSale, createCostLayer } from './product-cost-layers.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderDetail,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemsInput,
  ReceivePurchaseOrderItemInput
} from '../../shared/types'

// ── Helpers ──

/** Generate the next PO number in sequence: PO-YYYY-MM-NNNN */
function generatePoNumber(): string {
  const db = getDb()
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `PO-${year}-${month}-`

  const row = db
    .prepare(
      `SELECT po_number FROM purchase_orders
       WHERE po_number LIKE ? || '%'
       ORDER BY po_number DESC LIMIT 1`
    )
    .get(prefix) as { po_number: string } | undefined

  let seq = 1
  if (row) {
    const last = row.po_number.slice(prefix.length)
    seq = parseInt(last, 10) + 1
  }
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/** Recalculate subtotal/total on a PO from its line items. */
function recalcTotals(poId: number): void {
  const db = getDb()
  db.prepare(
    `UPDATE purchase_orders
     SET subtotal = COALESCE((SELECT SUM(line_total) FROM purchase_order_items WHERE po_id = ?), 0),
         total = COALESCE((SELECT SUM(line_total) FROM purchase_order_items WHERE po_id = ?), 0),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(poId, poId, poId)
}

function syncInventoryDelta(input: {
  productId: number
  delta: number
  reason: 'receiving' | 'receiving_correction'
  referenceId: string
  deviceId: string | null
}): void {
  const db = getDb()
  const skuRow = db
    .prepare('SELECT sku FROM products WHERE id = ? LIMIT 1')
    .get(input.productId) as { sku: string } | undefined

  const deltaId = recordDelta({
    product_id: input.productId,
    product_sku: skuRow?.sku ?? `UNKNOWN-${input.productId}`,
    delta: input.delta,
    reason: input.reason,
    reference_id: input.referenceId,
    device_id: input.deviceId
  })

  const payload = getInventoryDeltaSyncPayload(deltaId)
  if (payload && input.deviceId) {
    enqueueSyncItem({
      entity_type: 'inventory_delta',
      entity_id: String(deltaId),
      operation: 'INSERT',
      payload: JSON.stringify(payload),
      device_id: input.deviceId
    })
  }
}

function reconcilePurchaseOrderStatus(poId: number): void {
  const db = getDb()
  const items = db
    .prepare('SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE po_id = ?')
    .all(poId) as Array<{ quantity_ordered: number; quantity_received: number }>

  const fullyReceived =
    items.length > 0 && items.every((item) => item.quantity_received >= item.quantity_ordered)

  if (fullyReceived) {
    db.prepare(
      `UPDATE purchase_orders
       SET status = 'received',
           received_at = COALESCE(received_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(poId)
    return
  }

  // Lock: once a PO has been fully received, never downgrade it back to
  // 'submitted' on later edits. The PO's header status is authoritative;
  // line-item edit history stays on the items themselves.
  const current = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(poId) as
    | { status: string }
    | undefined
  if (current?.status === 'received') {
    db.prepare(`UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(poId)
    return
  }

  db.prepare(
    `UPDATE purchase_orders
     SET status = 'submitted',
         received_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(poId)
}

// ── Queries ──

export function getPurchaseOrders(): PurchaseOrder[] {
  return getDb()
    .prepare(
      `SELECT po.*, COUNT(poi.id) AS item_count
       FROM purchase_orders po
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       GROUP BY po.id
       ORDER BY po.created_at DESC`
    )
    .all() as PurchaseOrder[]
}

export function getPurchaseOrderDetail(poId: number): PurchaseOrderDetail | null {
  const db = getDb()
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as
    | PurchaseOrder
    | undefined
  if (!po) return null

  const items = db
    .prepare(`SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id ASC`)
    .all(poId) as PurchaseOrderItem[]

  const itemCount = items.length
  return { ...po, item_count: itemCount, items }
}

// ── Mutations ──

export function createPurchaseOrder(input: CreatePurchaseOrderInput): PurchaseOrderDetail {
  const db = getDb()

  if (!input.items.length) {
    throw new Error('Purchase order must have at least one item')
  }

  // Look up distributor name
  const dist = db
    .prepare('SELECT distributor_name FROM distributors WHERE distributor_number = ?')
    .get(input.distributor_number) as { distributor_name: string } | undefined
  if (!dist) throw new Error('Distributor not found')

  const poNumber = generatePoNumber()

  const insertPo = db.prepare(
    `INSERT INTO purchase_orders (po_number, distributor_number, distributor_name, status, notes)
     VALUES (?, ?, ?, 'draft', ?)`
  )
  const insertItem = db.prepare(
    `INSERT INTO purchase_order_items (
       po_id,
       product_id,
       sku,
       product_name,
       unit_cost,
       bottles_per_case,
       quantity_ordered,
       line_total
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const create = db.transaction(() => {
    const result = insertPo.run(
      poNumber,
      input.distributor_number,
      dist.distributor_name,
      input.notes ?? null
    )
    const poId = Number(result.lastInsertRowid)

    for (const item of input.items) {
      const product = db
        .prepare(
          'SELECT id, sku, name, cost, distributor_number, COALESCE(bottles_per_case, 1) AS bottles_per_case FROM products WHERE id = ?'
        )
        .get(item.product_id) as
        | {
            id: number
            sku: string
            name: string
            cost: number | null
            distributor_number: number | null
            bottles_per_case: number
          }
        | undefined
      if (!product) throw new Error(`Product ${item.product_id} not found`)
      if (product.distributor_number !== input.distributor_number) {
        throw new Error(
          `Product ${item.product_id} does not belong to distributor ${input.distributor_number}`
        )
      }

      const unitCost = item.unit_cost ?? product.cost ?? 0
      if (unitCost < 0) throw new Error('Unit cost must be greater than or equal to 0')
      const lineTotal = unitCost * item.quantity_ordered

      insertItem.run(
        poId,
        product.id,
        product.sku,
        product.name,
        unitCost,
        product.bottles_per_case > 0 ? product.bottles_per_case : 1,
        item.quantity_ordered,
        lineTotal
      )
    }

    recalcTotals(poId)
    return poId
  })

  const poId = create()
  return getPurchaseOrderDetail(poId)!
}

export function updatePurchaseOrder(input: UpdatePurchaseOrderInput): PurchaseOrder {
  const db = getDb()

  const existing = db
    .prepare('SELECT id, status FROM purchase_orders WHERE id = ?')
    .get(input.id) as { id: number; status: string } | undefined
  if (!existing) throw new Error('Purchase order not found')

  if (existing.status === 'received') {
    throw new Error('Cannot modify a received purchase order')
  }
  if (existing.status === 'cancelled') {
    throw new Error('Cannot modify a cancelled purchase order')
  }

  const sets: string[] = []
  const values: unknown[] = []

  if (input.status !== undefined) {
    // Validate status transitions
    const allowed: Record<string, string[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['received', 'cancelled']
    }
    if (!allowed[existing.status]?.includes(input.status)) {
      throw new Error(`Cannot transition from '${existing.status}' to '${input.status}'`)
    }
    sets.push('status = ?')
    values.push(input.status)

    if (input.status === 'received') {
      sets.push('received_at = CURRENT_TIMESTAMP')
    }
  }

  if (input.notes !== undefined) {
    sets.push('notes = ?')
    values.push(input.notes)
  }

  if (sets.length === 0) return getPurchaseOrderDetail(input.id)! as PurchaseOrder

  sets.push('updated_at = CURRENT_TIMESTAMP')
  values.push(input.id)

  db.prepare(`UPDATE purchase_orders SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(input.id) as PurchaseOrder
  const items = db
    .prepare('SELECT COUNT(*) AS cnt FROM purchase_order_items WHERE po_id = ?')
    .get(input.id) as { cnt: number }
  return { ...po, item_count: items.cnt }
}

export function receivePurchaseOrderItem(input: ReceivePurchaseOrderItemInput): PurchaseOrderItem {
  const db = getDb()
  const device = getDeviceConfig()

  const item = db.prepare('SELECT * FROM purchase_order_items WHERE id = ?').get(input.id) as
    | PurchaseOrderItem
    | undefined
  if (!item) throw new Error('Purchase order item not found')

  const po = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(item.po_id) as
    | { status: string }
    | undefined
  if (!po) throw new Error('Purchase order not found')
  if (po.status !== 'submitted') {
    throw new Error('Can only receive items on submitted orders')
  }

  if (input.quantity_received < 0) {
    throw new Error('Received quantity must be greater than or equal to 0')
  }

  const previousReceived = item.quantity_received

  if (input.quantity_received < previousReceived) {
    throw new Error('Received quantity cannot be reduced once recorded')
  }

  db.prepare(
    `UPDATE purchase_order_items
     SET quantity_received = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(input.quantity_received, input.id)

  const newlyReceived = input.quantity_received - previousReceived
  if (newlyReceived > 0) {
    db.prepare(
      `UPDATE products
       SET
         in_stock = COALESCE(in_stock, quantity, 0) + ?,
         quantity = COALESCE(quantity, in_stock, 0) + ?
       WHERE id = ?`
    ).run(newlyReceived, newlyReceived, item.product_id)

    createCostLayer({
      productId: item.product_id,
      quantity: newlyReceived,
      costPerUnit: item.unit_cost,
      source: 'receiving',
      sourceReference: `po-item-${item.id}`,
      deviceId: device?.device_id ?? null
    })

    syncInventoryDelta({
      productId: item.product_id,
      delta: newlyReceived,
      reason: 'receiving',
      referenceId: `po-item-${item.id}`,
      deviceId: device?.device_id ?? null
    })
  }

  reconcilePurchaseOrderStatus(item.po_id)

  return db
    .prepare('SELECT * FROM purchase_order_items WHERE id = ?')
    .get(input.id) as PurchaseOrderItem
}

export function updatePurchaseOrderItems(
  input: UpdatePurchaseOrderItemsInput
): PurchaseOrderDetail {
  const db = getDb()
  const device = getDeviceConfig()

  const po = db.prepare('SELECT id, status FROM purchase_orders WHERE id = ?').get(input.po_id) as
    | { id: number; status: string }
    | undefined
  if (!po) throw new Error('Purchase order not found')
  if (po.status === 'draft') throw new Error('Can only edit submitted or received orders')
  if (po.status === 'cancelled') throw new Error('Cannot edit a cancelled purchase order')

  const updateItemsTx = db.transaction(() => {
    for (const line of input.lines) {
      const current = db
        .prepare('SELECT * FROM purchase_order_items WHERE id = ? AND po_id = ?')
        .get(line.id, input.po_id) as PurchaseOrderItem | undefined

      if (!current) {
        throw new Error(`Purchase order item ${line.id} not found`)
      }

      const nextUnitCost = line.unit_cost ?? current.unit_cost
      const nextOrdered = line.quantity_ordered ?? current.quantity_ordered
      const nextReceived = line.quantity_received ?? current.quantity_received

      if (!Number.isFinite(nextUnitCost) || nextUnitCost < 0) {
        throw new Error('Unit cost must be greater than or equal to 0')
      }
      if (!Number.isInteger(nextOrdered) || nextOrdered <= 0) {
        throw new Error('Quantity ordered must be a positive integer')
      }
      if (!Number.isInteger(nextReceived) || nextReceived < 0) {
        throw new Error('Quantity received must be greater than or equal to 0')
      }

      db.prepare(
        `UPDATE purchase_order_items
         SET unit_cost = ?,
             quantity_ordered = ?,
             quantity_received = ?,
             line_total = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(nextUnitCost, nextOrdered, nextReceived, nextUnitCost * nextOrdered, current.id)

      if (nextUnitCost !== current.unit_cost && current.quantity_received > 0) {
        // Only rewrite cost on layers that have not yet been consumed by
        // sales. Editing cost on a partially/fully consumed layer would
        // retroactively shift historical COGS and is not safe.
        const layer = db
          .prepare(
            `SELECT id, quantity_received, quantity_remaining
             FROM product_cost_layers
             WHERE product_id = ? AND source_reference = ?`
          )
          .get(current.product_id, `po-item-${current.id}`) as
          | { id: number; quantity_received: number; quantity_remaining: number }
          | undefined

        if (layer) {
          if (layer.quantity_remaining < layer.quantity_received) {
            throw new Error(
              'Cannot change unit cost — cost layer has already been consumed by sales'
            )
          }
          db.prepare(`UPDATE product_cost_layers SET cost_per_unit = ? WHERE id = ?`).run(
            nextUnitCost,
            layer.id
          )
        }
      }

      const delta = nextReceived - current.quantity_received
      if (delta === 0) continue

      db.prepare(
        `UPDATE products
         SET
           in_stock = COALESCE(in_stock, quantity, 0) + ?,
           quantity = COALESCE(quantity, in_stock, 0) + ?
         WHERE id = ?`
      ).run(delta, delta, current.product_id)

      if (delta > 0) {
        createCostLayer({
          productId: current.product_id,
          quantity: delta,
          costPerUnit: nextUnitCost,
          source: 'receiving',
          sourceReference: `po-item-${current.id}`,
          deviceId: device?.device_id ?? null
        })
      } else {
        consumeCostLayersForSale({
          productId: current.product_id,
          quantity: Math.abs(delta),
          fallbackUnitCost: nextUnitCost
        })
      }

      syncInventoryDelta({
        productId: current.product_id,
        delta,
        reason: 'receiving_correction',
        referenceId: `po-item-${current.id}-correction-${Date.now()}`,
        deviceId: device?.device_id ?? null
      })
    }

    recalcTotals(input.po_id)
    reconcilePurchaseOrderStatus(input.po_id)
  })

  updateItemsTx()
  return getPurchaseOrderDetail(input.po_id)!
}

export function markPurchaseOrderFullyReceived(poId: number): PurchaseOrderDetail {
  const detail = getPurchaseOrderDetail(poId)
  if (!detail) throw new Error('Purchase order not found')
  if (detail.status === 'draft') throw new Error('Can only mark submitted or received orders')
  if (detail.status === 'cancelled')
    throw new Error('Cannot mark a cancelled purchase order as received')

  const outstandingLines = detail.items
    .filter((item) => item.quantity_received !== item.quantity_ordered)
    .map((item) => ({ id: item.id, quantity_received: item.quantity_ordered }))

  if (outstandingLines.length === 0) {
    reconcilePurchaseOrderStatus(poId)
    return getPurchaseOrderDetail(poId)!
  }

  return updatePurchaseOrderItems({
    po_id: poId,
    lines: outstandingLines
  })
}

export function addPurchaseOrderItem(
  poId: number,
  productId: number,
  quantityOrdered: number
): PurchaseOrderItem {
  const db = getDb()

  const po = db.prepare('SELECT id, status FROM purchase_orders WHERE id = ?').get(poId) as
    | { id: number; status: string }
    | undefined
  if (!po) throw new Error('Purchase order not found')
  if (po.status !== 'draft') throw new Error('Can only add items to draft orders')

  const product = db
    .prepare('SELECT id, sku, name, cost FROM products WHERE id = ?')
    .get(productId) as { id: number; sku: string; name: string; cost: number | null } | undefined
  if (!product) throw new Error('Product not found')

  if (quantityOrdered <= 0) throw new Error('Quantity must be greater than 0')

  const unitCost = product.cost ?? 0
  const lineTotal = unitCost * quantityOrdered

  const result = db
    .prepare(
      `INSERT INTO purchase_order_items (po_id, product_id, sku, product_name, unit_cost, quantity_ordered, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(poId, product.id, product.sku, product.name, unitCost, quantityOrdered, lineTotal)

  recalcTotals(poId)

  return db
    .prepare('SELECT * FROM purchase_order_items WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as PurchaseOrderItem
}

export function removePurchaseOrderItem(poId: number, itemId: number): void {
  const db = getDb()

  const po = db.prepare('SELECT id, status FROM purchase_orders WHERE id = ?').get(poId) as
    | { id: number; status: string }
    | undefined
  if (!po) throw new Error('Purchase order not found')
  if (po.status !== 'draft') throw new Error('Can only remove items from draft orders')

  db.prepare('DELETE FROM purchase_order_items WHERE id = ? AND po_id = ?').run(itemId, poId)
  recalcTotals(poId)
}

export function deletePurchaseOrder(poId: number): void {
  const db = getDb()

  const po = db.prepare('SELECT id, status FROM purchase_orders WHERE id = ?').get(poId) as
    | { id: number; status: string }
    | undefined
  if (!po) throw new Error('Purchase order not found')
  if (po.status !== 'draft' && po.status !== 'cancelled') {
    throw new Error('Can only delete draft or cancelled orders')
  }

  db.transaction(() => {
    db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(poId)
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId)
  })()
}
