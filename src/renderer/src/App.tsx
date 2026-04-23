import { useEffect } from 'react'
import { POSScreen } from './pages/POSScreen'
import { AuthScreen } from './pages/AuthScreen'
import { SetPasswordScreen } from './pages/SetPasswordScreen'
import { PinSetupScreen } from './pages/PinSetupScreen'
import { PinResetScreen } from './pages/PinResetScreen'
import { BusinessSetupScreen } from './pages/BusinessSetupScreen'
import { DistributorOnboardingScreen } from './pages/DistributorOnboardingScreen'
import { LoginScreen } from './pages/LoginScreen'
import { SyncProgressModal } from './components/common/SyncProgressModal'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore } from './store/useThemeStore'
import { scoped } from './lib/logger'

const log = scoped('renderer')
const deepLinkLog = scoped('deep-link')

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
  const completeSyncAndContinue = useAuthStore((s) => s.completeSyncAndContinue)
  const isDevBrowser = useIsDevBrowser()
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!window.api) return

    const onError = (event: ErrorEvent): void => {
      log.error(
        `unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
        event.error
      )
      void window.api?.trackEvent({
        type: 'error',
        name: 'renderer_unhandled_error',
        payload: {
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        },
        sampleRate: 1
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const reason =
        event.reason instanceof Error ? event.reason.message : String(event.reason ?? '')
      log.error(`unhandled rejection: ${reason}`, event.reason)
      void window.api?.trackEvent({
        type: 'error',
        name: 'renderer_unhandled_rejection',
        payload: {
          message: reason
        },
        sampleRate: 1
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    if (typeof window.api?.trackEvent !== 'function') return
    void window.api.trackEvent({
      type: 'behavior',
      name: 'auth_app_state_changed',
      payload: { app_state: appState },
      sampleRate: 0.3
    })
  }, [appState])

  useEffect(() => {
    if (isDevBrowser || !window.api) return

    // Register push listener for deep links that arrive while the app is fully running.
    window.api.onDeepLink(({ accessToken, refreshToken }) => {
      deepLinkLog.info('push received, calling handleInviteLink')
      handleInviteLink(accessToken, refreshToken)
    })

    // Check for a buffered deep-link URL BEFORE running normal init.
    window.api.consumePendingDeepLink().then((url) => {
      deepLinkLog.info(`consumePendingDeepLink result: ${url ? 'URL found' : 'null'}`)
      if (url) {
        const hash = url.split('#')[1] ?? ''
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          deepLinkLog.info('pull path: calling handleInviteLink')
          handleInviteLink(accessToken, refreshToken)
          return
        }
        // Error URL (e.g. expired invite link) — show sign-in with a clear message
        const errorDescription = params.get('error_description')
        if (errorDescription) {
          useAuthStore.setState({
            appState: 'auth',
            error: decodeURIComponent(errorDescription.replace(/\+/g, ' '))
          })
          return
        }
      }
      initialize()
    })
  }, [initialize, handleInviteLink, isDevBrowser])

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
    case 'syncing-initial':
      return (
        <SyncProgressModal
          onComplete={() => void completeSyncAndContinue()}
          onContinueOffline={() => void completeSyncAndContinue()}
        />
      )
    case 'pin-setup':
      return <PinSetupScreen />
    case 'pin-reset':
      return <PinResetScreen />
    case 'business-setup':
      return <BusinessSetupScreen />
    case 'distributor-onboarding':
      return <DistributorOnboardingScreen />
    case 'login':
      return <LoginScreen />
    case 'pos':
      return <POSScreen />
  }
}

export default App
