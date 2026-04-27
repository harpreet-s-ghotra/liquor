import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaymentEntry, PaymentMethod, PaymentResult, PaymentStatus } from '../../types/pos'
import type { FinixCardInput } from '../../../../shared/types'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { AppModalHeader } from '../common/AppModalHeader'
import { PaymentIcon } from '../common/modal-icons'
import './payment-modal.css'

/** Preset test cards for sandbox testing (Finix sandbox accepts these). */
const TEST_CARDS: Record<'credit' | 'debit', FinixCardInput> = {
  credit: {
    total: 0,
    person_name: 'Test Customer',
    card_number: '4111111111111111',
    card_exp: '0128',
    card_cvv: '123'
  },
  debit: {
    total: 0,
    person_name: 'Test Customer',
    card_number: '5200820000007201',
    card_exp: '0128',
    card_cvv: '123'
  }
}

type PaymentModalProps = {
  isOpen: boolean
  total: number
  initialMethod?: PaymentMethod
  onComplete: (result: PaymentResult) => void
  onCancel: () => void
  onStatusChange?: (status: PaymentStatus) => void
  /** Fired when the cashier picks a method inside the modal. Lets the cashier
   *  screen + customer display reflect the surcharged total before the charge
   *  finishes. */
  onActiveMethodChange?: (method: PaymentMethod | null) => void
  isRefund?: boolean
  /** Optional surcharge applied only to the card-paid portion of the cart. */
  cardSurcharge?: { enabled: boolean; percent: number }
}

const TENDER_DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100]

/** Map raw backend / terminal errors to user-friendly messages. */
function friendlyCardError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('no terminal devices found') || lower.includes('pair a card reader'))
    return 'Card reader not connected. Please check your terminal and try again.'
  if (lower.includes('terminal timed out') || lower.includes('no response'))
    return 'No response from the card reader. Please try again.'
  if (lower.includes('connection refused') || lower.includes('network'))
    return 'Unable to reach the card terminal. Please check your connection.'
  if (lower.includes('card declined') || lower.includes('declined'))
    return 'Card declined. Please try a different card or payment method.'
  // Keep short/already-friendly messages as-is; wrap unknown ones
  if (raw.length > 60) return 'Payment failed. Please try again or use another payment method.'
  return raw
}

