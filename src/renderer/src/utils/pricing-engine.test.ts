import { describe, it, expect } from 'vitest'
import type { CartItem, ActiveSpecialPricingRule } from '../types/pos'
import {
  buildSpecialPricingMap,
  evaluateSpecialPricing,
  applyPromotions,
  type SpecialPricingMap
} from './pricing-engine'

// ── Helpers ──

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 1,
    name: 'Test Product',
    sku: 'TEST-001',
    category: 'Test',
    price: 12.99,
    basePrice: 12.99,
    quantity: 100,
    tax_rate: 0.1,
    lineQuantity: 1,
    itemDiscountPercent: 0,
    is_active: 1,
    ...overrides
  } as CartItem
}

function makeRule(overrides: Partial<ActiveSpecialPricingRule> = {}): ActiveSpecialPricingRule {
  return {
    product_id: 1,
    quantity: 2,
    price: 19.99,
    ...overrides
  }
}

// ── buildSpecialPricingMap ──

describe('buildSpecialPricingMap', () => {
  it('returns an empty map for empty rules', () => {
    const map = buildSpecialPricingMap([])
    expect(map.size).toBe(0)
  })

  it('groups rules by product_id', () => {
    const rules: ActiveSpecialPricingRule[] = [
      makeRule({ product_id: 1, quantity: 3, price: 8.99 }),
      makeRule({ product_id: 1, quantity: 6, price: 7.99 }),
      makeRule({ product_id: 2, quantity: 2, price: 5.0 })
    ]
    const map = buildSpecialPricingMap(rules)

    expect(map.size).toBe(2)
    expect(map.get(1)).toHaveLength(2)
    expect(map.get(2)).toHaveLength(1)
  })

  it('preserves rule data', () => {
    const rule = makeRule({ product_id: 10, quantity: 5, price: 4.5 })
    const map = buildSpecialPricingMap([rule])

    expect(map.get(10)?.[0]).toEqual(rule)
  })
})

// ── evaluateSpecialPricing — group mode ("X for $Y") ──

describe('evaluateSpecialPricing (group)', () => {
  const rules = [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]

  it('applies group deal: 2 items → 2 for $19.99', () => {
    const item = makeCartItem({ price: 12.99, lineQuantity: 2 })
    const result = evaluateSpecialPricing(item, rules)

    expect(result).not.toBeNull()
    // effective unit = 19.99 / 2 = 9.995
    expect(result!.promoUnitPrice).toBeCloseTo(9.995, 2)
    expect(result!.promoLabel).toBe('2 for $19.99')
  })

  it('only discounts full groups, remainder at regular price', () => {
    const item = makeCartItem({ price: 12.99, lineQuantity: 3 })
    const result = evaluateSpecialPricing(item, rules)

    // 1 group of 2 = $19.99, 1 remainder at $12.99 = $32.98
    // effective unit = 32.98 / 3 ≈ $10.9933
    const expectedTotal = 19.99 + 12.99
    const expectedUnit = expectedTotal / 3
    expect(result).not.toBeNull()
    expect(result!.promoUnitPrice).toBeCloseTo(expectedUnit, 2)
    expect(result!.promoLineSavings).toBeCloseTo(12.99 * 3 - expectedTotal, 2)
  })

  it('applies to 4 items: 2 groups of 2', () => {
    const item = makeCartItem({ price: 12.99, lineQuantity: 4 })
    const result = evaluateSpecialPricing(item, rules)

    // 2 groups × $19.99 = $39.98, effective unit = 39.98/4 = 9.995
    expect(result!.promoUnitPrice).toBeCloseTo(9.995, 2)
    expect(result!.promoLineSavings).toBeCloseTo(12.99 * 4 - 39.98, 2)
  })

  it('applies to 5 items: 2 groups + 1 remainder', () => {
    const item = makeCartItem({ price: 12.99, lineQuantity: 5 })
    const result = evaluateSpecialPricing(item, rules)

    // 2 groups × $19.99 = $39.98 + 1 × $12.99 = $52.97
    const expectedTotal = 2 * 19.99 + 12.99
    const expectedUnit = expectedTotal / 5
    expect(result!.promoUnitPrice).toBeCloseTo(expectedUnit, 2)
    expect(result!.promoLineSavings).toBeCloseTo(12.99 * 5 - expectedTotal, 2)
  })

  it('returns null below group threshold', () => {
    const item = makeCartItem({ lineQuantity: 1 })
    expect(evaluateSpecialPricing(item, rules)).toBeNull()
  })

  it('skips when group price is not cheaper', () => {
    // Item costs $8, rule is 2 for $19.99 → $9.995 each > $8
    const item = makeCartItem({ price: 8.0, basePrice: 8.0, lineQuantity: 2 })
    expect(evaluateSpecialPricing(item, rules)).toBeNull()
  })

  it('picks best deal when multiple group rules qualify', () => {
    const multiRules = [
      makeRule({ product_id: 1, quantity: 2, price: 19.99 }),
      makeRule({ product_id: 1, quantity: 3, price: 25.99 })
    ]
    const item = makeCartItem({ price: 12.99, lineQuantity: 6 })
    const result = evaluateSpecialPricing(item, multiRules)

    // rule 1: 3 groups × $19.99 = $59.97, unit = $9.995
    // rule 2: 2 groups × $25.99 = $51.98, unit = $8.6633
    // rule 2 wins
    expect(result).not.toBeNull()
    expect(result!.promoUnitPrice).toBeCloseTo(51.98 / 6, 2)
    expect(result!.promoLabel).toBe('3 for $25.99')
  })

  it('skips when cashier manually changed the price', () => {
    const item = makeCartItem({ price: 10.0, basePrice: 12.99, lineQuantity: 2 })
    expect(evaluateSpecialPricing(item, rules)).toBeNull()
  })

  it('skips when item-level discount is applied', () => {
    const item = makeCartItem({ lineQuantity: 2, itemDiscountPercent: 10 })
    expect(evaluateSpecialPricing(item, rules)).toBeNull()
  })

  it('returns null for empty rules array', () => {
    const item = makeCartItem({ lineQuantity: 10 })
    expect(evaluateSpecialPricing(item, [])).toBeNull()
  })
})

