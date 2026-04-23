import { useEffect, useState } from 'react'
import { supabaseAuth } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import AuthGate from './components/AuthGate'
import Dashboard from './components/Dashboard'

type AppPhase = 'loading' | 'login' | 'not-authorized' | 'ready'

export default function App(): React.JSX.Element {
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true

    async function checkSession(): Promise<void> {
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession()

      if (!mounted) return

      if (!session) {
        setPhase('login')
        return
      }

      const isSuperUser = session.user.app_metadata?.is_super_user === true

      if (!isSuperUser) {
        setPhase('not-authorized')
        setUser(session.user)
        return
      }

      setUser(session.user)
      setPhase('ready')
    }

    checkSession()

    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return

      if (!session) {
        setUser(null)
        setPhase('login')
        return
      }

      const isSuperUser = session.user.app_metadata?.is_super_user === true

      if (!isSuperUser) {
        setUser(session.user)
        setPhase('not-authorized')
        return
      }

      setUser(session.user)
      setPhase('ready')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut(): Promise<void> {
    await supabaseAuth.auth.signOut()
  }

  if (phase === 'loading') {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
        <p>Checking authorization…</p>
      </div>
    )
  }

  if (phase === 'login') {
    return <AuthGate />
  }

  if (phase === 'not-authorized') {
    return (
      <div className="app-unauthorized">
        <div className="app-unauthorized__card">
          <h1>Not authorized</h1>
          <p>
            Your account (<strong>{user?.email}</strong>) does not have super-user access.
          </p>
          <p className="app-unauthorized__hint">
            Set <code>app_metadata.is_super_user = true</code> for this user in Supabase.
          </p>
          <button type="button" className="btn btn--danger" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <Dashboard user={user!} onSignOut={handleSignOut} />
}
