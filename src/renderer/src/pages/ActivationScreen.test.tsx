import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivationScreen } from './ActivationScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'

// ── Mock the auth store ──

const mockActivate = vi.fn()

beforeEach(() => {
  useAuthStore.setState({
    appState: 'not-activated' as AppState,
    merchantConfig: null,
    error: null,
    currentCashier: null,
    loginAttempts: 0,
    lockoutUntil: null
  })
  mockActivate.mockReset()

  // Patch the activate function
  useAuthStore.setState({ activate: mockActivate } as unknown as Partial<
    ReturnType<typeof useAuthStore.getState>
  >)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ActivationScreen', () => {
  it('renders the activation form', () => {
    render(<ActivationScreen />)

    expect(screen.getByText('Activate Your POS')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your Stax API key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument()
  })

  it('disables the button when API key is empty', () => {
    render(<ActivationScreen />)

    const button = screen.getByRole('button', { name: /activate/i })
    expect(button).toBeDisabled()
  })

  it('calls activate with the entered API key', async () => {
    const user = userEvent.setup()
    mockActivate.mockResolvedValue(undefined)
    render(<ActivationScreen />)

    const input = screen.getByPlaceholderText('Enter your Stax API key')
    await user.type(input, 'my-test-api-key')

    const button = screen.getByRole('button', { name: /activate/i })
    await user.click(button)

    expect(mockActivate).toHaveBeenCalledWith('my-test-api-key')
  })

  it('shows an error message when activation fails', async () => {
    useAuthStore.setState({
      error: 'Stax API key validation failed (HTTP 401)'
    })

    render(<ActivationScreen />)

    expect(screen.getByText('Stax API key validation failed (HTTP 401)')).toBeInTheDocument()
  })

  it('shows loading state during activation', async () => {
    const user = userEvent.setup()
    // Make activate hang to simulate loading
    mockActivate.mockImplementation(() => new Promise(() => {}))

    render(<ActivationScreen />)

    const input = screen.getByPlaceholderText('Enter your Stax API key')
    await user.type(input, 'test-key')

    const button = screen.getByRole('button', { name: /activate/i })
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/validating/i)).toBeInTheDocument()
    })
  })

  it('toggles API key visibility', async () => {
    const user = userEvent.setup()
    render(<ActivationScreen />)

    const input = screen.getByPlaceholderText('Enter your Stax API key')
    expect(input).toHaveAttribute('type', 'password')

    const toggleBtn = screen.getByLabelText(/toggle.*visibility/i)
    await user.click(toggleBtn)

    expect(input).toHaveAttribute('type', 'text')

    await user.click(toggleBtn)
    expect(input).toHaveAttribute('type', 'password')
  })
})
