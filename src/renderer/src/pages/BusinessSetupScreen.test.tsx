import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BusinessSetupScreen } from './BusinessSetupScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'
import type { BusinessInfoInput, ProvisionMerchantResult } from '../../../shared/types'

const mockFinixProvisionMerchant =
  vi.fn<(input: BusinessInfoInput) => Promise<ProvisionMerchantResult>>()
const mockCompleteBusinessSetup = vi.fn<() => Promise<void>>()

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = {
    finixProvisionMerchant: mockFinixProvisionMerchant
  }

  useAuthStore.setState({
    appState: 'business-setup' as AppState,
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
    loginAttempts: 0,
    lockoutUntil: null,
    completeBusinessSetup: mockCompleteBusinessSetup
  })

  mockFinixProvisionMerchant.mockReset()
  mockCompleteBusinessSetup.mockReset()
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
  vi.restoreAllMocks()
})

async function fillBusinessStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('Legal business name'), 'Test Business LLC')
  await user.type(screen.getByPlaceholderText('Store name customers see'), 'Test Store')
  await user.type(screen.getByLabelText('Business Phone'), '5555555555')
  await user.type(screen.getByPlaceholderText('Street address'), '123 Main St')
  await user.type(screen.getByPlaceholderText('City'), 'New York')
  await user.selectOptions(screen.getByLabelText('State'), 'NY')
  await user.type(screen.getByPlaceholderText('12345'), '10001')
}

async function fillOwnerStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('First name'), 'John')
  await user.type(screen.getByPlaceholderText('Last name'), 'Smith')
  await user.type(screen.getByPlaceholderText('owner@example.com'), 'john@example.com')
  await user.type(screen.getByLabelText('Phone'), '5555554444')
  await user.type(screen.getByPlaceholderText('MM'), '01')
  await user.type(screen.getByPlaceholderText('DD'), '15')
  await user.type(screen.getByPlaceholderText('YYYY'), '1985')
  await user.type(screen.getByLabelText('SSN (9 digits)'), '123456789')
  await user.type(screen.getByLabelText('EIN (9 digits)'), '987654321')
}

async function fillEntityStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('https://cornerstore.com'), 'https://test.com')
  await user.type(screen.getByPlaceholderText('100'), '100')
  await user.type(screen.getByPlaceholderText('150000'), '150000')
  const incMonth = screen.getAllByPlaceholderText('MM')[0]
  const incDay = screen.getAllByPlaceholderText('DD')[0]
  const incYear = screen.getAllByPlaceholderText('YYYY')[0]
  await user.type(incMonth, '01')
  await user.type(incDay, '01')
  await user.type(incYear, '2020')
}

async function fillBankStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByPlaceholderText('Name on bank account'), 'Test Business LLC')
  await user.type(screen.getByLabelText('Routing Number'), '021000021')
  await user.type(screen.getByPlaceholderText('Account number'), '1234567890')
}

describe('BusinessSetupScreen', () => {
  it('renders business step first', () => {
    render(<BusinessSetupScreen />)

    expect(screen.getByText('Set Up Your Business')).toBeInTheDocument()
    expect(screen.getByLabelText('Business Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Activate Payment Processing/i })
    ).not.toBeInTheDocument()
  })

  it('shows business-step validation errors', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('Business name is required')).toBeInTheDocument()
  })

  it('moves from business step to owner step after valid input', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    await fillBusinessStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect(screen.getByLabelText('First Name')).toBeInTheDocument()
    })
  })

  it('accepts digits only for owner numeric fields', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    await fillBusinessStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    const ssnInput = screen.getByLabelText('SSN (9 digits)') as HTMLInputElement
    await user.type(ssnInput, '12ab34!56789')
    expect(ssnInput.value).toBe('123456789')

    const einInput = screen.getByLabelText('EIN (9 digits)') as HTMLInputElement
    await user.type(einInput, '12ab34!56789')
    expect(einInput.value).toBe('123456789')
  })

  it('submits successfully through all wizard steps for LLC', async () => {
    const user = userEvent.setup({ delay: null })
    mockFinixProvisionMerchant.mockResolvedValue({
      finix_merchant_id: 'MU-123',
      merchant_name: 'Test Store'
    })
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    await fillBusinessStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillOwnerStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillEntityStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillBankStep(user)
    await user.click(screen.getByRole('button', { name: /Activate Payment Processing/i }))

    await waitFor(() => {
      expect(mockFinixProvisionMerchant).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mockCompleteBusinessSetup).toHaveBeenCalledTimes(1)
    })

    const payload = mockFinixProvisionMerchant.mock.calls[0][0]
    expect(payload.business_name).toBe('Test Business LLC')
    expect(payload.doing_business_as).toBe('Test Store')
    expect(payload.business_address.postal_code).toBe('10001')
    expect(payload.bank_account.routing_number).toBe('021000021')
  }, 20000)

  it('strips IPC error prefixes on submit failure', async () => {
    const user = userEvent.setup({ delay: null })
    mockFinixProvisionMerchant.mockRejectedValue(
      new Error("Error invoking remote method 'finix:provision-merchant': Error: Network down")
    )

    render(<BusinessSetupScreen />)

    await fillBusinessStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillOwnerStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillEntityStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillBankStep(user)
    await user.click(screen.getByRole('button', { name: /Activate Payment Processing/i }))

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Error invoking remote method/i)).not.toBeInTheDocument()
  }, 20000)

  it('skips entity step for sole proprietorship', async () => {
    const user = userEvent.setup({ delay: null })
    render(<BusinessSetupScreen />)

    await user.selectOptions(
      screen.getByLabelText('Business Type'),
      'INDIVIDUAL_SOLE_PROPRIETORSHIP'
    )
    await fillBusinessStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await fillOwnerStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Account Holder Name')).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Business Website URL')).not.toBeInTheDocument()
  }, 20000)

  it('shows submitting state on final submit', async () => {
    const user = userEvent.setup({ delay: null })
    let resolveProvision!: (value: ProvisionMerchantResult) => void
    mockFinixProvisionMerchant.mockReturnValue(
      new Promise<ProvisionMerchantResult>((resolve) => {
        resolveProvision = resolve
      })
    )
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    await fillBusinessStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await fillOwnerStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await fillEntityStep(user)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await fillBankStep(user)

    await user.click(screen.getByRole('button', { name: /Activate Payment Processing/i }))

    expect(screen.getByRole('button', { name: 'Activating payments...' })).toBeDisabled()

    resolveProvision({
      finix_merchant_id: 'MU-123',
      merchant_name: 'Test Store'
    })

    await waitFor(() => {
      expect(mockCompleteBusinessSetup).toHaveBeenCalled()
    })
  }, 20000)
})
