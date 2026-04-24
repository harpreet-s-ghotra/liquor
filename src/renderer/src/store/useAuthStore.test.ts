import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthStore, type AppState } from './useAuthStore'

// ── Mock the window.api bridge ──

const mockApi = {
  authCheckSession: vi.fn(),
  authLogin: vi.fn(),
  authLogout: vi.fn(),
  authFullSignOut: vi.fn(),
  getCashiers: vi.fn(),
  getProducts: vi.fn(),
  hasAnyProduct: vi.fn(),
  getMerchantConfig: vi.fn(),
  validatePin: vi.fn(),
  createCashier: vi.fn(),
  getActiveSession: vi.fn(),
  createSession: vi.fn()
}

const merchantConfig = {
  id: 1,
  finix_api_username: 'UStest',
  finix_api_password: 'test-password',
  merchant_id: 'MUtest',
  merchant_name: 'Test Store',
  activated_at: '2026-01-01',
  updated_at: '2026-01-01'
}

const authResult = {
  user: { id: 'user-uuid', email: 'admin@store.com' },
  merchant: merchantConfig
}

beforeEach(() => {
  useAuthStore.setState({
    appState: 'loading' as AppState,
    merchantConfig: null,
    currentCashier: null,
    loginAttempts: 0,
    lockoutUntil: null,
    error: null
  })

  Object.values(mockApi).forEach((fn) => fn.mockReset())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = mockApi

  // Default: no active session, no cashiers, no products
  mockApi.getActiveSession.mockResolvedValue(null)
  mockApi.createSession.mockResolvedValue({ id: 1, status: 'active' })
  mockApi.getMerchantConfig.mockResolvedValue(merchantConfig)
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
})

