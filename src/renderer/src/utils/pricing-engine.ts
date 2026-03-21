/**
 * Pricing Engine — pure functions for applying promotional pricing to the cart.
 *
 * Phase 1: Per-item special pricing (quantity-based group deals, e.g. "2 for $19.99")
 * Phase 2 (future): Mix-and-match group pricing
 *
 * Design principles:
 *   1. Promotions are computed at derivation time, not baked into item prices.
 *   2. Manual price overrides (price !== basePrice) skip promos.
 *   3. Cashier item-discounts (itemDiscountPercent > 0) skip promos.
 *   4. Best deal wins when multiple rules qualify.
 */

import type { CartItem, ActiveSpecialPricingRule, PromoAnnotation } from '../types/pos'

export type SpecialPricingMap = Map<number, ActiveSpecialPricingRule[]>

/**
 * Build a lookup map from the flat array returned by getActiveSpecialPricing().
 * Groups rules by product_id for O(1) lookup per cart item.
 */
export function buildSpecialPricingMap(rules: ActiveSpecialPricingRule[]): SpecialPricingMap {
  const map: SpecialPricingMap = new Map()
  for (const rule of rules) {
    const existing = map.get(rule.product_id)
    if (existing) {
      existing.push(rule)
    } else {
      map.set(rule.product_id, [rule])
    }
  }
  return map
}

/**
 * Compute the effective unit price for a group deal ("X for $Y").
 * Full groups get the deal price, remainder items stay at regular price.
 */
function computeEffectiveUnitPrice(
  rule: ActiveSpecialPricingRule,
  lineQuantity: number,
  originalPrice: number
): number {
  const groups = Math.floor(lineQuantity / rule.quantity)
  const remainder = lineQuantity % rule.quantity
  const totalPrice = groups * rule.price + remainder * originalPrice
  return totalPrice / lineQuantity
}

/**
 * Evaluate special pricing rules for a single cart item.
 * Returns a PromoAnnotation if a qualifying rule is found, otherwise null.
 */
export function evaluateSpecialPricing(
  item: CartItem,
  rules: ActiveSpecialPricingRule[]
): PromoAnnotation | null {
  // Skip if cashier manually changed the price
  if (item.basePrice !== undefined && item.price !== item.basePrice) {
    return null
  }

  // Skip if an item-level discount is already applied
  if ((item.itemDiscountPercent ?? 0) > 0) {
    return null
  }

  // Find all rules where the cart quantity meets the threshold
  const qualifying = rules.filter((rule) => item.lineQuantity >= rule.quantity)
  if (qualifying.length === 0) return null

  // Pick the rule that gives the lowest effective unit price (best deal)
  let bestRule = qualifying[0]
  let bestEffective = computeEffectiveUnitPrice(bestRule, item.lineQuantity, item.price)

  for (let i = 1; i < qualifying.length; i++) {
    const eff = computeEffectiveUnitPrice(qualifying[i], item.lineQuantity, item.price)
    if (eff < bestEffective) {
      bestRule = qualifying[i]
      bestEffective = eff
    }
  }

  // Only apply if the effective price is actually lower than the current price
  if (bestEffective >= item.price) return null

  const savings = (item.price - bestEffective) * item.lineQuantity

  const promoLabel = `${bestRule.quantity} for $${bestRule.price.toFixed(2)}`

  return {
    promoType: 'special-pricing',
    promoLabel,
    promoUnitPrice: bestEffective,
    promoLineSavings: savings,
    originalUnitPrice: item.price
  }
}

/**
 * Apply all promotional pricing to the cart.
 * Returns annotated cart items with promo metadata and total promo savings.
 */
export function applyPromotions(
  cart: CartItem[],
  specialPricingMap: SpecialPricingMap
): { items: CartItem[]; promoSavings: number } {
  let promoSavings = 0

  const items = cart.map((item) => {
    const rules = specialPricingMap.get(item.id)
    if (!rules || rules.length === 0) return item

    const promo = evaluateSpecialPricing(item, rules)
    if (!promo) return item

    promoSavings += promo.promoLineSavings
    return { ...item, promo }
  })

  return { items, promoSavings }
}
