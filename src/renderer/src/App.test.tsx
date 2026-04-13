import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import App from './App'
import { useAuthStore, type AppState } from './store/useAuthStore'

const mockApi = {
  getMerchantConfig: vi.fn(),
  getCashiers: vi.fn(),
  getCatalogDistributors: vi.fn().mockResolvedValue([]),
  getProducts: vi.fn(),
  getHeldTransactions: vi.fn().mockResolvedValue([]),
  getItemTypes: vi.fn().mockResolvedValue([]),
  getDistributors: vi.fn().mockResolvedValue([]),
  getReceiptConfig: vi.fn().mockResolvedValue({
    fontSize: 10,
    paddingY: 4,
    paddingX: 4,
    storeName: '',
    footerMessage: '',
    alwaysPrint: false
  }),
  onDeepLink: vi.fn(),
  consumePendingDeepLink: vi.fn().mockResolvedValue(null)
}

beforeEach(() => {
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getHeldTransactions.mockResolvedValue([])
  mockApi.getItemTypes.mockResolvedValue([])
  mockApi.getDistributors.mockResolvedValue([])
  mockApi.getCatalogDistributors.mockResolvedValue([])
  mockApi.consumePendingDeepLink.mockResolvedValue(null)
  mockApi.onDeepLink.mockImplementation(() => {})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = mockApi
  // Prevent initialize() from overwriting our manually-set state
  vi.spyOn(useAuthStore.getState(), 'initialize').mockImplementation(async () => {})
  vi.spyOn(useAuthStore.getState(), 'handleInviteLink').mockImplementation(async () => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
})

describe('App', () => {
  it('renders POS directly in dev-browser mode when window.api is unavailable', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
    mockApi.getProducts.mockResolvedValue([])
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    useAuthStore.setState({
      appState: 'loading' as AppState,
      currentCashier: {
        id: 1,
        name: 'Alice',
        role: 'admin',
        is_active: 1,
        created_at: '2026-01-01'
      }
    })

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Tax')).toBeInTheDocument()
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[loadHeldTransactions] window.api.getHeldTransactions is not available'
    )
  })

  it('shows loading state initially', () => {
    useAuthStore.setState({ appState: 'loading' as AppState })
    render(<App />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows auth screen when not authenticated', async () => {
    useAuthStore.setState({ appState: 'auth' as AppState })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    })
  })

  it('shows set password screen when invite flow is active', async () => {
    useAuthStore.setState({ appState: 'set-password' as AppState })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Set Your Password' })).toBeInTheDocument()
    })
  })

  it('shows pin setup screen when cashier setup is required', async () => {
    useAuthStore.setState({ appState: 'pin-setup' as AppState })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Set Up Accounts' })).toBeInTheDocument()
    })
  })

  it('shows distributor onboarding screen when catalog import is required', async () => {
    useAuthStore.setState({ appState: 'distributor-onboarding' as AppState })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Select Your Distributors' })).toBeInTheDocument()
    })
  })

  it('shows login screen when activated', async () => {
    mockApi.getCashiers.mockResolvedValue([
      { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
    ])
    useAuthStore.setState({
      appState: 'login' as AppState,
      merchantConfig: {
        id: 1,
        finix_api_username: 'UStest',
        finix_api_password: 'test-password',
        merchant_id: 'MUtest',
        merchant_name: 'Test Store',
        activated_at: '2026-01-01',
        updated_at: '2026-01-01'
      }
    })
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Enter PIN')).toBeInTheDocument()
    })
  })

  it('shows POS screen when logged in', async () => {
    mockApi.getProducts.mockResolvedValue([])
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
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Tax')).toBeInTheDocument()
    })
  })

  it('runs initialize when no pending deep link is buffered', async () => {
    const initializeSpy = vi.spyOn(useAuthStore.getState(), 'initialize')
    useAuthStore.setState({ appState: 'loading' as AppState })

    render(<App />)

    await waitFor(() => {
      expect(mockApi.consumePendingDeepLink).toHaveBeenCalled()
      expect(initializeSpy).toHaveBeenCalled()
    })
  })

  it('consumes a buffered invite link and forwards tokens to handleInviteLink', async () => {
    const handleInviteLinkSpy = vi.spyOn(useAuthStore.getState(), 'handleInviteLink')
    mockApi.consumePendingDeepLink.mockResolvedValue(
      'liquorpos://auth/callback#access_token=token-123&refresh_token=refresh-456&type=invite'
    )
    useAuthStore.setState({ appState: 'loading' as AppState })

    render(<App />)

    await waitFor(() => {
      expect(handleInviteLinkSpy).toHaveBeenCalledWith('token-123', 'refresh-456')
    })
  })

  it('sets auth error from a buffered deep-link error without running initialize', async () => {
    mockApi.consumePendingDeepLink.mockResolvedValue(
      'liquorpos://auth/callback#error_description=Invite+link+expired'
    )
    useAuthStore.setState({ appState: 'loading' as AppState, error: null })

    render(<App />)

    await waitFor(() => {
      expect(useAuthStore.getState().appState).toBe('auth')
      expect(useAuthStore.getState().error).toBe('Invite link expired')
    })
  })
})
