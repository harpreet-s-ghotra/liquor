import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivationScreen } from './ActivationScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'

// ── Mock the auth store ──

const mockEmailLogin = vi.fn()

beforeEach(() => {
  useAuthStore.setState({
    appState: 'auth' as AppState,
    merchantConfig: null,
    error: null,
    currentCashier: null,
    loginAttempts: 0,
    lockoutUntil: null
  })
  mockEmailLogin.mockReset()

  useAuthStore.setState({ emailLogin: mockEmailLogin } as unknown as Partial<
    ReturnType<typeof useAuthStore.getState>
  >)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ActivationScreen', () => {
  it('renders the sign-in form', () => {
    render(<ActivationScreen />)

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('disables the button when email or password is empty', () => {
    render(<ActivationScreen />)

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
  })

  it('calls emailLogin with email and password', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockResolvedValue(undefined)
    render(<ActivationScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@store.com')
    await user.type(screen.getByPlaceholderText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockEmailLogin).toHaveBeenCalledWith('admin@store.com', 'secret123')
  })

  it('shows an error message when sign-in fails', () => {
    useAuthStore.setState({ error: 'Invalid email or password' })

    render(<ActivationScreen />)

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
  })

  it('shows loading state while signing in', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockImplementation(() => new Promise(() => {}))

    render(<ActivationScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })
})
