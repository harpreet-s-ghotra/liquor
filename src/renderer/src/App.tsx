import { useEffect } from 'react'
import { POSScreen } from './pages/POSScreen'
import { ActivationScreen } from './pages/ActivationScreen'
import { LoginScreen } from './pages/LoginScreen'
import { useAuthStore } from './store/useAuthStore'

/**
 * When running in the browser (not Electron), skip auth and go straight to POS.
 * Launch with: cd src/renderer && npx vite --open
 */
function useIsDevBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.api === 'undefined' && import.meta.env.DEV
}

function App(): React.JSX.Element {
  const appState = useAuthStore((s) => s.appState)
  const initialize = useAuthStore((s) => s.initialize)
  const isDevBrowser = useIsDevBrowser()

  useEffect(() => {
    if (isDevBrowser) return // skip backend-dependent init
    initialize()
  }, [initialize, isDevBrowser])

  // In dev-browser mode, render POS directly (no backend needed for UI work)
  if (isDevBrowser) {
    return <POSScreen />
  }

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
