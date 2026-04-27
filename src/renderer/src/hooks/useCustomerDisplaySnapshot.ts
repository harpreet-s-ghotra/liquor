import { useEffect } from 'react'
import type { CartLineItem, PaymentEntry, PaymentMethod, PaymentStatus } from '../types/pos'
import type { CustomerDisplaySnapshot } from '../../../shared/types'

type Args = {
  cartLines: CartLineItem[]
  subtotalDiscounted: number
  tax: number
  total: number
  isReturning: boolean
  returnSubtotal: number
  returnTax: number
  returnTotal: number
  paymentMethod: PaymentMethod | undefined
  activePaymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus
  completedPayments: PaymentEntry[]
  /** Frozen grand total at the moment payment finalized. Used to compute
   *  change-due after `clearTransaction()` has zeroed the live cart total. */
  completedSaleTotal?: number | null
  cardSurcharge: { enabled: boolean; percent: number }
  storeName?: string | null
}

/**
 * Side-effect hook that pushes a `CustomerDisplaySnapshot` to the secondary
 * window every time the cashier-side state changes. Extracted from POSScreen
 * so the snapshot shape can evolve independently and so the projection is
 * unit-testable in isolation.
 */
export function useCustomerDisplaySnapshot(args: Args): void {
  const {
    cartLines,
    subtotalDiscounted,
    tax,
    total,
    isReturning,
    returnSubtotal,
    returnTax,
    returnTotal,
    paymentMethod,
    activePaymentMethod,
    paymentStatus,
    completedPayments,
    completedSaleTotal,
    cardSurcharge,
    storeName
  } = args

  useEffect(() => {
    if (!window.api?.pushCustomerSnapshot) return
    void window.api.pushCustomerSnapshot(
      buildCustomerDisplaySnapshot({
        cartLines,
        subtotalDiscounted,
        tax,
        total,
        isReturning,
        returnSubtotal,
        returnTax,
        returnTotal,
        paymentMethod,
        activePaymentMethod,
        paymentStatus,
        completedPayments,
        completedSaleTotal,
        cardSurcharge,
        storeName: storeName ?? null
      })
    )
  }, [
    cartLines,
    subtotalDiscounted,
    tax,
    total,
    isReturning,
    returnSubtotal,
    returnTax,
    returnTotal,
    paymentMethod,
    activePaymentMethod,
    paymentStatus,
    completedPayments,
    completedSaleTotal,
    cardSurcharge,
    storeName
  ])
}

/**
 * Pure projection — exported so it can be unit-tested without rendering
 * POSScreen. Given the cashier's local state, returns the snapshot the
 * customer-facing window should render.
 */
export function buildCustomerDisplaySnapshot(args: Args): CustomerDisplaySnapshot {
  const {
    cartLines,
    subtotalDiscounted,
    tax,
    total,
    isReturning,
    returnSubtotal,
    returnTax,
    returnTotal,
    paymentMethod,
    activePaymentMethod,
    paymentStatus,
    completedPayments,
    completedSaleTotal,
    cardSurcharge,
    storeName
  } = args

  const cart = cartLines
    .filter((line) => 'lineQuantity' in line && line.lineQuantity > 0)
    .map((line) => {
      // Treat transaction-discount synthetic lines as their own row so
      // customers see why the total is lower than the sum of items.
      const quantity = 'lineQuantity' in line ? line.lineQuantity : 1
      const lineTotal =
        'lineQuantity' in line && 'price' in line ? line.price * line.lineQuantity : 0
      const unitPrice = 'lineQuantity' in line && 'price' in line ? line.price : 0
      return { id: line.id, name: line.name, quantity, unitPrice, lineTotal }
    })

  // After a sale finalizes the cashier-side cart is cleared, dropping `total`
  // to 0. Prefer the frozen post-sale total so change-due math stays correct.
  const useFrozenTotal = paymentStatus === 'complete' && !isReturning && completedSaleTotal != null
  const baseTotal = isReturning
    ? Math.abs(returnTotal)
    : useFrozenTotal
      ? completedSaleTotal
      : total
  const surchargeOn = cardSurcharge.enabled && cardSurcharge.percent > 0 && !isReturning
  const completedMethod =
    completedPayments.length > 0 ? (completedPayments.at(-1)?.method ?? null) : null
  const effectiveMethod: PaymentMethod | null =
    activePaymentMethod ?? paymentMethod ?? (completedMethod as PaymentMethod | null) ?? null
  const isCardMethod = effectiveMethod === 'credit' || effectiveMethod === 'debit'

  const cardChargeAmount =
    surchargeOn && isCardMethod
      ? Math.round(baseTotal * (1 + cardSurcharge.percent / 100) * 100) / 100
      : undefined
  const surchargeAmount =
    cardChargeAmount != null ? Math.round((cardChargeAmount - baseTotal) * 100) / 100 : undefined

  const basePaid = completedPayments.reduce(
    (sum, p) => sum + (p.amount - (p.surcharge_amount ?? 0)),
    0
  )
  const cashPaid = completedPayments
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + p.amount, 0)
  const changeDue =
    paymentStatus === 'complete' && !isReturning && cashPaid > 0
      ? Math.max(Math.round((basePaid - baseTotal) * 100) / 100, 0)
      : 0

  return {
    storeName: storeName ?? null,
    cart,
    subtotal: isReturning ? Math.abs(returnSubtotal) : subtotalDiscounted,
    tax: isReturning ? Math.abs(returnTax) : tax,
    total: baseTotal,
    cardSurchargePercent: surchargeOn ? cardSurcharge.percent : undefined,
    paymentMethod: effectiveMethod,
    cardChargeAmount,
    surchargeAmount,
    paymentStatus,
    changeDue: changeDue > 0 ? changeDue : undefined
  }
}
