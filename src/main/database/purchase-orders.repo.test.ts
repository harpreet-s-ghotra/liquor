import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, setDatabase } from './connection'
import { listOpenCostLayers } from './product-cost-layers.repo'
import { applySchema } from './schema'
import {
  getPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrderDetail,
  updatePurchaseOrder,
  receivePurchaseOrderItem,
  addPurchaseOrderItem,
  removePurchaseOrderItem,
  deletePurchaseOrder
} from './purchase-orders.repo'
import type { CreatePurchaseOrderInput } from '../../shared/types'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

function seedTestData(): void {
  const db = getDb()

  // Create test distributor
  db.prepare(
    `INSERT INTO distributors (distributor_number, distributor_name, is_active)
     VALUES (1, 'Test Distributor', 1)`
  ).run()

  // Create test products
  db.prepare(
    `INSERT INTO products (sku, name, category, price, cost, distributor_number)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('SKU001', 'Product A', 'Wine', 10.0, 5.0, 1)

  db.prepare(
    `INSERT INTO products (sku, name, category, price, cost, distributor_number)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('SKU002', 'Product B', 'Beer', 8.0, 4.0, 1)
}

describe('getPurchaseOrders', () => {
  beforeEach(() => createTestDb())

  it('returns empty array initially', () => {
    const result = getPurchaseOrders()
    expect(result).toEqual([])
  })

  it('returns created purchase orders', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ]
    }

    createPurchaseOrder(input)
    const result = getPurchaseOrders()

    expect(result).toHaveLength(1)
    expect(result[0].po_number).toMatch(/^PO-\d{4}-\d{2}-\d{4}$/)
    expect(result[0].distributor_name).toBe('Test Distributor')
    expect(result[0].status).toBe('draft')
    expect(result[0].item_count).toBe(2)
  })

  it('returns orders sorted by created_at DESC', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    }

    createPurchaseOrder(input)
    // Small delay to ensure timestamp difference
    getPurchaseOrders()

    createPurchaseOrder(input)
    const result2 = getPurchaseOrders()

    expect(result2).toHaveLength(2)
    expect(new Date(result2[0].created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(result2[1].created_at).getTime()
    )
  })
})

