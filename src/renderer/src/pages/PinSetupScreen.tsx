import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { PIN_LENGTH } from '../../../shared/constants'
import { stripIpcPrefix } from '../utils/ipc-error'
import { PasswordInput } from '../components/common/PasswordInput'
import '../styles/auth.css'

type PinSection = {
  name: string
  pin: string
  confirmPin: string
}

const EMPTY_SECTION: PinSection = { name: '', pin: '', confirmPin: '' }

export function PinSetupScreen(): React.JSX.Element {
  const [admin, setAdmin] = useState<PinSection>(EMPTY_SECTION)
  const [cashier, setCashier] = useState<PinSection>(EMPTY_SECTION)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const completeSetup = useAuthStore((s) => s.completeSetup)

  const handlePinInput = (value: string): string => value.replace(/\D/g, '').slice(0, PIN_LENGTH)

  const handleSubmit = useCallback(async () => {
    const validate = (): string | null => {
      if (!admin.name.trim()) return 'Admin name is required'
      if (admin.pin.length !== PIN_LENGTH) return `Admin PIN must be ${PIN_LENGTH} digits`
      if (admin.pin !== admin.confirmPin) return 'Admin PINs do not match'
      if (!cashier.name.trim()) return 'Cashier name is required'
      if (cashier.pin.length !== PIN_LENGTH) return `Cashier PIN must be ${PIN_LENGTH} digits`
      if (cashier.pin !== cashier.confirmPin) return 'Cashier PINs do not match'
      if (admin.pin === cashier.pin) return 'Admin and cashier PINs must be different'
      return null
    }

    setError(null)
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      await window.api!.createCashier({ name: admin.name.trim(), pin: admin.pin, role: 'admin' })
      await window.api!.createCashier({
        name: cashier.name.trim(),
        pin: cashier.pin,
        role: 'cashier'
      })
      await completeSetup()
    } catch (err) {
      setError(err instanceof Error ? stripIpcPrefix(err.message) : 'Failed to create accounts')
    } finally {
      setIsSubmitting(false)
    }
  }, [admin, cashier, completeSetup])

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
        </div>

        <h2 className="auth-title">Set Up Accounts</h2>
        <p className="auth-description">
          Create an admin account and one cashier account to get started.
        </p>

        <div className="auth-form">
          {/* Admin section */}
          <p className="auth-label" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Admin Account
          </p>
          <div className="auth-setup-form" style={{ marginBottom: '1.5rem' }}>
            <div className="auth-input-group">
              <label htmlFor="admin-name" className="auth-label">
                Name
              </label>
              <input
                id="admin-name"
                type="text"
                className="auth-input"
                placeholder="Admin name"
                value={admin.name}
                onChange={(e) => setAdmin((p) => ({ ...p, name: e.target.value }))}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <div className="auth-input-group">
              <label htmlFor="admin-pin" className="auth-label">
                PIN ({PIN_LENGTH} digits)
              </label>
              <PasswordInput
                id="admin-pin"
                placeholder="4-digit PIN"
                value={admin.pin}
                onChange={(e) => setAdmin((p) => ({ ...p, pin: handlePinInput(e.target.value) }))}
                disabled={isSubmitting}
                maxLength={PIN_LENGTH}
                inputMode="numeric"
              />
            </div>
            <div className="auth-input-group">
              <label htmlFor="admin-pin-confirm" className="auth-label">
                Confirm PIN
              </label>
              <PasswordInput
                id="admin-pin-confirm"
                placeholder="Confirm PIN"
                value={admin.confirmPin}
                onChange={(e) =>
                  setAdmin((p) => ({ ...p, confirmPin: handlePinInput(e.target.value) }))
                }
                disabled={isSubmitting}
                maxLength={PIN_LENGTH}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Cashier section */}
          <p className="auth-label" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Cashier Account
          </p>
          <div className="auth-setup-form" style={{ marginBottom: '1rem' }}>
            <div className="auth-input-group">
              <label htmlFor="cashier-name" className="auth-label">
                Name
              </label>
              <input
                id="cashier-name"
                type="text"
                className="auth-input"
                placeholder="Cashier name"
                value={cashier.name}
                onChange={(e) => setCashier((p) => ({ ...p, name: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
            <div className="auth-input-group">
              <label htmlFor="cashier-pin" className="auth-label">
                PIN ({PIN_LENGTH} digits)
              </label>
              <PasswordInput
                id="cashier-pin"
                placeholder="4-digit PIN"
                value={cashier.pin}
                onChange={(e) => setCashier((p) => ({ ...p, pin: handlePinInput(e.target.value) }))}
                disabled={isSubmitting}
                maxLength={PIN_LENGTH}
                inputMode="numeric"
              />
            </div>
            <div className="auth-input-group">
              <label htmlFor="cashier-pin-confirm" className="auth-label">
                Confirm PIN
              </label>
              <PasswordInput
                id="cashier-pin-confirm"
                placeholder="Confirm PIN"
                value={cashier.confirmPin}
                onChange={(e) =>
                  setCashier((p) => ({ ...p, confirmPin: handlePinInput(e.target.value) }))
                }
                disabled={isSubmitting}
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
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating accounts...' : 'Create Accounts'}
          </button>
        </div>
      </div>
    </div>
  )
}
