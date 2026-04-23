import { useState } from 'react'
import { supabaseAuth } from '../lib/supabase'

export default function AuthGate(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    }
    // On success, App.tsx's onAuthStateChange picks up the session automatically
  }

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <div className="auth-gate__logo">
          <span className="auth-gate__logo-text">Catalog Admin</span>
          <span className="auth-gate__logo-sub">Checkoutmain &amp; Co.</span>
        </div>

        <form className="auth-gate__form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="field__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="field__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {error && <p className="auth-gate__error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-gate__note">
          This tool is for authorized Checkoutmain operators only. Local access only.
        </p>
      </div>
    </div>
  )
}
