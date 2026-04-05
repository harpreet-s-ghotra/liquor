import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthScreen } from './AuthScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'

// ── Mock the auth store ──

const mockEmailLogin = vi.fn()

beforeEach(() => {
  useAuthStore.setState({
    appState: 'auth' as AppState,
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
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

describe('AuthScreen', () => {
  it('renders the email input, password input, and Sign In button', () => {
    render(<AuthScreen />)

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('disables the button when email is empty', () => {
    render(<AuthScreen />)

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
  })

  it('disables the button when password is empty', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
  })

  it('disables the button when both inputs are empty', () => {
    render(<AuthScreen />)

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).toBeDisabled()
  })

  it('enables the button when both email and password are filled', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')

    const button = screen.getByRole('button', { name: /sign in/i })
    expect(button).not.toBeDisabled()
  })

  it('calls emailLogin with email and password on button click', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockResolvedValue(undefined)
    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@store.com')
    await user.type(screen.getByPlaceholderText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockEmailLogin).toHaveBeenCalledWith('admin@store.com', 'secret123')
  })

  it('trims whitespace from email before calling emailLogin', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockResolvedValue(undefined)
    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), '  admin@store.com  ')
    await user.type(screen.getByPlaceholderText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mockEmailLogin).toHaveBeenCalledWith('admin@store.com', 'secret123')
  })

  it('calls emailLogin when Enter key is pressed', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockResolvedValue(undefined)
    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@store.com')
    await user.type(screen.getByPlaceholderText('Password'), 'secret123')
    await user.keyboard('{Enter}')

    expect(mockEmailLogin).toHaveBeenCalledWith('admin@store.com', 'secret123')
  })

  it('shows error message from store', () => {
    useAuthStore.setState({ error: 'Invalid email or password' })

    render(<AuthScreen />)

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
  })

  it('clears error when email input changes', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ error: 'Invalid email or password' })

    render(<AuthScreen />)
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a')

    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument()
  })

  it('clears error when password input changes', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ error: 'Invalid email or password' })

    render(<AuthScreen />)
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Password'), 'p')

    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument()
  })

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockImplementation(() => new Promise(() => {}))

    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })
  })

  it('disables inputs during submission', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockImplementation(() => new Promise(() => {}))

    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('you@example.com')).toBeDisabled()
      expect(screen.getByPlaceholderText('Password')).toBeDisabled()
    })
  })

  it('disables button during submission', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockImplementation(() => new Promise(() => {}))

    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })

  it('does not submit when button is already loading', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockImplementation(() => new Promise(() => {}))

    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')

    const button = screen.getByRole('button', { name: /sign in/i })
    await user.click(button)
    await user.click(button)

    // emailLogin should only be called once due to isLoading check
    expect(mockEmailLogin).toHaveBeenCalledTimes(1)
  })

  it('recovers from loading state when submission completes', async () => {
    const user = userEvent.setup()
    mockEmailLogin.mockResolvedValue(undefined)

    render(<AuthScreen />)

    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com')
    await user.type(screen.getByPlaceholderText('Password'), 'pass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Wait for the button to return to idle state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveTextContent('Sign In')
    })
  })

  it('focuses email input on render', () => {
    render(<AuthScreen />)

    const emailInput = screen.getByPlaceholderText('you@example.com') as HTMLInputElement
    expect(emailInput).toHaveFocus()
  })
})
