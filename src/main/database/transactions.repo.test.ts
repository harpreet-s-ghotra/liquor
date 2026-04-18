import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, setDatabase } from './connection'
import { saveDeviceConfig } from './device-config.repo'
import { getDeltasByProduct } from './inventory-deltas.repo'
import { createCostLayer, listOpenCostLayers } from './product-cost-layers.repo'
import { saveInventoryItem } from './products.repo'
import { applySchema } from './schema'
import { createSession } from './sessions.repo'
import { getPendingItems } from './sync-queue.repo'
import {
  getProductSalesHistory,
  getRecentTransactions,
  getTransactionByNumber,
  listTransactions,
  saveRefundTransaction,
  saveTransaction
} from './transactions.repo'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

function createProduct(): number {
  const product = saveInventoryItem({
    sku: 'SYNC-TXN-001',
    item_name: 'Syncable Bottle',
    item_type: '',
    distributor_number: null,
    cost: 8,
    retail_price: 15,
    in_stock: 10,
    tax_rates: [],
    special_pricing: [],
    additional_skus: [],
    bottles_per_case: 12,
    case_discount_price: null,
    size: '',
    case_cost: null,
    nysla_discounts: null,
    brand_name: '',
    proof: null,
    alcohol_pct: null,
    vintage: '',
    ttb_id: '',
    display_name: ''
  })

  return product.item_number
}

