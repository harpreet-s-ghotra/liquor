import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen } from './LoginScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'

// ── Mock the window.api bridge ──

const mockApi = {
  getCashiers: vi.fn(),
  createCashier: vi.fn(),
  validatePin: vi.fn(),
  getMerchantConfig: vi.fn()
}

const mockLogin = vi.fn()

beforeEach(() => {
  useAuthStore.setState({
    appState: 'login' as AppState,
    merchantConfig: {
      id: 1,
      stax_api_key: 'key',
      merchant_id: 'merch-123',
      merchant_name: 'High Spirits Liquor',
      activated_at: '2026-01-01',
      updated_at: '2026-01-01'
    },
    currentCashier: null,
    loginAttempts: 0,
    lockoutUntil: null,
    error: null,
    login: mockLogin
  } as unknown as Partial<ReturnType<typeof useAuthStore.getState>>)

  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockLogin.mockReset()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = mockApi
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
})

describe('LoginScreen', () => {
  describe('when cashiers exist', () => {
    beforeEach(() => {
      mockApi.getCashiers.mockResolvedValue([
        { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
      ])
    })

    it('renders the PIN pad', async () => {
      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
      })

      // PIN pad should have digits 0-9
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
      }
    })

    it('fills dots as PIN digits are entered', async () => {
      const user = userEvent.setup()
      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText('Enter PIN')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '1' }))
      await user.click(screen.getByRole('button', { name: '2' }))

      const filledDots = document.querySelectorAll('.pin-dot.filled')
      expect(filledDots).toHaveLength(2)
    })

    it('calls login when 4 digits are entered', async () => {
      const user = userEvent.setup()
      mockLogin.mockResolvedValue(true)

      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText('Enter PIN')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '1' }))
      await user.click(screen.getByRole('button', { name: '2' }))
      await user.click(screen.getByRole('button', { name: '3' }))
      await user.click(screen.getByRole('button', { name: '4' }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('1234')
      })
    })

    it('shows error on invalid PIN', async () => {
      useAuthStore.setState({ error: 'Invalid PIN' })

      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText('Invalid PIN')).toBeInTheDocument()
      })
    })

    it('clears PIN on backspace', async () => {
      const user = userEvent.setup()
      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText('Enter PIN')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '1' }))
      await user.click(screen.getByRole('button', { name: '2' }))

      let filledDots = document.querySelectorAll('.pin-dot.filled')
      expect(filledDots).toHaveLength(2)

      const backspace = screen.getByRole('button', { name: /⌫|backspace/i })
      await user.click(backspace)

      filledDots = document.querySelectorAll('.pin-dot.filled')
      expect(filledDots).toHaveLength(1)
    })

    it('shows lockout timer when locked out', async () => {
      useAuthStore.setState({
        lockoutUntil: Date.now() + 30000,
        error: 'Too many attempts. Please wait 30 seconds.'
      })

      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText(/Too many failed attempts/)).toBeInTheDocument()
      })
    })
  })

  describe('when no cashiers exist (first-time setup)', () => {
    beforeEach(() => {
      mockApi.getCashiers.mockResolvedValue([])
    })

    it('shows the first cashier setup form', async () => {
      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText(/Set Up Admin/i)).toBeInTheDocument()
      })

      expect(screen.getByPlaceholderText(/cashier name/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/enter.*pin/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/confirm.*pin/i)).toBeInTheDocument()
    })

    it('creates first cashier as admin and validates', async () => {
      const user = userEvent.setup()
      const newCashier = {
        id: 1,
        name: 'Manager',
        role: 'admin',
        is_active: 1,
        created_at: '2026-01-01'
      }
      mockApi.createCashier.mockResolvedValue(newCashier)
      mockLogin.mockResolvedValue(true)

      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText(/Set Up Admin/i)).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText(/cashier name/i), 'Manager')
      await user.type(screen.getByPlaceholderText(/enter.*pin/i), '1234')
      await user.type(screen.getByPlaceholderText(/confirm.*pin/i), '1234')

      const submitBtn = screen.getByRole('button', { name: /create.*admin/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(mockApi.createCashier).toHaveBeenCalledWith({
          name: 'Manager',
          pin: '1234',
          role: 'admin'
        })
      })
    })

    it('shows error when PINs do not match', async () => {
      const user = userEvent.setup()
      render(<LoginScreen />)

      await waitFor(() => {
        expect(screen.getByText(/Set Up Admin/i)).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText(/cashier name/i), 'Manager')
      await user.type(screen.getByPlaceholderText(/enter.*pin/i), '1234')
      await user.type(screen.getByPlaceholderText(/confirm.*pin/i), '5678')

      const submitBtn = screen.getByRole('button', { name: /create.*admin/i })
      await user.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText(/PINs do not match/i)).toBeInTheDocument()
      })
    })
  })
})
