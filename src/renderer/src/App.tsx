import { useEffect } from 'react'
import { POSScreen } from './pages/POSScreen'
import { AuthScreen } from './pages/AuthScreen'
import { SetPasswordScreen } from './pages/SetPasswordScreen'
import { PinSetupScreen } from './pages/PinSetupScreen'
import { DistributorOnboardingScreen } from './pages/DistributorOnboardingScreen'
import { LoginScreen } from './pages/LoginScreen'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore } from './store/useThemeStore'

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
  const handleInviteLink = useAuthStore((s) => s.handleInviteLink)
  const isDevBrowser = useIsDevBrowser()
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (isDevBrowser) return // skip backend-dependent init
    initialize()
  }, [initialize, isDevBrowser])

  // Listen for deep links (email invite / password reset)
  useEffect(() => {
    if (isDevBrowser || !window.api) return
    window.api.onDeepLink(({ accessToken, refreshToken }) => {
      handleInviteLink(accessToken, refreshToken)
    })
  }, [handleInviteLink, isDevBrowser])

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
    case 'auth':
      return <AuthScreen />
    case 'set-password':
      return <SetPasswordScreen />
    case 'pin-setup':
      return <PinSetupScreen />
    case 'distributor-onboarding':
      return <DistributorOnboardingScreen />
    case 'login':
      return <LoginScreen />
    case 'pos':
      return <POSScreen />
  }
}

export default App
