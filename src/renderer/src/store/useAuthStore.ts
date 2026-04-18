import { create } from 'zustand'
import type { MerchantConfig, Cashier } from '../types/pos'
import { stripIpcPrefix } from '../utils/ipc-error'

// ── State shape ──

export type AppState =
  | 'loading'
  | 'auth'
  | 'set-password'
  | 'syncing-initial'
  | 'pin-setup'
  | 'business-setup'
  | 'distributor-onboarding'
  | 'login'
  | 'pos'

type AuthStoreState = {
  appState: AppState
  merchantConfig: MerchantConfig | null
  currentCashier: Cashier | null
  currentSessionId: number | null
  loginAttempts: number
  lockoutUntil: number | null
  error: string | null
}

type AuthStoreActions = {
  initialize: () => Promise<void>
  emailLogin: (email: string, password: string) => Promise<void>
  handleInviteLink: (accessToken: string, refreshToken: string) => Promise<void>
  setPassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  completeSetup: () => Promise<void>
  completeBusinessSetup: () => Promise<void>
  completeOnboarding: () => void
  completeSyncAndContinue: () => Promise<void>
  login: (pin: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  setCurrentSessionId: (id: number | null) => void
}

type AuthStore = AuthStoreState & AuthStoreActions

// ── Helpers ──

/**
 * Determine which post-auth state to transition to based on local data.
 * When no cashiers exist, routes to syncing-initial to wait for initial sync.
 * After sync completes, resolvePostSyncState() picks the real destination.
 */
async function resolvePostAuthState(): Promise<AppState> {
  const config = await window.api!.getMerchantConfig()
  if (!config?.merchant_id) return 'business-setup'

  const cashiers = await window.api!.getCashiers()
  if (cashiers.length === 0) return 'syncing-initial'

  const products = await window.api!.getProducts()
  if (products.length === 0) return 'distributor-onboarding'

  return 'login'
}

/**
 * Called after initial sync completes (or is skipped). Picks the appropriate
 * next state now that sync has run — cashiers may have been restored.
 */
async function resolvePostSyncState(): Promise<AppState> {
  const config = await window.api!.getMerchantConfig()
  if (!config?.merchant_id) return 'business-setup'

  const cashiers = await window.api!.getCashiers()
  if (cashiers.length === 0) return 'pin-setup'

  const products = await window.api!.getProducts()
  if (products.length === 0) return 'distributor-onboarding'

  return 'login'
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // ── Initial state ──
  appState: 'loading',
  merchantConfig: null,
  currentCashier: null,
  currentSessionId: null,
  loginAttempts: 0,
  lockoutUntil: null,
  error: null,

  // ── Actions ──

  /**
   * Called on app start. Checks for a valid Supabase session and sets the right screen.
   */
  initialize: async () => {
    try {
      const result = await window.api!.authCheckSession()

      if (!result) {
        set({ appState: 'auth', merchantConfig: null })
        return
      }

      set({ merchantConfig: result.merchant })
      const nextState = await resolvePostAuthState()
      set({ appState: nextState })
    } catch {
      set({ appState: 'auth', merchantConfig: null, error: null })
    }
  },

  /**
   * Sign in with email + password via Supabase.
   * On success, auto-transitions to the appropriate next screen.
   */
  emailLogin: async (email: string, password: string) => {
    try {
      set({ error: null })
      const result = await window.api!.authLogin(email, password)
      set({ merchantConfig: result.merchant })
      const nextState = await resolvePostAuthState()
      set({ appState: nextState })
    } catch (err) {
      set({ error: err instanceof Error ? stripIpcPrefix(err.message) : 'Sign in failed' })
    }
  },

  /**
   * Called when the app opens via a liquorpos://auth/callback deep link.
   * Exchanges the invite tokens for a live session and shows the set-password screen.
   */
  handleInviteLink: async (accessToken: string, refreshToken: string) => {
    try {
      const { email } = await window.api!.authSetSession(accessToken, refreshToken)
      set({ appState: 'set-password', error: null, merchantConfig: null })
      // Store email in error field temporarily so SetPasswordScreen can show it
      // (avoids adding a new state field just for this)
      set({ error: null })
      // Expose email via a dedicated field would be cleaner, but we keep state minimal
      // The screen can call authCheckSession if it needs the email
      void email
    } catch (err) {
      set({
        appState: 'auth',
        error: err instanceof Error ? stripIpcPrefix(err.message) : 'Invalid invite link'
      })
    }
  },

  /**
   * Set the password after accepting an email invite.
   * On success, transitions to the appropriate onboarding step.
   */
  setPassword: async (password: string) => {
    try {
      set({ error: null })
      const result = await window.api!.authSetPassword(password)
      set({ merchantConfig: result.merchant })
      const nextState = await resolvePostAuthState()
      set({ appState: nextState })
    } catch (err) {
      set({ error: err instanceof Error ? stripIpcPrefix(err.message) : 'Failed to set password' })
    }
  },

  /**
   * Sign out from Supabase and return to the auth screen.
   */
  signOut: async () => {
    try {
      await window.api!.authLogout()
      set({
        appState: 'auth',
        merchantConfig: null,
        currentCashier: null,
        loginAttempts: 0,
        lockoutUntil: null,
        error: null
      })
    } catch (err) {
      set({ error: err instanceof Error ? stripIpcPrefix(err.message) : 'Sign out failed' })
    }
  },

  /**
   * Called after PIN setup is complete. Advances to distributor-onboarding or login.
   */
  completeSetup: async () => {
    try {
      const config = await window.api!.getMerchantConfig()
      if (!config?.merchant_id) {
        set({ appState: 'business-setup' })
        return
      }
      const products = await window.api!.getProducts()
      set({ appState: products.length === 0 ? 'distributor-onboarding' : 'login' })
    } catch {
      set({ appState: 'business-setup' })
    }
  },

  /**
   * Called after business setup (Finix provisioning) is complete.
   * Advances to distributor-onboarding or login.
   */
  completeBusinessSetup: async () => {
    try {
      const products = await window.api!.getProducts()
      set({ appState: products.length === 0 ? 'distributor-onboarding' : 'login' })
    } catch {
      set({ appState: 'distributor-onboarding' })
    }
  },

  /**
   * Called after distributor onboarding (import or skip). Advances to login.
   */
  completeOnboarding: () => {
    set({ appState: 'login' })
  },

  /**
   * Called when the initial sync modal is dismissed (success or offline).
   * Re-evaluates the appropriate post-sync destination.
   */
  completeSyncAndContinue: async () => {
    try {
      const nextState = await resolvePostSyncState()
      set({ appState: nextState })
    } catch {
      set({ appState: 'pin-setup' })
    }
  },

  /**
   * Validate a cashier PIN. Returns true on success, false on failure.
   */
  login: async (pin: string) => {
    const state = get()

    // Check lockout
    if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
      return false
    }

    // Clear expired lockout
    if (state.lockoutUntil && Date.now() >= state.lockoutUntil) {
      set({ lockoutUntil: null, loginAttempts: 0, error: null })
    }

    try {
      const cashier = await window.api!.validatePin(pin)

      if (cashier) {
        // Check for or create an active session
        let sessionId: number | null = null
        try {
          let session = await window.api!.getActiveSession()
          if (!session) {
            session = await window.api!.createSession({
              cashier_id: cashier.id,
              cashier_name: cashier.name
            })
          }
          sessionId = session.id
        } catch {
          // Session management is non-critical — allow login to proceed
        }

        set({
          appState: 'pos',
          currentCashier: cashier,
          currentSessionId: sessionId,
          loginAttempts: 0,
          lockoutUntil: null,
          error: null
        })
        return true
      }

      // Invalid PIN — unlimited retries, no lockout
      set({
        loginAttempts: get().loginAttempts + 1,
        lockoutUntil: null,
        error: 'Invalid PIN'
      })

      return false
    } catch {
      set({ error: 'Failed to validate PIN' })
      return false
    }
  },

  /**
   * Log out the current cashier and return to PIN screen.
   */
  logout: () => {
    set({
      appState: 'login',
      currentCashier: null,
      loginAttempts: 0,
      lockoutUntil: null,
      error: null
    })
  },

  /**
   * Clear the current error message.
   */
  clearError: () => {
    set({ error: null })
  },

  /**
   * Update the current session ID (called after auto-creating a new session post-clock-out).
   */
  setCurrentSessionId: (id: number | null) => {
    set({ currentSessionId: id })
  }
}))