export function PaymentModal({
  isOpen,
  total,
  initialMethod,
  onComplete,
  onCancel,
  onStatusChange,
  onActiveMethodChange,
  isRefund,
  cardSurcharge
}: PaymentModalProps): React.JSX.Element | null {
  const surchargeActive =
    !!cardSurcharge && cardSurcharge.enabled && cardSurcharge.percent > 0 && !isRefund
  const surchargePercent = surchargeActive ? (cardSurcharge?.percent ?? 0) : 0
  const surchargeMultiplier = 1 + surchargePercent / 100
  const nextPaymentIdRef = useRef(1)
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const paymentsRef = useRef<PaymentEntry[]>([])
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [cardError, setCardError] = useState('')
  const [activeMethod, setActiveMethod] = useState<PaymentMethod | null>(null)
  const paymentResultRef = useRef<PaymentResult>({ method: 'cash' })

  // Sum of money actually moved (cash + surcharged-card amounts).
  const paidSoFar = useMemo(
    () => payments.reduce((sum, entry) => sum + entry.amount, 0),
    [payments]
  )

  // Sum of base coverage (excludes surcharge). Compare this against `total` for
  // remaining / completion to avoid the surcharge being mistaken for change.
  const basePaid = useMemo(
    () => payments.reduce((sum, entry) => sum + (entry.amount - (entry.surcharge_amount ?? 0)), 0),
    [payments]
  )

  const remaining = useMemo(() => Math.max(total - basePaid, 0), [total, basePaid])
  const change = useMemo(() => (basePaid > total ? basePaid - total : 0), [basePaid, total])
  const isFullyPaid = basePaid + 0.005 >= total && total > 0

  // What the big total bar shows. When the active charge is a card payment
  // with a surcharge, display the inflated total so the customer sees the
  // amount they will actually be charged.
  const showCardTotal = surchargeActive && (activeMethod === 'credit' || activeMethod === 'debit')
  const displayedTotal = showCardTotal ? total * surchargeMultiplier : total
  const displayedFee = showCardTotal ? displayedTotal - total : 0

  // Notify parents whenever the chosen method changes so the cashier screen and
  // customer display can update their totals immediately.
  useEffect(() => {
    onActiveMethodChange?.(activeMethod)
  }, [activeMethod, onActiveMethodChange])

  const resetState = useCallback(() => {
    setPayments([])
    paymentsRef.current = []
    setStatus('idle')
    setCardError('')
    setActiveMethod(null)
    paymentResultRef.current = { method: 'cash' }
    nextPaymentIdRef.current = 1
  }, [])

  const handleCancel = useCallback(() => {
    resetState()
    onCancel()
  }, [onCancel, resetState])

  const handleOk = useCallback(() => {
    const result = {
      ...paymentResultRef.current,
      shouldPrint: false,
      payments: paymentsRef.current
    }
    resetState()
    onComplete(result)
  }, [onComplete, resetState])

  const finishTransaction = useCallback(
    (shouldOpenRegister: boolean, result?: PaymentResult) => {
      if (result) {
        paymentResultRef.current = result
      }
      setStatus('complete')
      if (shouldOpenRegister) {
        window.api?.openCashDrawer?.()?.catch((err: unknown) => {
          console.error('Cash drawer failed to open:', err)
        })
      }
      // TODO: Integrate with receipt printer hardware
      onStatusChange?.('complete')
    },
    [onStatusChange]
  )

  const addTender = useCallback(
    (amount: number) => {
      if (status === 'processing-card' || status === 'complete') return
      setCardError('')
      setActiveMethod('cash')

      const entry: PaymentEntry = {
        id: nextPaymentIdRef.current++,
        method: 'cash',
        amount,
        label: `$${amount.toFixed(2)} Cash`
      }

      const newPayments = [...payments, entry]
      setPayments(newPayments)
      paymentsRef.current = newPayments

      const newTotal = newPayments.reduce((sum, e) => sum + e.amount, 0)
      if (newTotal >= total) {
        finishTransaction(true, { method: 'cash' })
      }
    },
    [payments, total, status, finishTransaction]
  )

  const handleCashExact = useCallback(() => {
    if (status === 'processing-card' || status === 'complete') return
    setCardError('')
    setActiveMethod('cash')

    const cashAmount = remaining
    if (cashAmount <= 0) return

    const entry: PaymentEntry = {
      id: nextPaymentIdRef.current++,
      method: 'cash',
      amount: cashAmount,
      label: `$${cashAmount.toFixed(2)} Cash (Exact)`
    }

    setPayments((prev) => {
      const updated = [...prev, entry]
      paymentsRef.current = updated
      return updated
    })
    finishTransaction(true, { method: 'cash' })
  }, [remaining, status, finishTransaction])

  /** Charge via Finix: uses test cards in sandbox, real card entry in production. */
  const handleCardPayment = useCallback(
    async (method: 'credit' | 'debit') => {
      if (status === 'processing-card' || status === 'complete') return
      const baseCardAmount = remaining
      if (baseCardAmount <= 0) return

      setCardError('')
      setActiveMethod(method)
      setStatus('processing-card')
      onStatusChange?.('processing-card')

      // Apply surcharge to the card-paid portion only.
      const cardAmount = Math.round(baseCardAmount * surchargeMultiplier * 100) / 100
      const surchargeAmount = Math.round((cardAmount - baseCardAmount) * 100) / 100

      try {
        const chargedTotal = cardAmount
        const api = window.api
        if (!api) {
          throw new Error('Payment API unavailable')
        }

        // Phase A: manual card entry via Finix (test cards for sandbox)
        const result = await api.finixChargeCard({
          ...TEST_CARDS[method],
          total: chargedTotal
        })

        if (!result.success) {
          setCardError(friendlyCardError(result.message || 'Card declined'))
          setStatus('collecting')
          setActiveMethod(null)
          return
        }

        const surchargeNote =
          surchargeAmount > 0 ? ` (incl. $${surchargeAmount.toFixed(2)} fee)` : ''
        const entry: PaymentEntry = {
          id: nextPaymentIdRef.current++,
          method,
          amount: cardAmount,
          surcharge_amount: surchargeAmount > 0 ? surchargeAmount : undefined,
          label: `$${cardAmount.toFixed(2)} ${method === 'credit' ? 'Credit' : 'Debit'}${surchargeNote} (${result.card_type} ****${result.last_four})`,
          card_last_four: result.last_four ?? null,
          card_type: result.card_type ?? null,
          finix_authorization_id: result.authorization_id ?? null,
          finix_transfer_id: result.transfer_id ?? null
        }

        setPayments((prev) => {
          const updated = [...prev, entry]
          paymentsRef.current = updated

          // Use base coverage so surcharge can't be mistaken for an overpayment.
          const baseCovered = updated.reduce(
            (sum, e) => sum + (e.amount - (e.surcharge_amount ?? 0)),
            0
          )

          if (baseCovered + 0.005 >= total) {
            paymentResultRef.current = {
              method,
              finix_authorization_id: result.authorization_id,
              finix_transfer_id: result.transfer_id,
              card_last_four: result.last_four,
              card_type: result.card_type
            }
            setStatus('complete')
            onStatusChange?.('complete')
          } else {
            setStatus('collecting')
          }

          return updated
        })
      } catch (err) {
        setCardError(friendlyCardError(err instanceof Error ? err.message : 'Payment failed'))
        setStatus('collecting')
        setActiveMethod(null)
      }
    },
    [remaining, total, status, onStatusChange, surchargeMultiplier]
  )

  // Close on ESC — only when not mid-card-processing to avoid cancelling an in-flight charge.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (status === 'processing-card') return
      e.preventDefault()
      handleCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, status, handleCancel])

  // Auto-trigger payment when modal opens with an initialMethod
  const autoTriggeredRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      autoTriggeredRef.current = false
      return
    }
    if (!initialMethod || autoTriggeredRef.current || status !== 'idle') return
    autoTriggeredRef.current = true

    // Defer to avoid synchronous setState inside effect body
    const id = setTimeout(() => {
      if (isRefund) {
        // For refunds, complete immediately without tender collection
        finishTransaction(initialMethod === 'cash', { method: initialMethod })
      } else if (initialMethod === 'cash') {
        handleCashExact()
      } else if (initialMethod === 'credit' || initialMethod === 'debit') {
        handleCardPayment(initialMethod)
      }
    }, 0)
    return (): void => clearTimeout(id)
  }, [
    isOpen,
    initialMethod,
    status,
    handleCashExact,
    handleCardPayment,
    isRefund,
    finishTransaction
  ])

  if (!isOpen) {
    return null
  }

  return (
    <div className="payment-modal__overlay" data-testid="payment-modal">
      <div className="payment-modal__dialog" role="dialog" aria-modal="true" aria-label="Payment">
        <AppModalHeader
          icon={<PaymentIcon />}
          label="POS"
          title={isRefund ? 'Process Refund' : 'Payment'}
          onClose={handleCancel}
          closeLabel="Cancel"
          closeDisabled={status === 'processing-card'}
        />

        {/* Transaction total */}
        <div
          className={cn(
            'payment-total-bar',
            'payment-modal__total-bar',
            isRefund && 'payment-modal__total-bar--refund',
            showCardTotal && 'payment-modal__total-bar--card'
          )}
          data-testid="payment-total-bar"
        >
          <div className="payment-modal__total-lines">
            <span>
              {isRefund
                ? 'Refund Amount'
                : showCardTotal
                  ? `${activeMethod === 'credit' ? 'Credit' : 'Debit'} Total`
                  : 'Transaction Total'}
            </span>
            {showCardTotal ? (
              <span className="payment-modal__total-fee" data-testid="payment-surcharge-fee">
                Includes {surchargePercent}% card fee · ${displayedFee.toFixed(2)}
              </span>
            ) : surchargeActive ? (
              <span
                className="payment-modal__total-fee payment-modal__total-fee--hint"
                data-testid="payment-surcharge-note"
              >
                Credit/debit add {surchargePercent}% surcharge
              </span>
            ) : null}
          </div>
          <strong className="payment-modal__total-value">
            {isRefund ? `($${Math.abs(total).toFixed(2)})` : `$${displayedTotal.toFixed(2)}`}
          </strong>
        </div>

        {/* Main body: left = methods & info, right = paid-so-far log */}
        <div className="payment-modal__body">
          <div className="payment-modal__methods">
            {/* Quick payment buttons */}
            <div className="payment-modal__method-row">
              <button
                type="button"
                className="payment-modal__method-btn payment-modal__method-btn--cash"
                onClick={handleCashExact}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Cash (Exact)
              </button>
              <button
                type="button"
                className="payment-modal__method-btn payment-modal__method-btn--credit"
                aria-label="Credit"
                onClick={() => handleCardPayment('credit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Credit
              </button>
              <button
                type="button"
                className="payment-modal__method-btn payment-modal__method-btn--debit"
                aria-label="Debit"
                onClick={() => handleCardPayment('debit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Debit
              </button>
            </div>

            {/* Status area */}
            <div className="payment-modal__status">
              {/* Card error */}
              {cardError && status !== 'processing-card' && (
                <div className="payment-modal__card-error" data-testid="card-error">
                  <span>{cardError}</span>
                  <div className="payment-modal__card-error-actions">
                    <Button
                      variant="neutral"
                      size="sm"
                      data-testid="card-retry-btn"
                      onClick={() => setCardError('')}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              {status === 'processing-card' && (
                <div className="payment-modal__processing" data-testid="payment-processing">
                  <span className="payment-modal__spinner" />
                  Processing payment...
                </div>
              )}
              {status === 'complete' && (
                <div className="payment-modal__complete" data-testid="payment-complete">
                  <span>
                    {isRefund
                      ? `Refund of $${Math.abs(total).toFixed(2)} processed!`
                      : `Payment complete!${change > 0 ? ` Change: $${change.toFixed(2)}` : ''}`}
                  </span>
                  <div className="payment-modal__complete-actions">
                    <Button
                      variant="success"
                      className="payment-modal__ok-btn"
                      data-testid="payment-ok-btn"
                      onClick={handleOk}
                    >
                      OK
                    </Button>
                  </div>
                </div>
              )}
              {(status === 'idle' || status === 'collecting') && remaining > 0 && !cardError && (
                <div className="payment-modal__remaining" data-testid="payment-remaining">
                  Remaining:{' '}
                  <strong className="payment-modal__remaining-value">
                    ${remaining.toFixed(2)}
                  </strong>
                </div>
              )}
              {(status === 'idle' || status === 'collecting') && isFullyPaid && change > 0 && (
                <div className="payment-modal__change" data-testid="payment-change">
                  Change Due:{' '}
                  <strong className="payment-modal__change-value">${change.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Tender denomination buttons */}
            <div className="payment-modal__tenders">
              <span className="payment-modal__tenders-label">Tenders</span>
              <div className="payment-modal__tender-grid">
                {TENDER_DENOMINATIONS.map((denomination) => (
                  <Button
                    key={denomination}
                    className="payment-modal__tender-btn"
                    onClick={() => addTender(denomination)}
                    disabled={
                      status === 'processing-card' || status === 'complete' || remaining <= 0
                    }
                  >
                    ${denomination}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: paid-so-far log */}
          <div className="payment-modal__sidebar">
            <div className="payment-modal__sidebar-header">
              <span>Paid So Far</span>
              <strong className="payment-modal__sidebar-total">${paidSoFar.toFixed(2)}</strong>
            </div>
            <div className="payment-modal__sidebar-list" data-testid="paid-so-far-list">
              {payments.length === 0 ? (
                <div className="payment-modal__sidebar-empty">No payments yet</div>
              ) : (
                payments.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'payment-modal__paid-entry',
                      entry.method === 'cash' && 'payment-modal__paid-entry--cash',
                      entry.method === 'credit' && 'payment-modal__paid-entry--credit',
                      entry.method === 'debit' && 'payment-modal__paid-entry--debit'
                    )}
                  >
                    <span>{entry.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
