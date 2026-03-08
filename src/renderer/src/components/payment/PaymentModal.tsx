import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaymentEntry, PaymentMethod, PaymentResult, PaymentStatus } from '../../types/pos'
import type { TerminalChargeInput } from '../../../../shared/types'
import './payment-modal.css'

type PaymentModalProps = {
  isOpen: boolean
  total: number
  initialMethod?: PaymentMethod
  onComplete: (result: PaymentResult) => void
  onCancel: () => void
  onStatusChange?: (status: PaymentStatus) => void
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
  onStatusChange
}: PaymentModalProps): React.JSX.Element | null {
  const nextPaymentIdRef = useRef(1)
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [cardError, setCardError] = useState('')
  const paymentResultRef = useRef<PaymentResult>({ method: 'cash' })

  const paidSoFar = useMemo(
    () => payments.reduce((sum, entry) => sum + entry.amount, 0),
    [payments]
  )

  const remaining = useMemo(() => Math.max(total - paidSoFar, 0), [total, paidSoFar])
  const change = useMemo(() => (paidSoFar > total ? paidSoFar - total : 0), [paidSoFar, total])
  const isFullyPaid = paidSoFar >= total && total > 0

  const resetState = useCallback(() => {
    setPayments([])
    setStatus('idle')
    setCardError('')
    paymentResultRef.current = { method: 'cash' }
    nextPaymentIdRef.current = 1
  }, [])

  const handleCancel = useCallback(() => {
    resetState()
    onCancel()
  }, [onCancel, resetState])

  const handleOk = useCallback(() => {
    const result = { ...paymentResultRef.current }
    resetState()
    onComplete(result)
  }, [onComplete, resetState])

  const finishTransaction = useCallback(
    (shouldOpenRegister: boolean, result?: PaymentResult) => {
      if (result) {
        paymentResultRef.current = result
      }
      setStatus('complete')
      // TODO: Integrate with cash drawer hardware
      void shouldOpenRegister
      // TODO: Integrate with receipt printer hardware
      onStatusChange?.('complete')
    },
    [onStatusChange]
  )

  const addTender = useCallback(
    (amount: number) => {
      if (status === 'processing-card' || status === 'complete') return
      setCardError('')

      const entry: PaymentEntry = {
        id: nextPaymentIdRef.current++,
        method: 'cash',
        amount,
        label: `$${amount.toFixed(2)} Cash`
      }

      const newPayments = [...payments, entry]
      setPayments(newPayments)

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

    const cashAmount = remaining
    if (cashAmount <= 0) return

    const entry: PaymentEntry = {
      id: nextPaymentIdRef.current++,
      method: 'cash',
      amount: cashAmount,
      label: `$${cashAmount.toFixed(2)} Cash (Exact)`
    }

    setPayments((prev) => [...prev, entry])
    finishTransaction(true, { method: 'cash' })
  }, [remaining, status, finishTransaction])

  /** Send charge to the physical card terminal and wait for result */
  const handleCardPayment = useCallback(
    async (method: 'credit' | 'debit') => {
      if (status === 'processing-card' || status === 'complete') return
      const cardAmount = remaining
      if (cardAmount <= 0) return

      setCardError('')
      setStatus('processing-card')
      onStatusChange?.('processing-card')

      try {
        const input: TerminalChargeInput = {
          total: Math.round(cardAmount * 100) / 100,
          payment_type: method,
          meta: { source: 'liquor-pos' }
        }

        const result = await window.api!.chargeTerminal(input)

        if (!result.success) {
          setCardError(friendlyCardError(result.message || 'Card declined'))
          setStatus('collecting')
          return
        }

        const entry: PaymentEntry = {
          id: nextPaymentIdRef.current++,
          method,
          amount: cardAmount,
          label: `$${cardAmount.toFixed(2)} ${method === 'credit' ? 'Credit' : 'Debit'} (${result.card_type} ****${result.last_four})`
        }

        setPayments((prev) => {
          const updated = [...prev, entry]
          const updatedTotal = updated.reduce((sum, e) => sum + e.amount, 0)

          if (updatedTotal >= total) {
            paymentResultRef.current = {
              method,
              stax_transaction_id: result.transaction_id,
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
      }
    },
    [remaining, total, status, onStatusChange]
  )

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
      if (initialMethod === 'cash') {
        handleCashExact()
      } else {
        handleCardPayment(initialMethod)
      }
    }, 0)
    return (): void => clearTimeout(id)
  }, [isOpen, initialMethod, status, handleCashExact, handleCardPayment])

  if (!isOpen) {
    return null
  }

  return (
    <div className="payment-modal-backdrop" data-testid="payment-modal">
      <div className="payment-modal" role="dialog" aria-modal="true" aria-label="Payment">
        {/* Header */}
        <div className="payment-header">
          <h3>Payment</h3>
          <button
            type="button"
            className="payment-close-btn"
            onClick={handleCancel}
            disabled={status === 'processing-card'}
          >
            Cancel
          </button>
        </div>

        {/* Transaction total */}
        <div className="payment-total-bar">
          <span>Transaction Total</span>
          <strong>${total.toFixed(2)}</strong>
        </div>

        {/* Main body: left = methods & info, right = paid-so-far log */}
        <div className="payment-body">
          <div className="payment-left">
            {/* Quick payment buttons */}
            <div className="payment-methods">
              <button
                type="button"
                className="payment-method-btn cash"
                onClick={handleCashExact}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Cash (Exact)
              </button>
              <button
                type="button"
                className="payment-method-btn credit"
                onClick={() => handleCardPayment('credit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Credit
              </button>
              <button
                type="button"
                className="payment-method-btn debit"
                onClick={() => handleCardPayment('debit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Debit
              </button>
            </div>

            {/* Status area */}
            <div className="payment-status-area">
              {/* Card error */}
              {cardError && status !== 'processing-card' && (
                <div className="card-entry-error" data-testid="card-error">
                  <span>{cardError}</span>
                  <div className="card-error-actions">
                    <button
                      type="button"
                      className="app-btn app-btn--neutral app-btn--sm"
                      data-testid="card-retry-btn"
                      onClick={() => setCardError('')}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {status === 'processing-card' && (
                <div className="payment-processing" data-testid="payment-processing">
                  <span className="processing-spinner" />
                  Waiting for card machine...
                </div>
              )}
              {status === 'complete' && (
                <div className="payment-complete" data-testid="payment-complete">
                  <span>Payment complete! {change > 0 && `Change: $${change.toFixed(2)}`}</span>
                  <button
                    type="button"
                    className="payment-ok-btn"
                    data-testid="payment-ok-btn"
                    onClick={handleOk}
                  >
                    OK
                  </button>
                </div>
              )}
              {(status === 'idle' || status === 'collecting') && remaining > 0 && !cardError && (
                <div className="payment-remaining" data-testid="payment-remaining">
                  Remaining: <strong>${remaining.toFixed(2)}</strong>
                </div>
              )}
              {(status === 'idle' || status === 'collecting') && isFullyPaid && change > 0 && (
                <div className="payment-change" data-testid="payment-change">
                  Change Due: <strong>${change.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Tender denomination buttons */}
            <div className="payment-tenders">
              <span className="tender-label">Tenders</span>
              <div className="tender-grid">
                {TENDER_DENOMINATIONS.map((denomination) => (
                  <button
                    key={denomination}
                    type="button"
                    className="tender-btn"
                    onClick={() => addTender(denomination)}
                    disabled={
                      status === 'processing-card' || status === 'complete' || remaining <= 0
                    }
                  >
                    ${denomination}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: paid-so-far log */}
          <div className="payment-right">
            <div className="paid-so-far-header">
              <span>Paid So Far</span>
              <strong>${paidSoFar.toFixed(2)}</strong>
            </div>
            <div className="paid-so-far-list" data-testid="paid-so-far-list">
              {payments.length === 0 ? (
                <div className="paid-so-far-empty">No payments yet</div>
              ) : (
                payments.map((entry) => (
                  <div key={entry.id} className={`paid-entry paid-entry-${entry.method}`}>
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
