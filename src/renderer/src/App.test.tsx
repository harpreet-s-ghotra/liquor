import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import App from './App'
import { useAuthStore, type AppState } from './store/useAuthStore'

const mockApi = {
  getMerchantConfig: vi.fn(),
  getCashiers: vi.fn(),
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
  onDeepLink: vi.fn()
}

beforeEach(() => {
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getHeldTransactions.mockResolvedValue([])
  mockApi.getItemTypes.mockResolvedValue([])
  mockApi.getDistributors.mockResolvedValue([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = mockApi
  // Prevent initialize() from overwriting our manually-set state
  vi.spyOn(useAuthStore.getState(), 'initialize').mockImplementation(async () => {})
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

  it('shows login screen when activated', async () => {
    mockApi.getCashiers.mockResolvedValue([
      { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
    ])
    useAuthStore.setState({
      appState: 'login' as AppState,
      merchantConfig: {
        id: 1,
        payment_processing_api_key: 'key',
        merchant_id: 'merch-123',
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
})
