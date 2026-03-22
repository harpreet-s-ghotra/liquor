import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from './connection'
import { applySchema } from './schema'
import {
  clearAllHeldTransactions,
  deleteHeldTransaction,
  getHeldTransactions,
  saveHeldTransaction
} from './held-transactions.repo'
import type { HeldCartItem, SaveHeldTransactionInput } from '../../shared/types'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

const sampleCart: HeldCartItem[] = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Test Wine',
    category: 'Wine',
    price: 15.99,
    basePrice: 15.99,
    quantity: 10,
    tax_rate: 0.08,
    lineQuantity: 2,
    itemDiscountPercent: 0
  }
]

const baseInput: SaveHeldTransactionInput = {
  cart: sampleCart,
  transactionDiscountPercent: 0,
  subtotal: 31.98,
  total: 34.54
}

describe('held-transactions repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  it('saves a held transaction and returns hold_number = 1', () => {
    const held = saveHeldTransaction(baseInput)

    expect(held.id).toBeGreaterThan(0)
    expect(held.hold_number).toBe(1)
    expect(held.subtotal).toBe(31.98)
    expect(held.total).toBe(34.54)
    expect(held.item_count).toBe(2)
    expect(held.transaction_discount_percent).toBe(0)
    expect(held.held_at).toBeTruthy()
  })

  it('assigns sequential hold_numbers', () => {
    const first = saveHeldTransaction(baseInput)
    const second = saveHeldTransaction({ ...baseInput, total: 99.99 })

    expect(first.hold_number).toBe(1)
    expect(second.hold_number).toBe(2)
  })

  it('cart_snapshot round-trips as valid JSON', () => {
    const held = saveHeldTransaction(baseInput)
    const parsed = JSON.parse(held.cart_snapshot) as HeldCartItem[]

    expect(parsed).toHaveLength(1)
    expect(parsed[0].sku).toBe('WINE-001')
    expect(parsed[0].lineQuantity).toBe(2)
  })

  it('getHeldTransactions returns all holds ordered by hold_number ASC', () => {
    saveHeldTransaction(baseInput)
    saveHeldTransaction({ ...baseInput, total: 50 })
    saveHeldTransaction({ ...baseInput, total: 75 })

    const holds = getHeldTransactions()
    expect(holds).toHaveLength(3)
    expect(holds[0].hold_number).toBe(1)
    expect(holds[1].hold_number).toBe(2)
    expect(holds[2].hold_number).toBe(3)
  })

  it('getHeldTransactions returns empty array when no holds', () => {
    expect(getHeldTransactions()).toEqual([])
  })

  it('deleteHeldTransaction removes the row', () => {
    const held = saveHeldTransaction(baseInput)
    deleteHeldTransaction(held.id)
    expect(getHeldTransactions()).toHaveLength(0)
  })

  it('hold_number is based on MAX so after deleting the last hold it reuses lower numbers', () => {
    const first = saveHeldTransaction(baseInput)
    const second = saveHeldTransaction(baseInput)
    // Delete hold #2; MAX is now 1, so next hold gets hold_number 2 again
    deleteHeldTransaction(second.id)

    const third = saveHeldTransaction(baseInput)
    expect(first.hold_number).toBe(1)
    expect(third.hold_number).toBe(2)
  })

  it('stores transaction_discount_percent correctly', () => {
    const held = saveHeldTransaction({ ...baseInput, transactionDiscountPercent: 10 })
    expect(held.transaction_discount_percent).toBe(10)
  })

  it('item_count sums lineQuantity across all cart items', () => {
    const multiCart: HeldCartItem[] = [
      { ...sampleCart[0], lineQuantity: 3 },
      { ...sampleCart[0], id: 2, sku: 'BEER-001', lineQuantity: 5 }
    ]
    const held = saveHeldTransaction({ ...baseInput, cart: multiCart })
    expect(held.item_count).toBe(8)
  })

  it('clearAllHeldTransactions removes all rows', () => {
    saveHeldTransaction(baseInput)
    saveHeldTransaction({ ...baseInput, total: 50 })
    saveHeldTransaction({ ...baseInput, total: 75 })

    expect(getHeldTransactions()).toHaveLength(3)
    clearAllHeldTransactions()
    expect(getHeldTransactions()).toHaveLength(0)
  })

  it('clearAllHeldTransactions is safe when table is empty', () => {
    clearAllHeldTransactions()
    expect(getHeldTransactions()).toHaveLength(0)
  })
})
