import { useEffect, useRef } from 'react'
import { AppModalHeader } from '../common/AppModalHeader'
import { PaymentIcon } from '../common/modal-icons'
import { AppButton } from '../common/AppButton'
import { formatCurrency } from '../../utils/currency'
import './payment-modal.css'
import './account-payment-modal.css'

type AccountPaymentModalProps = {
  isOpen: boolean
  /** Sale total (already inclusive of tax). Shown for cashier confirmation. */
  total: number
  /** Manager-configured delivery service tile names. */
  services: string[]
  /** Fired when the cashier picks a service and confirms the sale. */
  onSelect: (serviceName: string) => void
  onCancel: () => void
}

/**
 * Tile-grid modal for assigning a sale to a third-party delivery service
 * (UberEats, DoorDash, etc.). Tapping a tile finalizes the transaction with
 * payment_method='account'; no tender is collected here because the service
 * settles its account separately.
 */
export function AccountPaymentModal({
  isOpen,
  total,
  services,
  onSelect,
  onCancel
}: AccountPaymentModalProps): React.JSX.Element | null {
  // Single-fire guard prevents a fast double-tap from firing onSelect twice
  // (which would save two transactions). A ref is used instead of state so the
  // guard does not pull in a cascading effect-driven render.
  const submittingRef = useRef(false)

  useEffect(() => {
    if (isOpen) submittingRef.current = false
  }, [isOpen])

  // ESC closes the modal.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const handlePick = (name: string): void => {
    if (submittingRef.current) return
    submittingRef.current = true
    onSelect(name)
  }

  return (
    <div className="payment-modal__overlay" data-testid="account-payment-modal">
      <div
        className="payment-modal__dialog account-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Account payment"
      >
        <AppModalHeader
          icon={<PaymentIcon />}
          label="POS"
          title="Charge to Account"
          onClose={onCancel}
          closeLabel="Cancel"
        />

        <div className="payment-modal__total-bar payment-modal__total-bar--account">
          <div className="payment-modal__total-lines">
            <span>Account Total</span>
            <span className="payment-modal__total-fee payment-modal__total-fee--hint">
              No payment is collected — billed to the selected service.
            </span>
          </div>
          <strong className="payment-modal__total-value">{formatCurrency(total)}</strong>
        </div>

        <div className="account-payment-modal__body">
          {services.length === 0 ? (
            <div className="account-payment-modal__empty" data-testid="account-payment-modal-empty">
              <p>No delivery services have been configured yet.</p>
              <p className="account-payment-modal__empty-hint">
                Open Manager → Merchant Info to add UberEats, DoorDash, or any other service.
              </p>
            </div>
          ) : (
            <div
              className="account-payment-modal__tiles"
              role="list"
              data-testid="account-service-tiles"
            >
              {services.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="listitem"
                  className="account-payment-modal__tile"
                  onClick={() => handlePick(name)}
                  data-testid={`account-service-tile-${name}`}
                >
                  <span className="account-payment-modal__tile-name">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="account-payment-modal__footer">
          <AppButton variant="neutral" size="lg" onClick={onCancel}>
            Cancel
          </AppButton>
        </div>
      </div>
    </div>
  )
}
