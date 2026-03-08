import { useEffect } from 'react'
import { POSScreen } from './pages/POSScreen'
import { ActivationScreen } from './pages/ActivationScreen'
import { LoginScreen } from './pages/LoginScreen'
import { useAuthStore } from './store/useAuthStore'

function App(): React.JSX.Element {
  const appState = useAuthStore((s) => s.appState)
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  switch (appState) {
    case 'loading':
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-app)',
            color: 'var(--text-muted)'
          }}
        >
          Loading...
        </div>
      )
    case 'not-activated':
      return <ActivationScreen />
    case 'login':
      return <LoginScreen />
    case 'pos':
      return <POSScreen />
  }
}

export default App
