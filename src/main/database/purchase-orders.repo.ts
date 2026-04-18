import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { getInventoryDeltaSyncPayload, recordDelta } from './inventory-deltas.repo'
import { createCostLayer } from './product-cost-layers.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderDetail,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
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
    `INSERT INTO purchase_order_items (po_id, product_id, sku, product_name, unit_cost, quantity_ordered, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
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
        .prepare('SELECT id, sku, name, cost FROM products WHERE id = ?')
        .get(item.product_id) as
        | { id: number; sku: string; name: string; cost: number | null }
        | undefined
      if (!product) throw new Error(`Product ${item.product_id} not found`)

      const unitCost = product.cost ?? 0
      const lineTotal = unitCost * item.quantity_ordered

      insertItem.run(
        poId,
        product.id,
        product.sku,
        product.name,
        unitCost,
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

  if (input.quantity_received < 0 || input.quantity_received > item.quantity_ordered) {
    throw new Error('Received quantity must be between 0 and quantity ordered')
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

    const skuRow = db
      .prepare('SELECT sku FROM products WHERE id = ? LIMIT 1')
      .get(item.product_id) as { sku: string } | undefined

    const deltaId = recordDelta({
      product_id: item.product_id,
      product_sku: skuRow?.sku ?? `UNKNOWN-${item.product_id}`,
      delta: newlyReceived,
      reason: 'receiving',
      reference_id: `po-item-${item.id}`,
      device_id: device?.device_id ?? null
    })

    const payload = getInventoryDeltaSyncPayload(deltaId)
    if (payload && device) {
      enqueueSyncItem({
        entity_type: 'inventory_delta',
        entity_id: String(deltaId),
        operation: 'INSERT',
        payload: JSON.stringify(payload),
        device_id: device.device_id
      })
    }
  }

  // Check if all items are fully received — auto-mark PO as received
  const updatedItems = db
    .prepare('SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE po_id = ?')
    .all(item.po_id) as Array<{ quantity_ordered: number; quantity_received: number }>

  const fullyReceived = updatedItems.every((i) => i.quantity_received >= i.quantity_ordered)
  if (fullyReceived) {
    db.prepare(
      `UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(item.po_id)
  }

  return db
    .prepare('SELECT * FROM purchase_order_items WHERE id = ?')
    .get(input.id) as PurchaseOrderItem
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
