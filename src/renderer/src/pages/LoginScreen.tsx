import { useCallback, useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { PIN_LENGTH } from '../../../shared/constants'
import type { Cashier } from '../types/pos'
import '../styles/auth.css'

// ── PIN Pad Component ──

function PinPad({
  onDigit,
  onBackspace,
  onClear,
  disabled
}: {
  onDigit: (d: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled: boolean
}): React.JSX.Element {
  return (
    <div className="pin-pad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <button key={n} className="pin-key" onClick={() => onDigit(String(n))} disabled={disabled}>
          {n}
        </button>
      ))}
      <button className="pin-key pin-key--clear" onClick={onClear} disabled={disabled}>
        Clear
      </button>
      <button className="pin-key" onClick={() => onDigit('0')} disabled={disabled}>
        0
      </button>
      <button
        className="pin-key pin-key--backspace"
        onClick={onBackspace}
        disabled={disabled}
        aria-label="Backspace"
      >
        ⌫
      </button>
    </div>
  )
}

// ── PIN Dots ──

function PinDots({
  length,
  filled,
  shake
}: {
  length: number
  filled: number
  shake: boolean
}): React.JSX.Element {
  return (
    <div className={`pin-dots${shake ? ' pin-shake' : ''}`}>
      {Array.from({ length }, (_, i) => (
        <div key={i} className={`pin-dot${i < filled ? ' filled' : ''}`} />
      ))}
    </div>
  )
}

// ── First Cashier Setup ──

function CashierSetup({ onCreated }: { onCreated: (cashier: Cashier) => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setError(null)

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (pin.length !== PIN_LENGTH) {
      setError(`PIN must be ${PIN_LENGTH} digits`)
      return
    }
    if (!/^\d+$/.test(pin)) {
      setError('PIN must contain only digits')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setIsSubmitting(true)
    try {
      const cashier = await window.api!.createCashier({
        name: name.trim(),
        pin,
        role: 'admin'
      })
      onCreated(cashier)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cashier')
    } finally {
      setIsSubmitting(false)
    }
  }, [name, pin, confirmPin, onCreated])

  return (
    <>
      <h2 className="auth-title">Set Up Admin Cashier</h2>
      <p className="auth-description">
        Create the first cashier account. This will be an admin who can manage other cashiers.
      </p>

      <div className="auth-form">
        <div className="auth-setup-form">
          <div className="auth-input-group">
            <label htmlFor="cashier-name" className="auth-label">
              Name
            </label>
            <input
              id="cashier-name"
              type="text"
              className="auth-input"
              placeholder="Cashier name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="cashier-pin" className="auth-label">
              PIN ({PIN_LENGTH} digits)
            </label>
            <input
              id="cashier-pin"
              type="password"
              className="auth-input"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
                setPin(v)
              }}
              disabled={isSubmitting}
              maxLength={PIN_LENGTH}
              inputMode="numeric"
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="cashier-pin-confirm" className="auth-label">
              Confirm PIN
            </label>
            <input
              id="cashier-pin-confirm"
              type="password"
              className="auth-input"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
                setConfirmPin(v)
              }}
              disabled={isSubmitting}
              maxLength={PIN_LENGTH}
              inputMode="numeric"
            />
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Admin'}
        </button>
      </div>
    </>
  )
}

// ── Login Screen (Main) ──

export function LoginScreen(): React.JSX.Element {
  const merchantConfig = useAuthStore((s) => s.merchantConfig)
  const error = useAuthStore((s) => s.error)
  const lockoutUntil = useAuthStore((s) => s.lockoutUntil)
  const login = useAuthStore((s) => s.login)
  const clearError = useAuthStore((s) => s.clearError)
  const signOutForPinReset = useAuthStore((s) => s.signOutForPinReset)

  const [cashiers, setCashiers] = useState<Cashier[] | null>(null)
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const pinSubmittedRef = useRef(false)

  // Load cashiers on mount
  useEffect(() => {
    window
      .api!.getCashiers()
      .then(setCashiers)
      .catch(() => setCashiers([]))
  }, [])

  // Lockout countdown timer
  useEffect(() => {
    const tick = (): void => {
      if (!lockoutUntil) {
        setLockoutSeconds(0)
        return
      }
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
      setLockoutSeconds(remaining)
    }

    // Schedule initial tick asynchronously to avoid synchronous setState in effect body
    const initialTimeout = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [lockoutUntil])

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !pinSubmittedRef.current) {
      pinSubmittedRef.current = true
      login(pin).then((success) => {
        if (!success) {
          setShake(true)
          setTimeout(() => {
            setShake(false)
            setPin('')
            pinSubmittedRef.current = false
          }, 500)
        }
      })
    }
  }, [pin, login])

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_LENGTH) return
      if (error) clearError()
      setPin((prev) => prev + digit)
    },
    [pin.length, error, clearError]
  )

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    if (error) clearError()
  }, [error, clearError])

  const handleClear = useCallback(() => {
    setPin('')
    pinSubmittedRef.current = false
    if (error) clearError()
  }, [error, clearError])

  // Handle keyboard input for PIN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (cashiers !== null && cashiers.length === 0) return // setup mode
      if (lockoutSeconds > 0) return

      if (/^\d$/.test(e.key)) {
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape') {
        handleClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cashiers, lockoutSeconds, handleDigit, handleBackspace, handleClear])

  const handleCashierCreated = useCallback(
    (cashier: Cashier) => {
      setCashiers([cashier])
      // Auto-login with the new admin's PIN
      login(pin || '').catch(() => {})
      // Reset PIN so they can enter it on the pad
      setPin('')
      pinSubmittedRef.current = false
    },
    [login, pin]
  )

  const isLockedOut = lockoutSeconds > 0

  // Loading state while fetching cashiers
  if (cashiers === null) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <h1 className="auth-brand">High Spirits POS</h1>
          </div>
          <p className="auth-description">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
          {merchantConfig && (
            <div className="auth-merchant-badge">
              <span className="auth-merchant-name">{merchantConfig.merchant_name}</span>
            </div>
          )}
        </div>

        {cashiers.length === 0 ? (
          <CashierSetup onCreated={handleCashierCreated} />
        ) : (
          <>
            <h2 className="auth-title">Enter PIN</h2>

            {isLockedOut && (
              <div className="auth-lockout">
                <div className="auth-lockout-timer">{lockoutSeconds}s</div>
                <div className="auth-lockout-text">Too many failed attempts</div>
              </div>
            )}

            <PinDots length={PIN_LENGTH} filled={pin.length} shake={shake} />

            <div className="auth-pin-error-slot">
              {error && !isLockedOut && <div className="auth-error">{error}</div>}
            </div>

            <PinPad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onClear={handleClear}
              disabled={isLockedOut}
            />

            <button type="button" className="auth-forgot-pin" onClick={() => signOutForPinReset()}>
              Forgot PIN? Sign in with email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
