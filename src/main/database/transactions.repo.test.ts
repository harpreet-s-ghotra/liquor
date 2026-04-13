import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, setDatabase } from './connection'
import { saveDeviceConfig } from './device-config.repo'
import { getDeltasByProduct } from './inventory-deltas.repo'
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
})