describe('createPurchaseOrder', () => {
  beforeEach(() => createTestDb())

  it('creates and returns PurchaseOrderDetail with items', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ],
      notes: 'Test order'
    }

    const result = createPurchaseOrder(input)

    expect(result).toBeDefined()
    expect(result.distributor_number).toBe(1)
    expect(result.distributor_name).toBe('Test Distributor')
    expect(result.status).toBe('draft')
    expect(result.notes).toBe('Test order')
    expect(result.items).toHaveLength(2)
    expect(result.subtotal).toBe(5 * 5 + 3 * 4) // (5 qty * $5 cost) + (3 qty * $4 cost)
    expect(result.total).toBe(5 * 5 + 3 * 4)
  })

  it('throws if distributor not found', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 999,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    }

    expect(() => createPurchaseOrder(input)).toThrow('Distributor not found')
  })

  it('throws if items array is empty', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: []
    }

    expect(() => createPurchaseOrder(input)).toThrow('Purchase order must have at least one item')
  })

  it('generates sequential PO numbers', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    }

    const po1 = createPurchaseOrder(input)
    const po2 = createPurchaseOrder(input)
    const po3 = createPurchaseOrder(input)

    expect(po1.po_number).toMatch(/^PO-\d{4}-\d{2}-0001$/)
    expect(po2.po_number).toMatch(/^PO-\d{4}-\d{2}-0002$/)
    expect(po3.po_number).toMatch(/^PO-\d{4}-\d{2}-0003$/)
  })

  it('throws if product not found', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [{ product_id: 999, quantity_ordered: 5 }]
    }

    expect(() => createPurchaseOrder(input)).toThrow('Product 999 not found')
  })

  it('calculates correct line totals with null cost', () => {
    const db = getDb()

    // Create distributor
    db.prepare(
      `INSERT INTO distributors (distributor_number, distributor_name, is_active)
       VALUES (1, 'Test Distributor', 1)`
    ).run()

    // Create product with null cost
    db.prepare(
      `INSERT INTO products (sku, name, category, price, cost, distributor_number)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('SKU001', 'Product A', 'Wine', 10.0, null, 1)

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    }

    const result = createPurchaseOrder(input)

    expect(result.items[0].unit_cost).toBe(0)
    expect(result.items[0].line_total).toBe(0)
    expect(result.subtotal).toBe(0)
  })
})

describe('getPurchaseOrderDetail', () => {
  beforeEach(() => createTestDb())

  it('returns null for non-existent ID', () => {
    const result = getPurchaseOrderDetail(999)
    expect(result).toBeNull()
  })

  it('returns PO with items for valid ID', () => {
    seedTestData()

    const input: CreatePurchaseOrderInput = {
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ]
    }

    const created = createPurchaseOrder(input)
    const result = getPurchaseOrderDetail(created.id)

    expect(result).toBeDefined()
    expect(result!.id).toBe(created.id)
    expect(result!.items).toHaveLength(2)
    expect(result!.items[0].sku).toBe('SKU001')
    expect(result!.items[1].sku).toBe('SKU002')
  })
})

describe('updatePurchaseOrder', () => {
  beforeEach(() => createTestDb())

  it('transitions draft to submitted', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    const result = updatePurchaseOrder({
      id: po.id,
      status: 'submitted'
    })

    expect(result.status).toBe('submitted')
    expect(result.updated_at).not.toBeNull()
  })

  it('transitions submitted to received', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })
    const result = updatePurchaseOrder({ id: po.id, status: 'received' })

    expect(result.status).toBe('received')
    expect(result.received_at).not.toBeNull()
  })

  it('throws for invalid transition draft to received', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    expect(() => updatePurchaseOrder({ id: po.id, status: 'received' })).toThrow(
      "Cannot transition from 'draft' to 'received'"
    )
  })

  it('throws when modifying a received PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })
    updatePurchaseOrder({ id: po.id, status: 'received' })

    expect(() => updatePurchaseOrder({ id: po.id, status: 'cancelled' })).toThrow(
      'Cannot modify a received purchase order'
    )
  })

  it('throws when modifying a cancelled PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'cancelled' })

    expect(() => updatePurchaseOrder({ id: po.id, status: 'submitted' })).toThrow(
      'Cannot modify a cancelled purchase order'
    )
  })

  it('updates notes on draft PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    const result = updatePurchaseOrder({
      id: po.id,
      notes: 'Updated notes'
    })

    expect(result.notes).toBe('Updated notes')
  })

  it('transitions draft to cancelled', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    const result = updatePurchaseOrder({
      id: po.id,
      status: 'cancelled'
    })

    expect(result.status).toBe('cancelled')
  })

  it('transitions submitted to cancelled', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })
    const result = updatePurchaseOrder({ id: po.id, status: 'cancelled' })

    expect(result.status).toBe('cancelled')
  })
})

describe('receivePurchaseOrderItem', () => {
  beforeEach(() => createTestDb())

  it('sets quantity_received on submitted PO item', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    const result = receivePurchaseOrderItem({
      id: po.items[0].id,
      quantity_received: 3
    })

    expect(result.quantity_received).toBe(3)
  })

  it('increments stock and creates a receiving cost layer for newly received quantity', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })
    receivePurchaseOrderItem({ id: po.items[0].id, quantity_received: 4 })

    const stock = getDb().prepare('SELECT in_stock FROM products WHERE id = 1').get() as {
      in_stock: number
    }
    expect(stock.in_stock).toBe(4)

    const layer = listOpenCostLayers(1).find((l) => l.source === 'receiving')
    expect(layer).toBeDefined()
    expect(layer?.quantity_received).toBe(4)
    expect(layer?.quantity_remaining).toBe(4)
    expect(layer?.cost_per_unit).toBe(5)
  })

  it('throws for draft PO items', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    expect(() =>
      receivePurchaseOrderItem({
        id: po.items[0].id,
        quantity_received: 3
      })
    ).toThrow('Can only receive items on submitted orders')
  })

  it('auto-marks PO as received when all items fully received', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    receivePurchaseOrderItem({ id: po.items[0].id, quantity_received: 5 })
    receivePurchaseOrderItem({ id: po.items[1].id, quantity_received: 3 })

    const result = getPurchaseOrderDetail(po.id)
    expect(result!.status).toBe('received')
    expect(result!.received_at).not.toBeNull()
  })

  it('throws if qty > quantity_ordered', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    expect(() =>
      receivePurchaseOrderItem({
        id: po.items[0].id,
        quantity_received: 10
      })
    ).toThrow('Received quantity must be between 0 and quantity ordered')
  })

  it('throws if qty is negative', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    expect(() =>
      receivePurchaseOrderItem({
        id: po.items[0].id,
        quantity_received: -1
      })
    ).toThrow('Received quantity must be between 0 and quantity ordered')
  })

  it('allows zero quantity received', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    const result = receivePurchaseOrderItem({
      id: po.items[0].id,
      quantity_received: 0
    })

    expect(result.quantity_received).toBe(0)
  })

  it('does not allow decreasing previously received quantity', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })
    receivePurchaseOrderItem({ id: po.items[0].id, quantity_received: 3 })

    expect(() =>
      receivePurchaseOrderItem({
        id: po.items[0].id,
        quantity_received: 2
      })
    ).toThrow('Received quantity cannot be reduced once recorded')
  })
})

describe('addPurchaseOrderItem', () => {
  beforeEach(() => createTestDb())

  it('adds item to draft PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    const result = addPurchaseOrderItem(po.id, 2, 10)

    expect(result.product_id).toBe(2)
    expect(result.quantity_ordered).toBe(10)
    expect(result.sku).toBe('SKU002')

    const detail = getPurchaseOrderDetail(po.id)
    expect(detail!.items).toHaveLength(2)
  })

  it('throws for submitted PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    expect(() => addPurchaseOrderItem(po.id, 2, 10)).toThrow('Can only add items to draft orders')
  })

  it('throws if product not found', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    expect(() => addPurchaseOrderItem(po.id, 999, 10)).toThrow('Product not found')
  })

  it('throws if quantity <= 0', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    expect(() => addPurchaseOrderItem(po.id, 2, 0)).toThrow('Quantity must be greater than 0')
    expect(() => addPurchaseOrderItem(po.id, 2, -5)).toThrow('Quantity must be greater than 0')
  })

  it('updates totals after adding item', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 1 }]
    })

    const beforeTotal = getPurchaseOrderDetail(po.id)!.total

    addPurchaseOrderItem(po.id, 2, 5)

    const afterTotal = getPurchaseOrderDetail(po.id)!.total

    expect(afterTotal).toBeGreaterThan(beforeTotal)
    expect(afterTotal).toBe(1 * 5 + 5 * 4) // 1 * cost of product 1 + 5 * cost of product 2
  })
})

describe('removePurchaseOrderItem', () => {
  beforeEach(() => createTestDb())

  it('removes item from draft PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ]
    })

    removePurchaseOrderItem(po.id, po.items[0].id)

    const detail = getPurchaseOrderDetail(po.id)
    expect(detail!.items).toHaveLength(1)
    expect(detail!.items[0].sku).toBe('SKU002')
  })

  it('throws for submitted PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    expect(() => removePurchaseOrderItem(po.id, po.items[0].id)).toThrow(
      'Can only remove items from draft orders'
    )
  })

  it('updates totals after removing item', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [
        { product_id: 1, quantity_ordered: 5 },
        { product_id: 2, quantity_ordered: 3 }
      ]
    })

    const beforeTotal = getPurchaseOrderDetail(po.id)!.total

    removePurchaseOrderItem(po.id, po.items[0].id)

    const afterTotal = getPurchaseOrderDetail(po.id)!.total

    expect(afterTotal).toBeLessThan(beforeTotal)
    expect(afterTotal).toBe(3 * 4) // Only product 2 remaining
  })
})

describe('deletePurchaseOrder', () => {
  beforeEach(() => createTestDb())

  it('deletes draft PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    deletePurchaseOrder(po.id)

    const detail = getPurchaseOrderDetail(po.id)
    expect(detail).toBeNull()
  })

  it('throws for submitted PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })

    expect(() => deletePurchaseOrder(po.id)).toThrow('Can only delete draft or cancelled orders')
  })

  it('throws for received PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'submitted' })
    updatePurchaseOrder({ id: po.id, status: 'received' })

    expect(() => deletePurchaseOrder(po.id)).toThrow('Can only delete draft or cancelled orders')
  })

  it('deletes cancelled PO', () => {
    seedTestData()

    const po = createPurchaseOrder({
      distributor_number: 1,
      items: [{ product_id: 1, quantity_ordered: 5 }]
    })

    updatePurchaseOrder({ id: po.id, status: 'cancelled' })
    deletePurchaseOrder(po.id)

    const detail = getPurchaseOrderDetail(po.id)
    expect(detail).toBeNull()
  })

  it('throws for non-existent PO', () => {
    expect(() => deletePurchaseOrder(999)).toThrow('Purchase order not found')
  })
})