describe('transactions sync hooks', () => {
  beforeEach(() => {
    createTestDb()
  })

  it('records sale deltas even when the device is not registered', () => {
    const productId = createProduct()

    const saved = saveTransaction({
      subtotal: 15,
      tax_amount: 0,
      total: 15,
      payment_method: 'cash',
      finix_authorization_id: 'AU-sale-1',
      finix_transfer_id: 'TR-sale-1',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 2,
          unit_price: 7.5,
          total_price: 15
        }
      ]
    })

    const deltas = getDeltasByProduct(productId)
    expect(deltas[0].delta).toBe(-2)
    expect(deltas[0].reason).toBe('sale')
    expect(deltas[0].reference_id).toBe(saved.transaction_number)
    expect(deltas[1].delta).toBe(10)
    expect(deltas[1].reason).toBe('manual_adjustment')
    expect(getPendingItems()).toEqual([])
  })

  it('enqueues transaction and inventory delta sync items for sales and refunds', () => {
    saveDeviceConfig({
      device_id: 'device-1',
      device_name: 'Register 1',
      device_fingerprint: 'fingerprint-1'
    })

    const productId = createProduct()

    const savedSale = saveTransaction({
      subtotal: 15,
      tax_amount: 0,
      total: 15,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 15,
          total_price: 15
        }
      ]
    })

    const pendingAfterSale = getPendingItems()
    expect(pendingAfterSale).toHaveLength(4)
    expect(pendingAfterSale.map((item) => item.entity_type)).toEqual([
      'product',
      'inventory_delta',
      'transaction',
      'inventory_delta'
    ])

    const savedRefund = saveRefundTransaction({
      original_transaction_id: savedSale.id,
      original_transaction_number: savedSale.transaction_number,
      subtotal: -15,
      tax_amount: 0,
      total: -15,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: -15,
          total_price: -15
        }
      ]
    })

    const deltas = getDeltasByProduct(productId)
    expect(deltas[0].delta).toBe(1)
    expect(deltas[0].reason).toBe('refund')
    expect(deltas[0].reference_id).toBe(savedRefund.transaction_number)
    expect(deltas[1].delta).toBe(-1)
    expect(deltas[1].reason).toBe('sale')

    const pending = getPendingItems()
    expect(pending.map((item) => item.entity_type)).toEqual([
      'product',
      'inventory_delta',
      'transaction',
      'inventory_delta',
      'transaction',
      'inventory_delta'
    ])
  })

  it('getRecentTransactions returns normalized transactions in descending order', () => {
    const productId = createProduct()

    const first = saveTransaction({
      subtotal: 10,
      tax_amount: 0,
      total: 10,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        }
      ]
    })
    const second = saveTransaction({
      subtotal: 15,
      tax_amount: 0,
      total: 15,
      payment_method: 'credit',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 15,
          total_price: 15
        }
      ]
    })

    getDb()
      .prepare('UPDATE transactions SET created_at = ? WHERE id = ?')
      .run('2026-01-01 00:00:00', first.id)
    getDb()
      .prepare('UPDATE transactions SET created_at = ? WHERE id = ?')
      .run('2026-01-02 00:00:00', second.id)

    expect(getRecentTransactions(1)).toEqual([
      expect.objectContaining({ id: second.id, created_at: '2026-01-02T00:00:00Z' })
    ])
  })

  it('getTransactionByNumber returns null for missing transaction and full detail for saved transaction', () => {
    expect(getTransactionByNumber('MISSING')).toBeNull()

    const productId = createProduct()
    const saved = saveTransaction({
      subtotal: 30,
      tax_amount: 0,
      total: 30,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 2,
          unit_price: 15,
          total_price: 30
        }
      ]
    })

    expect(getTransactionByNumber(saved.transaction_number)).toEqual(
      expect.objectContaining({
        id: saved.id,
        transaction_number: saved.transaction_number,
        finix_authorization_id: null,
        finix_transfer_id: null,
        items: [expect.objectContaining({ product_id: productId, quantity: 2 })]
      })
    )
  })

  it('getProductSalesHistory returns normalized rows and respects the limit', () => {
    const productId = createProduct()

    const first = saveTransaction({
      subtotal: 10,
      tax_amount: 0,
      total: 10,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        }
      ]
    })
    const second = saveTransaction({
      subtotal: 20,
      tax_amount: 0,
      total: 20,
      payment_method: 'credit',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 2,
          unit_price: 10,
          total_price: 20
        }
      ]
    })

    getDb()
      .prepare('UPDATE transactions SET created_at = ? WHERE id = ?')
      .run('2026-01-01 00:00:00', first.id)
    getDb()
      .prepare('UPDATE transactions SET created_at = ? WHERE id = ?')
      .run('2026-01-02 00:00:00', second.id)

    expect(getProductSalesHistory(productId, 1)).toEqual([
      expect.objectContaining({ transaction_id: second.id, created_at: '2026-01-02T00:00:00Z' })
    ])
  })

  it('listTransactions applies filters, search, and item counts', () => {
    const productId = createProduct()

    getDb()
      .prepare(
        "INSERT OR IGNORE INTO cashiers (id, name, pin_hash, role, is_active) VALUES (1, 'Alice', 'hash', 'cashier', 1)"
      )
      .run()
    const activeSession = createSession({ cashier_id: 1, cashier_name: 'Alice' })

    const saved = saveTransaction({
      subtotal: 25,
      tax_amount: 0,
      total: 25,
      payment_method: 'cash',
      session_id: activeSession.id,
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        },
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 15,
          total_price: 15
        }
      ]
    })

    getDb()
      .prepare('UPDATE transactions SET created_at = ? WHERE id = ?')
      .run('2026-01-03 12:00:00', saved.id)

    const filtered = listTransactions({
      status: 'completed',
      payment_method: 'cash',
      search: 'Syncable',
      date_from: '2026-01-03T00:00:00Z',
      date_to: '2026-01-03T23:59:59Z'
    })

    expect(filtered.total_count).toBe(1)
    expect(filtered.transactions).toEqual([
      expect.objectContaining({
        id: saved.id,
        item_count: 2,
        created_at: '2026-01-03T12:00:00Z'
      })
    ])
  })

  it('saveRefundTransaction restores stock and links the original transaction', () => {
    const productId = createProduct()
    const sale = saveTransaction({
      subtotal: 15,
      tax_amount: 0,
      total: 15,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 15,
          total_price: 15
        }
      ]
    })

    const refund = saveRefundTransaction({
      original_transaction_id: sale.id,
      original_transaction_number: sale.transaction_number,
      subtotal: -15,
      tax_amount: 0,
      total: -15,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: -15,
          total_price: -15
        }
      ]
    })

    const stockRow = getDb()
      .prepare('SELECT in_stock FROM products WHERE id = ?')
      .get(productId) as { in_stock: number }
    const refundRow = getDb()
      .prepare('SELECT status, original_transaction_id, notes FROM transactions WHERE id = ?')
      .get(refund.id) as { status: string; original_transaction_id: number; notes: string }

    expect(stockRow.in_stock).toBe(10)
    expect(refundRow).toEqual({
      status: 'refund',
      original_transaction_id: sale.id,
      notes: `Refund for ${sale.transaction_number}`
    })
  })

  it('records FIFO cost_at_sale and consumes oldest layers first', () => {
    const productId = createProduct()

    createCostLayer({
      productId,
      quantity: 5,
      costPerUnit: 12,
      source: 'receiving',
      sourceReference: 'test-po'
    })

    const sale = saveTransaction({
      subtotal: 180,
      tax_amount: 0,
      total: 180,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 12,
          unit_price: 15,
          total_price: 180
        }
      ]
    })

    const row = getDb()
      .prepare('SELECT cost_at_sale FROM transaction_items WHERE transaction_id = ? LIMIT 1')
      .get(sale.id) as { cost_at_sale: number }

    // 10 units from seed layer @ $8 + 2 units from new layer @ $12 = $104
    expect(row.cost_at_sale).toBeCloseTo(104, 4)

    const openLayers = listOpenCostLayers(productId)
    const totalRemaining = openLayers.reduce((sum, l) => sum + l.quantity_remaining, 0)
    expect(totalRemaining).toBe(3)
    expect(openLayers[0].cost_per_unit).toBe(12)
    expect(openLayers[0].quantity_remaining).toBe(3)
  })

  it('creates a refund cost layer using original sale average unit cost', () => {
    const productId = createProduct()

    const sale = saveTransaction({
      subtotal: 30,
      tax_amount: 0,
      total: 30,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 2,
          unit_price: 15,
          total_price: 30
        }
      ]
    })

    saveRefundTransaction({
      original_transaction_id: sale.id,
      original_transaction_number: sale.transaction_number,
      subtotal: -15,
      tax_amount: 0,
      total: -15,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: -15,
          total_price: -15
        }
      ]
    })

    const refundLayer = listOpenCostLayers(productId).find((l) => l.source === 'refund')
    expect(refundLayer).toBeDefined()
    expect(refundLayer?.quantity_received).toBe(1)
    expect(refundLayer?.quantity_remaining).toBe(1)
    expect(refundLayer?.cost_per_unit).toBeCloseTo(8, 4)
  })
})

