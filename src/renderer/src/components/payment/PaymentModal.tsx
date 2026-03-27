import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaymentEntry, PaymentMethod, PaymentResult, PaymentStatus } from '../../types/pos'
import type { DirectChargeInput, TerminalChargeInput } from '../../../../shared/types'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import './payment-modal.css'

const IS_DEV = import.meta.env.DEV

/** Preset test cards used in dev mode (no physical terminal required). */
const DEV_CARDS: Record<'credit' | 'debit', DirectChargeInput> = {
  credit: {
    total: 0,
    person_name: 'Dev Test',
    card_number: '4111111111111111',
    card_exp: '1230',
    card_cvv: '123',
    card_type: 'visa'
  },
  debit: {
    total: 0,
    person_name: 'Dev Test',
    card_number: '5555555555554444',
    card_exp: '1230',
    card_cvv: '123',
    card_type: 'mastercard'
  }
}

type PaymentModalProps = {
  isOpen: boolean
  total: number
  initialMethod?: PaymentMethod
  onComplete: (result: PaymentResult) => void
  onCancel: () => void
  onStatusChange?: (status: PaymentStatus) => void
  isRefund?: boolean
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
  isRefund
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
      if (shouldOpenRegister) {
        window.api?.openCashDrawer().catch((err: unknown) => {
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

  /** Send charge to terminal (production) or use a preset test card (dev mode). */
  const handleCardPayment = useCallback(
    async (method: 'credit' | 'debit') => {
      if (status === 'processing-card' || status === 'complete') return
      const cardAmount = remaining
      if (cardAmount <= 0) return

      setCardError('')
      setStatus('processing-card')
      onStatusChange?.('processing-card')

      try {
        const chargedTotal = Math.round(cardAmount * 100) / 100
        const result = await (IS_DEV
          ? window.api!.chargeWithCard({ ...DEV_CARDS[method], total: chargedTotal })
          : window.api!.chargeTerminal({
              total: chargedTotal,
              payment_type: method,
              meta: { source: 'liquor-pos' }
            } satisfies TerminalChargeInput))

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
      if (isRefund) {
        // For refunds, complete immediately without tender collection
        finishTransaction(initialMethod === 'cash', { method: initialMethod })
      } else if (initialMethod === 'cash') {
        handleCashExact()
      } else {
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
        {/* Header */}
        <div className="payment-modal__header">
          <h3 className="payment-modal__title">{isRefund ? 'Process Refund' : 'Payment'}</h3>
          <Button
            variant="danger"
            size="sm"
            className="payment-modal__cancel-btn"
            onClick={handleCancel}
            disabled={status === 'processing-card'}
          >
            Cancel
          </Button>
        </div>

        {/* Transaction total */}
        <div
          className={cn(
            'payment-total-bar',
            'payment-modal__total-bar',
            isRefund && 'payment-modal__total-bar--refund'
          )}
        >
          <span>{isRefund ? 'Refund Amount' : 'Transaction Total'}</span>
          <strong className="payment-modal__total-value">
            {isRefund ? `($${Math.abs(total).toFixed(2)})` : `$${total.toFixed(2)}`}
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
                onClick={() => handleCardPayment('credit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Credit
                {IS_DEV && <span className="payment-modal__dev-badge">Visa TEST</span>}
              </button>
              <button
                type="button"
                className="payment-modal__method-btn payment-modal__method-btn--debit"
                onClick={() => handleCardPayment('debit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Debit
                {IS_DEV && <span className="payment-modal__dev-badge">MC TEST</span>}
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
                  {IS_DEV ? 'Processing test card...' : 'Waiting for card machine...'}
                </div>
              )}
              {status === 'complete' && (
                <div className="payment-modal__complete" data-testid="payment-complete">
                  <span>
                    {isRefund
                      ? `Refund of $${Math.abs(total).toFixed(2)} processed!`
                      : `Payment complete!${change > 0 ? ` Change: $${change.toFixed(2)}` : ''}`}
                  </span>
                  <Button
                    variant="success"
                    className="payment-modal__ok-btn"
                    data-testid="payment-ok-btn"
                    onClick={handleOk}
                  >
                    OK
                  </Button>
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
