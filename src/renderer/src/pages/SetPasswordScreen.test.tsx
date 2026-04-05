import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SetPasswordScreen } from './SetPasswordScreen'
import { useAuthStore } from '../store/useAuthStore'

const mockSetPassword = vi.fn()
const mockClearError = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ error: null })
  vi.spyOn(useAuthStore.getState(), 'setPassword').mockImplementation(mockSetPassword)
  vi.spyOn(useAuthStore.getState(), 'clearError').mockImplementation(mockClearError)
})

describe('SetPasswordScreen', () => {
  it('renders heading and inputs', () => {
    render(<SetPasswordScreen />)
    expect(screen.getByRole('heading', { name: 'Set Your Password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeDisabled()
  })

  it('shows validation error when password is too short', () => {
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows mismatch error when passwords do not match', () => {
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } })
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('enables submit button when passwords match and are long enough', () => {
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' }
    })
    expect(screen.getByRole('button', { name: 'Set Password' })).not.toBeDisabled()
  })

  it('calls setPassword on submit', async () => {
    mockSetPassword.mockResolvedValue(undefined)
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }))
    await waitFor(() => expect(mockSetPassword).toHaveBeenCalledWith('password123'))
  })

  it('shows loading state during submit', async () => {
    let resolve: () => void
    mockSetPassword.mockReturnValue(new Promise<void>((r) => (resolve = r)))
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set Password' }))
    expect(await screen.findByText('Setting password...')).toBeInTheDocument()
    resolve!()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Set Password' })).toBeInTheDocument()
    )
  })

  it('shows store error when present', () => {
    useAuthStore.setState({ error: 'Invalid session' })
    render(<SetPasswordScreen />)
    expect(screen.getByText('Invalid session')).toBeInTheDocument()
  })

  it('clears store error on password input change', () => {
    useAuthStore.setState({ error: 'Old error' })
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a' } })
    expect(mockClearError).toHaveBeenCalled()
  })

  it('submits on Enter key in password field', async () => {
    mockSetPassword.mockResolvedValue(undefined)
    render(<SetPasswordScreen />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' }
    })
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    await waitFor(() => expect(mockSetPassword).toHaveBeenCalledWith('password123'))
  })

  it('does not submit when canSubmit is false', () => {
    render(<SetPasswordScreen />)
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    expect(mockSetPassword).not.toHaveBeenCalled()
  })
})
