import { create } from 'zustand'
import type { MerchantConfig, Cashier } from '../types/pos'
import { MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MS } from '../../../shared/constants'

// ── State shape ──

export type AppState = 'loading' | 'not-activated' | 'login' | 'pos'

type AuthStoreState = {
  appState: AppState
  merchantConfig: MerchantConfig | null
  currentCashier: Cashier | null
  loginAttempts: number
  lockoutUntil: number | null
  error: string | null
}

type AuthStoreActions = {
  initialize: () => Promise<void>
  activate: (apiKey: string) => Promise<void>
  deactivate: () => Promise<void>
  login: (pin: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

type AuthStore = AuthStoreState & AuthStoreActions

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // ── Initial state ──
  appState: 'loading',
  merchantConfig: null,
  currentCashier: null,
  loginAttempts: 0,
  lockoutUntil: null,
  error: null,

  // ── Actions ──

  /**
   * Called on app start. Checks if the POS is activated and sets the right screen.
   */
  initialize: async () => {
    try {
      const config = await window.api!.getMerchantConfig()

      if (!config) {
        set({ appState: 'not-activated', merchantConfig: null })
        return
      }

      set({ appState: 'login', merchantConfig: config })
    } catch {
      set({ appState: 'not-activated', merchantConfig: null, error: null })
    }
  },

  /**
   * Validate a Stax API key, store the config, and transition to login.
   */
  activate: async (apiKey: string) => {
    try {
      set({ error: null })
      const config = await window.api!.activateMerchant(apiKey)
      set({ appState: 'login', merchantConfig: config, error: null })
    } catch (err) {
      set({
        appState: 'not-activated',
        error: err instanceof Error ? err.message : 'Activation failed'
      })
    }
  },

  /**
   * Remove the merchant config and go back to activation screen.
   */
  deactivate: async () => {
    try {
      await window.api!.deactivateMerchant()
      set({
        appState: 'not-activated',
        merchantConfig: null,
        currentCashier: null,
        loginAttempts: 0,
        lockoutUntil: null,
        error: null
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Deactivation failed' })
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
        set({
          appState: 'pos',
          currentCashier: cashier,
          loginAttempts: 0,
          lockoutUntil: null,
          error: null
        })
        return true
      }

      // Invalid PIN
      const attempts = get().loginAttempts + 1

      if (attempts >= MAX_PIN_ATTEMPTS) {
        set({
          loginAttempts: attempts,
          lockoutUntil: Date.now() + PIN_LOCKOUT_MS,
          error: 'Too many attempts. Please wait 30 seconds.'
        })
      } else {
        set({
          loginAttempts: attempts,
          error: 'Invalid PIN'
        })
      }

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
  }
}))
