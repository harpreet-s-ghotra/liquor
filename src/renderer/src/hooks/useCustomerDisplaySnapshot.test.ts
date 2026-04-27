import { describe, expect, it } from 'vitest'
import { buildCustomerDisplaySnapshot } from './useCustomerDisplaySnapshot'
import type { CartItem } from '../types/pos'

const makeLine = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 1,
  sku: 'WINE-001',
  name: 'Cabernet',
  category: 'Wine',
  price: 15,
  basePrice: 15,
  quantity: 24,
  tax_rate: 0.05,
  lineQuantity: 2,
  itemDiscountPercent: 0,
  ...overrides
})

const baseArgs = {
  cartLines: [],
  subtotalDiscounted: 0,
  tax: 0,
  total: 0,
  isReturning: false,
  returnSubtotal: 0,
  returnTax: 0,
  returnTotal: 0,
  paymentMethod: undefined,
  activePaymentMethod: null,
  paymentStatus: 'idle' as const,
  completedPayments: [],
  cardSurcharge: { enabled: false, percent: 0 },
  storeName: 'Test Store'
}

describe('buildCustomerDisplaySnapshot', () => {
  it('projects cart lines and totals for the idle case', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [makeLine({ price: 10, lineQuantity: 2 })],
      subtotalDiscounted: 20,
      tax: 1,
      total: 21
    })
    expect(snap.cart).toHaveLength(1)
    expect(snap.cart[0]).toMatchObject({ name: 'Cabernet', quantity: 2, lineTotal: 20 })
    expect(snap.subtotal).toBe(20)
    expect(snap.tax).toBe(1)
    expect(snap.total).toBe(21)
    expect(snap.cardChargeAmount).toBeUndefined()
    expect(snap.surchargeAmount).toBeUndefined()
  })

  it('inflates the card charge when active method is credit and surcharge is on', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [makeLine({ price: 100, lineQuantity: 1 })],
      subtotalDiscounted: 100,
      tax: 0,
      total: 100,
      activePaymentMethod: 'credit',
      cardSurcharge: { enabled: true, percent: 3 }
    })
    expect(snap.cardChargeAmount).toBeCloseTo(103, 2)
    expect(snap.surchargeAmount).toBeCloseTo(3, 2)
    expect(snap.cardSurchargePercent).toBe(3)
    expect(snap.paymentMethod).toBe('credit')
  })

  it('does not surcharge when only cash method is active', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [makeLine()],
      subtotalDiscounted: 50,
      tax: 0,
      total: 50,
      activePaymentMethod: 'cash',
      cardSurcharge: { enabled: true, percent: 3 }
    })
    expect(snap.cardChargeAmount).toBeUndefined()
    expect(snap.surchargeAmount).toBeUndefined()
  })

  it('computes change due on completed cash overpay', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [makeLine()],
      subtotalDiscounted: 43,
      tax: 0,
      total: 43,
      paymentStatus: 'complete',
      completedPayments: [
        {
          id: 1,
          method: 'cash',
          amount: 50,
          label: '$50.00 Cash'
        }
      ]
    })
    expect(snap.changeDue).toBeCloseTo(7, 2)
  })

  it('uses completedSaleTotal for change-due after the cart is cleared', () => {
    // Reproduces the post-OK flow: cart cleared (total=0), but
    // completedPayments still hold the cash tender. Without the frozen
    // total, change-due would be the entire cash amount.
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [],
      subtotalDiscounted: 0,
      tax: 0,
      total: 0,
      paymentStatus: 'complete',
      completedSaleTotal: 43,
      completedPayments: [{ id: 1, method: 'cash', amount: 50, label: '$50.00 Cash' }]
    })
    expect(snap.changeDue).toBeCloseTo(7, 2)
  })

  it('omits change due when payment is not complete', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [makeLine()],
      total: 43,
      paymentStatus: 'collecting',
      completedPayments: [{ id: 1, method: 'cash', amount: 50, label: '$50.00 Cash' }]
    })
    expect(snap.changeDue).toBeUndefined()
  })

  it('omits change due on a completed card payment', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      cartLines: [makeLine()],
      total: 43,
      paymentStatus: 'complete',
      completedPayments: [
        {
          id: 1,
          method: 'credit',
          amount: 43,
          label: '$43.00 Credit'
        }
      ]
    })
    expect(snap.changeDue).toBeUndefined()
  })

  it('uses absolute return totals when refunding', () => {
    const snap = buildCustomerDisplaySnapshot({
      ...baseArgs,
      isReturning: true,
      returnSubtotal: -25,
      returnTax: -1.5,
      returnTotal: -26.5
    })
    expect(snap.subtotal).toBe(25)
    expect(snap.tax).toBe(1.5)
    expect(snap.total).toBe(26.5)
  })
})