describe('split payments', () => {
  beforeEach(() => {
    createTestDb()
  })

  it('saves payment_method as "split" when multiple tender methods', () => {
    const productId = createProduct()

    const saved = saveTransaction({
      subtotal: 10,
      tax_amount: 0,
      total: 10,
      payment_method: 'cash',
      payments: [
        { method: 'cash', amount: 2 },
        {
          method: 'credit',
          amount: 8,
          card_last_four: '4242',
          card_type: 'visa',
          finix_authorization_id: 'AU-1',
          finix_transfer_id: 'TR-1'
        }
      ],
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        }
      ]
    })

    expect(saved.payment_method).toBe('split')
  })

  it('saves payment_method as the single method when all tenders are the same', () => {
    const productId = createProduct()

    const saved = saveTransaction({
      subtotal: 10,
      tax_amount: 0,
      total: 10,
      payment_method: 'cash',
      payments: [
        { method: 'cash', amount: 5 },
        { method: 'cash', amount: 5 }
      ],
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        }
      ]
    })

    expect(saved.payment_method).toBe('cash')
  })

  it('getTransactionByNumber returns payments array for split transaction', () => {
    const productId = createProduct()

    const saved = saveTransaction({
      subtotal: 10,
      tax_amount: 0,
      total: 10,
      payment_method: 'cash',
      payments: [
        { method: 'cash', amount: 2 },
        {
          method: 'credit',
          amount: 8,
          card_last_four: '4242',
          card_type: 'visa',
          finix_authorization_id: 'AU-1',
          finix_transfer_id: 'TR-1'
        }
      ],
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        }
      ]
    })

    const detail = getTransactionByNumber(saved.transaction_number)
    expect(detail).not.toBeNull()
    expect(detail!.payments).toHaveLength(2)
    expect(detail!.payments[0].method).toBe('cash')
    expect(detail!.payments[0].amount).toBe(2)
    expect(detail!.payments[1].method).toBe('credit')
    expect(detail!.payments[1].amount).toBe(8)
    expect(detail!.payments[1].card_last_four).toBe('4242')
    expect(detail!.payments[1].card_type).toBe('visa')
    expect(detail!.payments[1].finix_authorization_id).toBe('AU-1')
  })

  it('getTransactionByNumber returns empty payments array for legacy single-method transaction', () => {
    const productId = createProduct()

    const saved = saveTransaction({
      subtotal: 10,
      tax_amount: 0,
      total: 10,
      payment_method: 'cash',
      items: [
        {
          product_id: productId,
          product_name: 'Syncable Bottle',
          quantity: 1,
          unit_price: 10,
          total_price: 10
        }
      ]
    })

    const detail = getTransactionByNumber(saved.transaction_number)
    expect(detail!.payments).toHaveLength(0)
  })
})