describe('useAuthStore', () => {
  describe('initialize', () => {
    it('sets appState to auth when no Supabase session exists', async () => {
      mockApi.authCheckSession.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('auth')
      expect(result.current.merchantConfig).toBeNull()
    })

    it('sets appState to syncing-initial when session exists but no cashiers', async () => {
      mockApi.authCheckSession.mockResolvedValue(authResult)
      mockApi.getCashiers.mockResolvedValue([])
      mockApi.hasAnyProduct.mockResolvedValue(false)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('syncing-initial')
      expect(result.current.merchantConfig).toEqual(merchantConfig)
    })

    it('sets appState to business-setup when cashiers exist but merchant_id is empty', async () => {
      mockApi.authCheckSession.mockResolvedValue(authResult)
      mockApi.getCashiers.mockResolvedValue([
        { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
      ])
      mockApi.getMerchantConfig.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('business-setup')
    })

    it('sets appState to distributor-onboarding when cashiers exist but no products', async () => {
      mockApi.authCheckSession.mockResolvedValue(authResult)
      mockApi.getCashiers.mockResolvedValue([
        { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
      ])
      mockApi.hasAnyProduct.mockResolvedValue(false)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('distributor-onboarding')
    })

    it('sets appState to login when session, cashiers, and products all exist', async () => {
      mockApi.authCheckSession.mockResolvedValue(authResult)
      mockApi.getCashiers.mockResolvedValue([
        { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
      ])
      mockApi.hasAnyProduct.mockResolvedValue(true)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('login')
      expect(result.current.merchantConfig).toEqual(merchantConfig)
    })

    it('sets appState to auth on error', async () => {
      mockApi.authCheckSession.mockRejectedValue(new Error('network error'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('auth')
    })
  })

  describe('emailLogin', () => {
    it('logs in and transitions to syncing-initial when no cashiers exist', async () => {
      mockApi.authLogin.mockResolvedValue(authResult)
      mockApi.getCashiers.mockResolvedValue([])
      mockApi.hasAnyProduct.mockResolvedValue(false)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.emailLogin('admin@store.com', 'pass123')
      })

      expect(mockApi.authLogin).toHaveBeenCalledWith('admin@store.com', 'pass123')
      expect(result.current.appState).toBe('syncing-initial')
      expect(result.current.merchantConfig).toEqual(merchantConfig)
      expect(result.current.error).toBeNull()
    })

    it('logs in and transitions to login when setup is complete', async () => {
      mockApi.authLogin.mockResolvedValue(authResult)
      mockApi.getCashiers.mockResolvedValue([
        { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
      ])
      mockApi.hasAnyProduct.mockResolvedValue(true)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.emailLogin('admin@store.com', 'pass123')
      })

      expect(result.current.appState).toBe('login')
    })

    it('sets error on failed sign-in', async () => {
      mockApi.authLogin.mockRejectedValue(new Error('Invalid email or password'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.emailLogin('admin@store.com', 'wrong')
      })

      expect(result.current.appState).toBe('loading')
      expect(result.current.error).toBe('Invalid email or password')
    })
  })

  describe('signOut', () => {
    it('signs out and transitions to auth', async () => {
      useAuthStore.setState({
        appState: 'login' as AppState,
        merchantConfig
      })
      mockApi.authFullSignOut.mockResolvedValue({ drained: 3, remaining: 0 })

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.signOut()
      })

      expect(mockApi.authFullSignOut).toHaveBeenCalled()
      expect(result.current.appState).toBe('auth')
      expect(result.current.merchantConfig).toBeNull()
    })
  })

  describe('completeSetup', () => {
    it('transitions to business-setup when merchant_id is empty', async () => {
      useAuthStore.setState({ appState: 'pin-setup' as AppState })
      mockApi.getMerchantConfig.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.completeSetup()
      })

      expect(result.current.appState).toBe('business-setup')
    })

    it('transitions to distributor-onboarding when no products exist', async () => {
      useAuthStore.setState({ appState: 'pin-setup' as AppState })
      mockApi.hasAnyProduct.mockResolvedValue(false)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.completeSetup()
      })

      expect(result.current.appState).toBe('distributor-onboarding')
    })

    it('transitions to login when products exist', async () => {
      useAuthStore.setState({ appState: 'pin-setup' as AppState })
      mockApi.hasAnyProduct.mockResolvedValue(true)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.completeSetup()
      })

      expect(result.current.appState).toBe('login')
    })
  })

  describe('completeBusinessSetup', () => {
    it('transitions to distributor-onboarding when no products exist', async () => {
      useAuthStore.setState({ appState: 'business-setup' as AppState })
      mockApi.hasAnyProduct.mockResolvedValue(false)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.completeBusinessSetup()
      })

      expect(result.current.appState).toBe('distributor-onboarding')
    })

    it('transitions to login when products exist', async () => {
      useAuthStore.setState({ appState: 'business-setup' as AppState })
      mockApi.hasAnyProduct.mockResolvedValue(true)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.completeBusinessSetup()
      })

      expect(result.current.appState).toBe('login')
    })

    it('falls back to distributor-onboarding on error', async () => {
      useAuthStore.setState({ appState: 'business-setup' as AppState })
      mockApi.hasAnyProduct.mockRejectedValue(new Error('fail'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.completeBusinessSetup()
      })

      expect(result.current.appState).toBe('distributor-onboarding')
    })
  })

  describe('completeOnboarding', () => {
    it('transitions to login', () => {
      useAuthStore.setState({ appState: 'distributor-onboarding' as AppState })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.completeOnboarding()
      })

      expect(result.current.appState).toBe('login')
    })
  })

  describe('login (PIN)', () => {
    it('logs in successfully with valid PIN', async () => {
      useAuthStore.setState({ appState: 'login' as AppState, merchantConfig })

      const cashier = {
        id: 1,
        name: 'Alice',
        role: 'admin' as const,
        is_active: 1,
        created_at: '2026-01-01'
      }
      mockApi.validatePin.mockResolvedValue(cashier)

      const { result } = renderHook(() => useAuthStore())

      let loginResult: boolean | undefined
      await act(async () => {
        loginResult = await result.current.login('1234')
      })

      expect(loginResult).toBe(true)
      expect(result.current.appState).toBe('pos')
      expect(result.current.currentCashier).toEqual(cashier)
      expect(result.current.loginAttempts).toBe(0)
    })

    it('increments attempts on invalid PIN', async () => {
      useAuthStore.setState({ appState: 'login' as AppState })
      mockApi.validatePin.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      let loginResult: boolean | undefined
      await act(async () => {
        loginResult = await result.current.login('0000')
      })

      expect(loginResult).toBe(false)
      expect(result.current.appState).toBe('login')
      expect(result.current.loginAttempts).toBe(1)
      expect(result.current.error).toBe('Invalid PIN')
    })

    it('allows unlimited failed attempts without locking out', async () => {
      useAuthStore.setState({ appState: 'login' as AppState, loginAttempts: 2 })
      mockApi.validatePin.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login('0000')
      })

      expect(result.current.loginAttempts).toBe(3)
      expect(result.current.lockoutUntil).toBeNull()
      expect(result.current.error).toBe('Invalid PIN')

      // Additional attempts still allowed
      await act(async () => {
        await result.current.login('0000')
      })
      expect(result.current.loginAttempts).toBe(4)
      expect(result.current.lockoutUntil).toBeNull()
    })
  })

  describe('logout', () => {
    it('clears current cashier and transitions to login', () => {
      useAuthStore.setState({
        appState: 'pos' as AppState,
        currentCashier: {
          id: 1,
          name: 'Alice',
          role: 'admin',
          is_active: 1,
          created_at: '2026-01-01'
        }
      })

      const { result } = renderHook(() => useAuthStore())

      act(() => {
        result.current.logout()
      })

      expect(result.current.appState).toBe('login')
      expect(result.current.currentCashier).toBeNull()
      expect(result.current.loginAttempts).toBe(0)
      expect(result.current.error).toBeNull()
    })
  })
})
