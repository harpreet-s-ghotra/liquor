import { useCallback, useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { PIN_LENGTH } from '../../../shared/constants'
import { stripIpcPrefix } from '../utils/ipc-error'
import { PasswordInput } from '../components/common/PasswordInput'
import type { Cashier } from '../types/pos'
import '../styles/auth.css'

export function PinResetScreen(): React.JSX.Element {
  const completePinReset = useAuthStore((s) => s.completePinReset)
  const [adminCashier, setAdminCashier] = useState<Cashier | null>(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    window.api!.getCashiers().then((cashiers) => {
      const admin = cashiers.find((c) => c.role === 'admin') ?? cashiers[0] ?? null
      setAdminCashier(admin)
    })
  }, [])

  const handlePinInput = (value: string): string => value.replace(/\D/g, '').slice(0, PIN_LENGTH)

  const handleSubmit = useCallback(async () => {
    setError(null)
    if (pin.length !== PIN_LENGTH) {
      setError(`PIN must be ${PIN_LENGTH} digits`)
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }
    if (!adminCashier) {
      setError('No admin account found')
      return
    }

    setIsSubmitting(true)
    try {
      await window.api!.updateCashier({ id: adminCashier.id, pin })
      completePinReset()
    } catch (err) {
      setError(err instanceof Error ? stripIpcPrefix(err.message) : 'Failed to reset PIN')
    } finally {
      setIsSubmitting(false)
    }
  }, [pin, confirmPin, adminCashier, completePinReset])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
        </div>

        <h2 className="auth-title">Reset Admin PIN</h2>
        <p className="auth-description">
          {adminCashier ? `Set a new PIN for ${adminCashier.name}.` : 'Loading...'}
        </p>

        <div className="auth-form">
          <div className="auth-setup-form">
            <div className="auth-input-group">
              <label htmlFor="new-pin" className="auth-label">
                New PIN ({PIN_LENGTH} digits)
              </label>
              <PasswordInput
                id="new-pin"
                placeholder="New PIN"
                value={pin}
                onChange={(e) => setPin(handlePinInput(e.target.value))}
                disabled={isSubmitting || !adminCashier}
                maxLength={PIN_LENGTH}
                inputMode="numeric"
                autoFocus
              />
            </div>
            <div className="auth-input-group">
              <label htmlFor="confirm-new-pin" className="auth-label">
                Confirm PIN
              </label>
              <PasswordInput
                id="confirm-new-pin"
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(handlePinInput(e.target.value))}
                disabled={isSubmitting || !adminCashier}
                maxLength={PIN_LENGTH}
                inputMode="numeric"
              />
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="button"
            className="auth-submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !adminCashier}
          >
            {isSubmitting ? 'Resetting...' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  )
}
