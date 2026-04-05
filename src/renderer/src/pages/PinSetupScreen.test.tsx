import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinSetupScreen } from './PinSetupScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'

// ── Mock window.api ──

const mockCreateCashier = vi.fn()
const mockCompleteSetup = vi.fn()

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = {
    createCashier: mockCreateCashier
  }

  useAuthStore.setState({
    appState: 'pin-setup' as AppState,
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
    loginAttempts: 0,
    lockoutUntil: null
  })

  mockCreateCashier.mockReset()
  mockCompleteSetup.mockReset()

  useAuthStore.setState({ completeSetup: mockCompleteSetup } as unknown as Partial<
    ReturnType<typeof useAuthStore.getState>
  >)
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
  vi.restoreAllMocks()
})

describe('PinSetupScreen', () => {
  it('renders admin and cashier account sections', () => {
    render(<PinSetupScreen />)

    expect(screen.getByText('Admin Account')).toBeInTheDocument()
    expect(screen.getByText('Cashier Account')).toBeInTheDocument()
    expect(screen.getByLabelText('Name', { selector: '#admin-name' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name', { selector: '#cashier-name' })).toBeInTheDocument()
  })

  it('renders all required input fields', () => {
    render(<PinSetupScreen />)

    expect(screen.getByPlaceholderText('Admin name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Cashier name')).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText('4-digit PIN')).toHaveLength(2)
    expect(screen.getAllByPlaceholderText('Confirm PIN')).toHaveLength(2)
  })

  it('renders Create Accounts button', () => {
    render(<PinSetupScreen />)

    expect(screen.getByRole('button', { name: /create accounts/i })).toBeInTheDocument()
  })

  it('shows error when admin name is empty', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Admin name is required')).toBeInTheDocument()
  })

  it('shows error when admin PIN is not 4 digits', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '123')
    await user.type(adminPinConfirm, '123')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Admin PIN must be 4 digits')).toBeInTheDocument()
  })

  it('shows error when admin PINs do not match', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '5678')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Admin PINs do not match')).toBeInTheDocument()
  })

  it('shows error when cashier name is empty', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Cashier name is required')).toBeInTheDocument()
  })

  it('shows error when cashier PIN is not 4 digits', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '567')
    await user.type(cashierPinConfirm, '567')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Cashier PIN must be 4 digits')).toBeInTheDocument()
  })

  it('shows error when cashier PINs do not match', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '1234')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Cashier PINs do not match')).toBeInTheDocument()
  })

  it('shows error when admin and cashier PINs are the same', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '1234')
    await user.type(cashierPinConfirm, '1234')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    expect(screen.getByText('Admin and cashier PINs must be different')).toBeInTheDocument()
  })

  it('calls createCashier twice and completeSetup on valid submit', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockResolvedValue(undefined)
    mockCompleteSetup.mockResolvedValue(undefined)

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin User')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John Doe')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(mockCreateCashier).toHaveBeenCalledTimes(2)
    })

    expect(mockCreateCashier).toHaveBeenNthCalledWith(1, {
      name: 'Admin User',
      pin: '1234',
      role: 'admin'
    })

    expect(mockCreateCashier).toHaveBeenNthCalledWith(2, {
      name: 'John Doe',
      pin: '5678',
      role: 'cashier'
    })

    expect(mockCompleteSetup).toHaveBeenCalled()
  })

  it('trims whitespace from names before submission', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockResolvedValue(undefined)
    mockCompleteSetup.mockResolvedValue(undefined)

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, '  Admin  ')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, '  John  ')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(mockCreateCashier).toHaveBeenCalledTimes(2)
    })

    expect(mockCreateCashier).toHaveBeenNthCalledWith(1, {
      name: 'Admin',
      pin: '1234',
      role: 'admin'
    })

    expect(mockCreateCashier).toHaveBeenNthCalledWith(2, {
      name: 'John',
      pin: '5678',
      role: 'cashier'
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockImplementation(() => new Promise(() => {}))

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(screen.getByText(/creating accounts/i)).toBeInTheDocument()
    })
  })

  it('disables inputs during submission', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockImplementation(() => new Promise(() => {}))

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(adminName).toBeDisabled()
      expect(adminPin).toBeDisabled()
      expect(adminPinConfirm).toBeDisabled()
      expect(cashierName).toBeDisabled()
      expect(cashierPin).toBeDisabled()
      expect(cashierPinConfirm).toBeDisabled()
    })
  })

  it('handles createCashier errors gracefully', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockRejectedValue(new Error('Failed to create admin'))

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to create admin')).toBeInTheDocument()
    })
  })

  it('handles generic error when createCashier throws non-Error', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockRejectedValue('Unknown error')

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to create accounts')).toBeInTheDocument()
    })
  })

  it('does not allow non-numeric input in PIN fields', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]

    await user.type(adminPin, 'abc123xyz')

    expect(adminPin).toHaveValue('123')
  })

  it('limits PIN input to 4 digits', async () => {
    const user = userEvent.setup()
    render(<PinSetupScreen />)

    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]

    await user.type(adminPin, '123456')

    expect(adminPin).toHaveValue('1234')
  })

  it('focuses admin name input on render', () => {
    render(<PinSetupScreen />)

    const adminNameInput = screen.getByPlaceholderText('Admin name') as HTMLInputElement
    expect(adminNameInput).toHaveFocus()
  })

  it('returns to normal state after error', async () => {
    const user = userEvent.setup()
    mockCreateCashier.mockRejectedValue(new Error('Failed to create admin'))

    render(<PinSetupScreen />)

    const adminName = screen.getByPlaceholderText('Admin name')
    const adminPin = screen.getAllByPlaceholderText('4-digit PIN')[0]
    const adminPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[0]
    const cashierName = screen.getByPlaceholderText('Cashier name')
    const cashierPin = screen.getAllByPlaceholderText('4-digit PIN')[1]
    const cashierPinConfirm = screen.getAllByPlaceholderText('Confirm PIN')[1]

    await user.type(adminName, 'Admin')
    await user.type(adminPin, '1234')
    await user.type(adminPinConfirm, '1234')
    await user.type(cashierName, 'John')
    await user.type(cashierPin, '5678')
    await user.type(cashierPinConfirm, '5678')

    await user.click(screen.getByRole('button', { name: /create accounts/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to create admin')).toBeInTheDocument()
    })

    // Button should be re-enabled
    expect(screen.getByRole('button', { name: /create accounts/i })).not.toBeDisabled()
  })
})
