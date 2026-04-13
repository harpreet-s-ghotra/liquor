/**
 * @deprecated Replaced by AuthScreen. Kept to avoid breaking test infrastructure.
 * App.tsx now routes 'auth' → AuthScreen, not 'not-activated' → ActivationScreen.
 */
import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import '../styles/auth.css'

export function ActivationScreen(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const error = useAuthStore((s) => s.error)
  const emailLogin = useAuthStore((s) => s.emailLogin)
  const clearError = useAuthStore((s) => s.clearError)

  const handleSignIn = useCallback(async () => {
    if (!email.trim() || !password || isLoading) return
    setIsLoading(true)
    try {
      await emailLogin(email.trim(), password)
    } finally {
      setIsLoading(false)
    }
  }, [email, password, isLoading, emailLogin])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
          <p className="auth-subtitle">Powered by Finix</p>
        </div>

        <h2 className="auth-title">Sign In</h2>

        <div className="auth-form">
          <div className="auth-input-group">
            <label htmlFor="email-input" className="auth-label">
              Email
            </label>
            <input
              id="email-input"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) clearError()
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="password-input" className="auth-label">
              Password
            </label>
            <input
              id="password-input"
              type="password"
              className="auth-input"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) clearError()
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
              disabled={isLoading}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="button"
            className="auth-submit-btn"
            onClick={handleSignIn}
            disabled={!email.trim() || !password || isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}
