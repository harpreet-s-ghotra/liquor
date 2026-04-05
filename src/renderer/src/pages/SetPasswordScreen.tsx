import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import '../styles/auth.css'

export function SetPasswordScreen(): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)
  const setPassword_ = useAuthStore((s) => s.setPassword)

  const validationError =
    password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters'
      : password !== confirm && confirm.length > 0
        ? 'Passwords do not match'
        : null

  const canSubmit = password.length >= 8 && password === confirm && !isLoading

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setIsLoading(true)
    try {
      await setPassword_(password)
    } finally {
      setIsLoading(false)
    }
  }, [password, canSubmit, setPassword_])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
        </div>

        <h2 className="auth-title">Set Your Password</h2>
        <p className="auth-description">Choose a password to secure your account.</p>

        <div className="auth-form">
          <div className="auth-input-group">
            <label htmlFor="password-input" className="auth-label">
              Password
            </label>
            <input
              id="password-input"
              type="password"
              className="auth-input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) clearError()
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="confirm-input" className="auth-label">
              Confirm Password
            </label>
            <input
              id="confirm-input"
              type="password"
              className="auth-input"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={isLoading}
            />
          </div>

          {(validationError || error) && (
            <div className="auth-error">{validationError ?? error}</div>
          )}

          <button
            type="button"
            className="auth-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? 'Setting password...' : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
