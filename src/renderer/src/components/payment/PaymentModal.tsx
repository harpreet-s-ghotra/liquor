import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaymentEntry, PaymentMethod, PaymentResult, PaymentStatus } from '../../types/pos'
import type { TerminalChargeInput } from '../../../../shared/types'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

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
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-[color-mix(in_srgb,var(--bg-shell)_60%,transparent)] backdrop-blur-sm p-3"
      data-testid="payment-modal"
    >
      <div
        className="grid w-[min(60rem,100%)] h-[min(90vh,50rem)] gap-3 rounded-(--radius) bg-(--bg-panel) p-3 shadow-lg"
        style={{ gridTemplateRows: 'auto auto 1fr' }}
        role="dialog"
        aria-modal="true"
        aria-label="Payment"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="m-0 text-2xl font-bold text-(--text-primary)">
            {isRefund ? 'Process Refund' : 'Payment'}
          </h3>
          <Button
            variant="danger"
            size="sm"
            className="px-5 min-h-11 text-lg"
            onClick={handleCancel}
            disabled={status === 'processing-card'}
          >
            Cancel
          </Button>
        </div>

        {/* Transaction total */}
        <div
          className={cn(
            'payment-total-bar flex items-center justify-between rounded-(--radius) px-4 py-3 text-[1.375rem] font-bold',
            !isRefund && 'bg-(--totals-bg) text-(--totals-text)'
          )}
          style={
            isRefund ? { background: 'var(--semantic-danger-text)', color: '#fff' } : undefined
          }
        >
          <span>{isRefund ? 'Refund Amount' : 'Transaction Total'}</span>
          <strong className="text-[2rem]">
            {isRefund ? `($${Math.abs(total).toFixed(2)})` : `$${total.toFixed(2)}`}
          </strong>
        </div>

        {/* Main body: left = methods & info, right = paid-so-far log */}
        <div
          className="grid min-h-0 gap-3 overflow-hidden"
          style={{ gridTemplateColumns: '1fr 18rem' }}
        >
          <div
            className="grid min-h-0 gap-3 overflow-hidden"
            style={{ gridTemplateRows: 'auto auto 1fr' }}
          >
            {/* Quick payment buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="rounded-(--radius) border-none min-h-18 text-[1.375rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-cash-bg) text-(--pay-cash-text) disabled:opacity-55 disabled:cursor-not-allowed"
                onClick={handleCashExact}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Cash (Exact)
              </button>
              <button
                type="button"
                className="rounded-(--radius) border-none min-h-18 text-[1.375rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-credit-bg) text-(--pay-credit-text) disabled:opacity-55 disabled:cursor-not-allowed"
                onClick={() => handleCardPayment('credit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Credit
              </button>
              <button
                type="button"
                className="rounded-(--radius) border-none min-h-18 text-[1.375rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-debit-bg) text-(--pay-debit-text) disabled:opacity-55 disabled:cursor-not-allowed"
                onClick={() => handleCardPayment('debit')}
                disabled={status === 'processing-card' || status === 'complete' || remaining <= 0}
              >
                Debit
              </button>
            </div>

            {/* Status area */}
            <div className="flex items-center gap-3 rounded-(--radius) bg-(--bg-surface-soft) px-4 py-2.5 text-xl font-semibold text-(--text-primary) min-h-12">
              {/* Card error */}
              {cardError && status !== 'processing-card' && (
                <div className="text-sm font-semibold text-(--error)" data-testid="card-error">
                  <span>{cardError}</span>
                  <div className="flex gap-2 mt-1">
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
                <div
                  className="flex items-center gap-2 text-(--accent-blue)"
                  data-testid="payment-processing"
                >
                  <span className="inline-block w-4.5 h-[1.125rem] border-[3px] border-(--accent-blue) border-t-transparent rounded-full animate-spin" />
                  Waiting for card machine...
                </div>
              )}
              {status === 'complete' && (
                <div
                  className="flex items-center justify-between gap-4 w-full font-bold text-(--semantic-success-text)"
                  data-testid="payment-complete"
                >
                  <span>
                    {isRefund
                      ? `Refund of $${Math.abs(total).toFixed(2)} processed!`
                      : `Payment complete!${change > 0 ? ` Change: $${change.toFixed(2)}` : ''}`}
                  </span>
                  <Button
                    variant="success"
                    className="px-8 min-h-11 text-xl whitespace-nowrap"
                    data-testid="payment-ok-btn"
                    onClick={handleOk}
                  >
                    OK
                  </Button>
                </div>
              )}
              {(status === 'idle' || status === 'collecting') && remaining > 0 && !cardError && (
                <div data-testid="payment-remaining">
                  Remaining: <strong className="text-2xl">${remaining.toFixed(2)}</strong>
                </div>
              )}
              {(status === 'idle' || status === 'collecting') && isFullyPaid && change > 0 && (
                <div className="text-(--semantic-success-text)" data-testid="payment-change">
                  Change Due: <strong className="text-2xl">${change.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Tender denomination buttons */}
            <div className="grid gap-2 content-start overflow-auto">
              <span className="text-base font-bold text-(--text-primary) py-1">Tenders</span>
              <div className="grid grid-cols-4 gap-2">
                {TENDER_DENOMINATIONS.map((denomination) => (
                  <Button
                    key={denomination}
                    className="min-h-16 text-[1.375rem] font-bold"
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
          <div
            className="grid min-h-0 overflow-hidden rounded-(--radius) bg-(--bg-shell) shadow-(--shadow-sm)"
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            <div className="flex items-center justify-between rounded-t-(--radius) border-b border-(--border-soft) bg-(--totals-bg) px-3 py-2.5 text-lg font-bold text-(--totals-text)">
              <span>Paid So Far</span>
              <strong className="text-[1.375rem]">${paidSoFar.toFixed(2)}</strong>
            </div>
            <div
              className="grid gap-1.5 content-start overflow-auto p-2"
              data-testid="paid-so-far-list"
            >
              {payments.length === 0 ? (
                <div className="p-2 text-[0.9375rem] text-(--text-muted-on-dark)">
                  No payments yet
                </div>
              ) : (
                payments.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'paid-entry rounded-(--radius) border-none px-2.5 py-2 text-base font-semibold',
                      entry.method === 'cash' && 'bg-(--pay-cash-bg) text-(--pay-cash-text)',
                      entry.method === 'credit' && 'bg-(--pay-credit-bg) text-(--pay-credit-text)',
                      entry.method === 'debit' && 'bg-(--pay-debit-bg) text-(--pay-debit-text)'
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
