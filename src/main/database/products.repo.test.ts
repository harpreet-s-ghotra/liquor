import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, setDatabase } from './connection'
import { applySchema } from './schema'
import {
  deleteInventoryItem,
  getInventoryProductDetail,
  getInventoryProducts,
  saveInventoryItem,
  searchInventoryProducts
} from './products.repo'
import type { SaveInventoryItemInput } from '../../shared/types'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

const base: SaveInventoryItemInput = {
  sku: 'WINE-001',
  item_name: 'Test Wine',
  dept_id: '',
  vendor_number: null,
  cost: 8,
  retail_price: 15,
  in_stock: 10,
  tax_rates: [],
  special_pricing: [],
  additional_skus: [],
  bottles_per_case: 12,
  case_discount_price: null
}

describe('saveInventoryItem', () => {
  beforeEach(() => createTestDb())

  it('inserts a new item and returns its detail', () => {
    const result = saveInventoryItem(base)

    expect(result.sku).toBe('WINE-001')
    expect(result.item_name).toBe('Test Wine')
    expect(result.retail_price).toBe(15)
    expect(result.cost).toBe(8)
    expect(result.in_stock).toBe(10)
    expect(result.item_number).toBeGreaterThan(0)
  })

  it('updates an existing item', () => {
    const created = saveInventoryItem(base)

    const updated = saveInventoryItem({
      ...base,
      item_number: created.item_number,
      item_name: 'Updated Wine',
      retail_price: 20
    })

    expect(updated.item_number).toBe(created.item_number)
    expect(updated.item_name).toBe('Updated Wine')
    expect(updated.retail_price).toBe(20)
  })

  it('throws when SKU is missing', () => {
    expect(() => saveInventoryItem({ ...base, sku: '' })).toThrow('SKU is required')
  })

  it('throws when name is missing', () => {
    expect(() => saveInventoryItem({ ...base, item_name: '' })).toThrow('Name is required')
  })

  it('throws when SKU contains invalid characters', () => {
    expect(() => saveInventoryItem({ ...base, sku: 'bad sku!' })).toThrow(
      'SKU must contain only letters, numbers, and hyphens'
    )
  })

  it('throws when creating a second item with the same active SKU', () => {
    saveInventoryItem(base)
    expect(() => saveInventoryItem({ ...base, item_name: 'Duplicate' })).toThrow(
      'SKU already exists'
    )
  })

  it('throws when cost is negative', () => {
    expect(() => saveInventoryItem({ ...base, cost: -1 })).toThrow(
      'Cost must be a non-negative number'
    )
  })

  it('throws when price is negative', () => {
    expect(() => saveInventoryItem({ ...base, retail_price: -5 })).toThrow(
      'Price must be a non-negative number'
    )
  })
})

describe('deleteInventoryItem', () => {
  beforeEach(() => createTestDb())

  it('sets is_active to 0 without deleting the row', () => {
    const item = saveInventoryItem(base)
    deleteInventoryItem(item.item_number)

    const row = getDb()
      .prepare('SELECT is_active FROM products WHERE id = ?')
      .get(item.item_number) as { is_active: number }

    expect(row.is_active).toBe(0)
  })

  it('hides the deleted item from getInventoryProducts', () => {
    const item = saveInventoryItem(base)
    saveInventoryItem({ ...base, sku: 'BEER-001', item_name: 'Beer' })

    deleteInventoryItem(item.item_number)

    const list = getInventoryProducts()
    expect(list).toHaveLength(1)
    expect(list[0].sku).toBe('BEER-001')
  })

  it('hides the deleted item from searchInventoryProducts', () => {
    const item = saveInventoryItem(base)
    deleteInventoryItem(item.item_number)

    const results = searchInventoryProducts('Wine')
    expect(results).toHaveLength(0)
  })

  it('preserves the product row so transaction history remains intact', () => {
    const item = saveInventoryItem(base)
    const db = getDb()

    db.prepare(
      `INSERT INTO transactions (transaction_number, subtotal, tax_amount, total, payment_method)
       VALUES ('TXN-001', 15, 0, 15, 'cash')`
    ).run()

    const txn = db
      .prepare(`SELECT id FROM transactions WHERE transaction_number = 'TXN-001'`)
      .get() as { id: number }

    db.prepare(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(txn.id, item.item_number, item.item_name, 1, 15, 15)

    // This would throw a foreign key violation if the row were hard-deleted
    deleteInventoryItem(item.item_number)

    const historyRow = db
      .prepare('SELECT product_id FROM transaction_items WHERE transaction_id = ?')
      .get(txn.id) as { product_id: number }

    expect(historyRow.product_id).toBe(item.item_number)
  })
})

describe('SKU reactivation on re-add', () => {
  beforeEach(() => createTestDb())

  it('reactivates an inactive item when a new item uses the same SKU', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)

    const reactivated = saveInventoryItem({ ...base, item_name: 'Wine v2', retail_price: 18 })

    expect(reactivated.item_number).toBe(original.item_number)
    expect(reactivated.item_name).toBe('Wine v2')
    expect(reactivated.retail_price).toBe(18)
  })

  it('reactivated item is_active returns to 1', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)
    saveInventoryItem({ ...base, item_name: 'Wine v2' })

    const row = getDb()
      .prepare('SELECT is_active FROM products WHERE id = ?')
      .get(original.item_number) as { is_active: number }

    expect(row.is_active).toBe(1)
  })

  it('reactivated item appears in getInventoryProducts', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)

    saveInventoryItem({ ...base, item_name: 'Wine v2' })

    const list = getInventoryProducts()
    expect(list).toHaveLength(1)
    expect(list[0].sku).toBe('WINE-001')
  })

  it('reactivated item appears in searchInventoryProducts', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)

    saveInventoryItem({ ...base, item_name: 'Wine v2' })

    const results = searchInventoryProducts('WINE')
    expect(results).toHaveLength(1)
    expect(results[0].sku).toBe('WINE-001')
  })

  it('still throws when the SKU belongs to a different active item', () => {
    saveInventoryItem(base)
    expect(() => saveInventoryItem({ ...base, item_name: 'Conflict' })).toThrow(
      'SKU already exists'
    )
  })
})

describe('getInventoryProductDetail', () => {
  beforeEach(() => createTestDb())

  it('returns null for a non-existent item', () => {
    expect(getInventoryProductDetail(9999)).toBeNull()
  })

  it('returns full detail including empty arrays for new item', () => {
    const item = saveInventoryItem(base)
    const detail = getInventoryProductDetail(item.item_number)

    expect(detail).not.toBeNull()
    expect(detail!.sku).toBe('WINE-001')
    expect(detail!.sales_history).toEqual([])
    expect(detail!.additional_skus).toEqual([])
    expect(detail!.special_pricing).toEqual([])
  })
})
