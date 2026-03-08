import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthStore, type AppState } from './useAuthStore'

// ── Mock the window.api bridge ──

const mockApi = {
  getMerchantConfig: vi.fn(),
  activateMerchant: vi.fn(),
  deactivateMerchant: vi.fn(),
  getCashiers: vi.fn(),
  validatePin: vi.fn(),
  createCashier: vi.fn()
}

beforeEach(() => {
  // Reset Zustand store between tests
  useAuthStore.setState({
    appState: 'loading' as AppState,
    merchantConfig: null,
    currentCashier: null,
    loginAttempts: 0,
    lockoutUntil: null,
    error: null
  })

  // Reset mocks — clear call counts and implementations
  Object.values(mockApi).forEach((fn) => fn.mockReset())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = mockApi
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
})

describe('useAuthStore', () => {
  describe('initialize', () => {
    it('sets appState to not-activated when no merchant config exists', async () => {
      mockApi.getMerchantConfig.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('not-activated')
      expect(result.current.merchantConfig).toBeNull()
    })

    it('sets appState to login when merchant is activated but no cashiers', async () => {
      const config = {
        id: 1,
        stax_api_key: 'test-key',
        merchant_id: 'merch-123',
        merchant_name: 'Test Store',
        activated_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
      mockApi.getMerchantConfig.mockResolvedValue(config)
      mockApi.getCashiers.mockResolvedValue([])

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('login')
      expect(result.current.merchantConfig).toEqual(config)
    })

    it('sets appState to login when merchant is activated and cashiers exist', async () => {
      const config = {
        id: 1,
        stax_api_key: 'test-key',
        merchant_id: 'merch-123',
        merchant_name: 'Test Store',
        activated_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
      mockApi.getMerchantConfig.mockResolvedValue(config)
      mockApi.getCashiers.mockResolvedValue([
        { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
      ])

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.appState).toBe('login')
    })
  })

  describe('activate', () => {
    it('activates merchant and transitions to login state', async () => {
      const config = {
        id: 1,
        stax_api_key: 'valid-key',
        merchant_id: 'merch-123',
        merchant_name: 'High Spirits',
        activated_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
      mockApi.activateMerchant.mockResolvedValue(config)
      mockApi.getCashiers.mockResolvedValue([])

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.activate('valid-key')
      })

      expect(result.current.appState).toBe('login')
      expect(result.current.merchantConfig).toEqual(config)
      expect(result.current.error).toBeNull()
    })

    it('sets error when activation fails', async () => {
      mockApi.activateMerchant.mockRejectedValue(new Error('Invalid API key'))

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.activate('bad-key')
      })

      expect(result.current.appState).toBe('not-activated')
      expect(result.current.error).toBe('Invalid API key')
    })
  })

  describe('deactivate', () => {
    it('clears config and transitions to not-activated', async () => {
      // Start in activated state
      useAuthStore.setState({
        appState: 'login' as AppState,
        merchantConfig: {
          id: 1,
          stax_api_key: 'key',
          merchant_id: 'merch-123',
          merchant_name: 'Store',
          activated_at: '2026-01-01',
          updated_at: '2026-01-01'
        }
      })

      mockApi.deactivateMerchant.mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.deactivate()
      })

      expect(result.current.appState).toBe('not-activated')
      expect(result.current.merchantConfig).toBeNull()
    })
  })

  describe('login', () => {
    it('logs in successfully with valid PIN', async () => {
      useAuthStore.setState({
        appState: 'login' as AppState,
        merchantConfig: {
          id: 1,
          stax_api_key: 'key',
          merchant_id: 'merch-123',
          merchant_name: 'Store',
          activated_at: '2026-01-01',
          updated_at: '2026-01-01'
        }
      })

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

    it('locks out after 3 failed attempts', async () => {
      useAuthStore.setState({ appState: 'login' as AppState, loginAttempts: 2 })
      mockApi.validatePin.mockResolvedValue(null)

      const { result } = renderHook(() => useAuthStore())

      await act(async () => {
        await result.current.login('0000')
      })

      expect(result.current.loginAttempts).toBe(3)
      expect(result.current.lockoutUntil).toBeGreaterThan(Date.now())
      expect(result.current.error).toMatch(/Too many attempts/)
    })

    it('prevents login during lockout', async () => {
      useAuthStore.setState({
        appState: 'login' as AppState,
        lockoutUntil: Date.now() + 30000
      })

      const { result } = renderHook(() => useAuthStore())

      let loginResult: boolean | undefined
      await act(async () => {
        loginResult = await result.current.login('1234')
      })

      expect(loginResult).toBe(false)
      expect(mockApi.validatePin).not.toHaveBeenCalled()
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