// ── applyPromotions ──

describe('applyPromotions', () => {
  it('returns original cart when pricing map is empty', () => {
    const cart = [makeCartItem({ id: 1 }), makeCartItem({ id: 2 })]
    const empty: SpecialPricingMap = new Map()

    const { items, promoSavings } = applyPromotions(cart, empty)

    expect(items).toEqual(cart)
    expect(promoSavings).toBe(0)
  })

  it('annotates qualifying items with promo data', () => {
    const cart = [makeCartItem({ id: 1, price: 12.99, basePrice: 12.99, lineQuantity: 2 })]
    const map: SpecialPricingMap = new Map([
      [1, [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]]
    ])

    const { items, promoSavings } = applyPromotions(cart, map)

    expect(items[0].promo).toBeDefined()
    // 2 for $19.99 → unit = $9.995
    expect(items[0].promo!.promoUnitPrice).toBeCloseTo(9.995, 2)
    expect(promoSavings).toBeCloseTo(12.99 * 2 - 19.99, 2)
  })

  it('does not mutate the original cart items', () => {
    const original = makeCartItem({ id: 1, lineQuantity: 2 })
    const cart = [original]
    const map: SpecialPricingMap = new Map([
      [1, [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]]
    ])

    applyPromotions(cart, map)

    expect(original.promo).toBeUndefined()
  })

  it('leaves non-qualifying items unchanged', () => {
    const cart = [
      makeCartItem({ id: 1, lineQuantity: 2 }),
      makeCartItem({ id: 2, name: 'No Promo', lineQuantity: 1 })
    ]
    const map: SpecialPricingMap = new Map([
      [1, [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]]
    ])

    const { items } = applyPromotions(cart, map)

    expect(items[0].promo).toBeDefined()
    expect(items[1].promo).toBeUndefined()
  })

  it('accumulates savings from multiple promoted items', () => {
    const cart = [
      makeCartItem({ id: 1, price: 12.99, basePrice: 12.99, lineQuantity: 4 }),
      makeCartItem({ id: 2, price: 9.99, basePrice: 9.99, lineQuantity: 4 })
    ]
    const map: SpecialPricingMap = new Map([
      [1, [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]],
      [2, [makeRule({ product_id: 2, quantity: 2, price: 14.99 })]]
    ])

    const { promoSavings } = applyPromotions(cart, map)

    // item 1: 2 groups × $19.99 = $39.98 vs 4 × $12.99 = $51.96 → saves $11.98
    // item 2: 2 groups × $14.99 = $29.98 vs 4 × $9.99 = $39.96 → saves $9.98
    const expected = 12.99 * 4 - 39.98 + (9.99 * 4 - 29.98)
    expect(promoSavings).toBeCloseTo(expected, 2)
  })

  it('skips items with manual price override', () => {
    const cart = [makeCartItem({ id: 1, price: 10.0, basePrice: 12.99, lineQuantity: 2 })]
    const map: SpecialPricingMap = new Map([
      [1, [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]]
    ])

    const { items, promoSavings } = applyPromotions(cart, map)

    expect(items[0].promo).toBeUndefined()
    expect(promoSavings).toBe(0)
  })

  it('applies group pricing correctly through applyPromotions', () => {
    const cart = [makeCartItem({ id: 1, price: 12.99, basePrice: 12.99, lineQuantity: 3 })]
    const map: SpecialPricingMap = new Map([
      [1, [makeRule({ product_id: 1, quantity: 2, price: 19.99 })]]
    ])

    const { items, promoSavings } = applyPromotions(cart, map)

    // 1 group of 2 = $19.99, 1 remainder = $12.99, total = $32.98
    const expectedTotal = 19.99 + 12.99
    const expectedUnit = expectedTotal / 3
    expect(items[0].promo).toBeDefined()
    expect(items[0].promo!.promoUnitPrice).toBeCloseTo(expectedUnit, 2)
    expect(items[0].promo!.promoLabel).toBe('2 for $19.99')
    expect(promoSavings).toBeCloseTo(12.99 * 3 - expectedTotal, 2)
  })
})
