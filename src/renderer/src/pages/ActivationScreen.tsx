import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import '../styles/auth.css'

export function ActivationScreen(): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const error = useAuthStore((s) => s.error)
  const activate = useAuthStore((s) => s.activate)
  const clearError = useAuthStore((s) => s.clearError)

  const handleActivate = useCallback(async () => {
    if (!apiKey.trim() || isLoading) return
    setIsLoading(true)
    try {
      await activate(apiKey.trim())
    } finally {
      setIsLoading(false)
    }
  }, [apiKey, isLoading, activate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleActivate()
      }
    },
    [handleActivate]
  )

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
          <p className="auth-subtitle">Powered by Stax Payments</p>
        </div>

        <h2 className="auth-title">Activate Your POS</h2>
        <p className="auth-description">
          Enter the Stax API key provided by your administrator to activate this terminal.
        </p>

        <div className="auth-form">
          <div className="auth-input-group">
            <label htmlFor="api-key-input" className="auth-label">
              Stax API Key
            </label>
            <div className="auth-input-wrapper">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                className="auth-input"
                placeholder="Enter your Stax API key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  if (error) clearError()
                }}
                onKeyDown={handleKeyDown}
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                className="auth-toggle-btn"
                onClick={() => setShowKey(!showKey)}
                aria-label="Toggle key visibility"
              >
                {showKey ? '🔒' : '👁️'}
              </button>
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            className="auth-submit-btn"
            onClick={handleActivate}
            disabled={!apiKey.trim() || isLoading}
          >
            {isLoading ? 'Validating...' : 'Activate'}
          </button>
        </div>

        <p className="auth-help">
          Don&apos;t have an API key? Contact your administrator for activation credentials.
        </p>
      </div>
    </div>
  )
}
