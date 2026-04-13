import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BusinessSetupScreen } from './BusinessSetupScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'
import type { ProvisionMerchantResult } from '../../../shared/types'

// ── Mock window.api ──

const mockFinixProvisionMerchant = vi.fn()
const mockCompleteBusinessSetup = vi.fn()

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
    lockoutUntil: null
  })

  mockFinixProvisionMerchant.mockReset()
  mockCompleteBusinessSetup.mockReset()

  useAuthStore.setState({
    completeBusinessSetup: mockCompleteBusinessSetup
  } as unknown as Partial<ReturnType<typeof useAuthStore.getState>>)
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
  vi.restoreAllMocks()
})

describe('BusinessSetupScreen', () => {
  it('renders form sections and labels', () => {
    render(<BusinessSetupScreen />)

    expect(screen.getByText('Set Up Your Business')).toBeInTheDocument()
    expect(screen.getByText('Business Information')).toBeInTheDocument()
    expect(screen.getByText('Owner / Principal')).toBeInTheDocument()

    expect(screen.getByLabelText('Business Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Doing Business As')).toBeInTheDocument()
    expect(screen.getByLabelText('Business Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Business Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Address Line 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Address Line 2')).toBeInTheDocument()
    expect(screen.getByLabelText('City')).toBeInTheDocument()
    expect(screen.getByLabelText('State')).toBeInTheDocument()
    expect(screen.getByLabelText('ZIP')).toBeInTheDocument()
  })

  it('renders owner section fields', () => {
    render(<BusinessSetupScreen />)

    expect(screen.getByLabelText('First Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Birth Month')).toBeInTheDocument()
    expect(screen.getByLabelText('Birth Day')).toBeInTheDocument()
    expect(screen.getByLabelText('Birth Year')).toBeInTheDocument()
    expect(screen.getByLabelText('SSN Last 4')).toBeInTheDocument()
    expect(screen.getByLabelText('EIN (9 digits)')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    render(<BusinessSetupScreen />)

    expect(screen.getByRole('button', { name: /activate payment processing/i })).toBeInTheDocument()
  })

  it('renders business type select with all options', () => {
    render(<BusinessSetupScreen />)

    const businessTypeSelect = screen.getByLabelText('Business Type') as HTMLSelectElement
    const options = Array.from(businessTypeSelect.options).map((o) => o.value)

    expect(options).toContain('INDIVIDUAL_SOLE_PROPRIETORSHIP')
    expect(options).toContain('PARTNERSHIP')
    expect(options).toContain('LIMITED_LIABILITY_COMPANY')
    expect(options).toContain('CORPORATION')
  })

  it('renders state select with all US states', () => {
    render(<BusinessSetupScreen />)

    const stateSelect = screen.getByLabelText('State') as HTMLSelectElement
    const options = Array.from(stateSelect.options).map((o) => o.value)

    expect(options).toContain('CA')
    expect(options).toContain('NY')
    expect(options).toContain('TX')
    expect(options).toContain('WA')
    expect(options).toContain('DC')
  })

  // ── Validation Tests ──

  it('shows error when business name is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Business name is required')).toBeInTheDocument()
  })

  it('shows error when doing business as is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    await user.type(businessNameInput, 'Test Business')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Doing business as is required')).toBeInTheDocument()
  })

  it('shows error when business phone is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Business phone is required')).toBeInTheDocument()
  })

  it('shows error when address line 1 is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Address line 1 is required')).toBeInTheDocument()
  })

  it('shows error when city is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('City is required')).toBeInTheDocument()
  })

  it('shows error when state is not selected', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('State is required')).toBeInTheDocument()
  })

  it('shows error when ZIP code is not 5 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '123')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('ZIP code must be 5 digits')).toBeInTheDocument()
  })

  it('shows error when first name is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Owner first name is required')).toBeInTheDocument()
  })

  it('shows error when last name is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Owner last name is required')).toBeInTheDocument()
  })

  it('shows error when email is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const phoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(phoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Owner email is required')).toBeInTheDocument()
  })

  it('shows error when owner phone is empty', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Owner phone is required')).toBeInTheDocument()
  })

  it('shows error when birth month is invalid', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '13')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Valid birth month is required (1-12)')).toBeInTheDocument()
  })

  it('shows error when birth day is invalid', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '12')
    await user.type(dayInput, '32')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Valid birth day is required (1-31)')).toBeInTheDocument()
  })

  it('shows error when birth year is invalid', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '12')
    await user.type(dayInput, '15')
    await user.type(yearInput, '2020')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('Valid birth year is required')).toBeInTheDocument()
  })

  it('shows error when SSN last 4 is not 4 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '12')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('SSN last 4 must be exactly 4 digits')).toBeInTheDocument()
  })

  it('shows error when EIN is not 9 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressInput = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressInput, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '12345')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.getByText('EIN must be exactly 9 digits')).toBeInTheDocument()
  })

  // ── Input Formatting Tests ──

  it('allows only numeric input in ZIP code field', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const zipInput = screen.getByPlaceholderText('12345') as HTMLInputElement

    await user.type(zipInput, 'abc12xyz345')

    expect(zipInput.value).toBe('12345')
  })

  it('allows only numeric input in birth month field', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const monthInput = screen.getByPlaceholderText('MM') as HTMLInputElement

    await user.type(monthInput, 'abc06xyz')

    expect(monthInput.value).toBe('06')
  })

  it('allows only numeric input in birth day field', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const dayInput = screen.getByPlaceholderText('DD') as HTMLInputElement

    await user.type(dayInput, 'abc15xyz')

    expect(dayInput.value).toBe('15')
  })

  it('allows only numeric input in birth year field', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const yearInput = screen.getByPlaceholderText('YYYY') as HTMLInputElement

    await user.type(yearInput, 'abc1990xyz')

    expect(yearInput.value).toBe('1990')
  })

  it('allows only numeric input in SSN last 4 field', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const ssnInput = screen.getByPlaceholderText('1234') as HTMLInputElement

    await user.type(ssnInput, 'abc5678xyz')

    expect(ssnInput.value).toBe('5678')
  })

  it('allows only numeric input in EIN field', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const einInput = screen.getByPlaceholderText('123456789') as HTMLInputElement

    await user.type(einInput, 'abc123456789xyz')

    expect(einInput.value).toBe('123456789')
  })

  it('limits ZIP code to 5 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const zipInput = screen.getByPlaceholderText('12345') as HTMLInputElement

    await user.type(zipInput, '123456789')

    expect(zipInput.value).toBe('12345')
  })

  it('limits birth month to 2 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const monthInput = screen.getByPlaceholderText('MM') as HTMLInputElement

    await user.type(monthInput, '123')

    expect(monthInput.value).toBe('12')
  })

  it('limits birth day to 2 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const dayInput = screen.getByPlaceholderText('DD') as HTMLInputElement

    await user.type(dayInput, '123')

    expect(dayInput.value).toBe('12')
  })

  it('limits birth year to 4 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const yearInput = screen.getByPlaceholderText('YYYY') as HTMLInputElement

    await user.type(yearInput, '20201')

    expect(yearInput.value).toBe('2020')
  })

  it('limits SSN last 4 to 4 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const ssnInput = screen.getByPlaceholderText('1234') as HTMLInputElement

    await user.type(ssnInput, '56789')

    expect(ssnInput.value).toBe('5678')
  })

  it('limits EIN to 9 digits', async () => {
    const user = userEvent.setup()
    render(<BusinessSetupScreen />)

    const einInput = screen.getByPlaceholderText('123456789') as HTMLInputElement

    await user.type(einInput, '1234567890')

    expect(einInput.value).toBe('123456789')
  })

  // ── Successful Submission Tests ──

  it('calls finixProvisionMerchant with correctly shaped input on valid submit', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockResolvedValue({
      finix_merchant_id: 'merchant_123',
      merchant_name: 'Test Business'
    } as ProvisionMerchantResult)
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessTypeSelect = screen.getByLabelText('Business Type')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const addressLine2Input = screen.getByPlaceholderText('Suite, unit, etc. (optional)')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business LLC')
    await user.type(dbaInput, 'Test DBA')
    await user.selectOptions(businessTypeSelect, 'LIMITED_LIABILITY_COMPANY')
    await user.type(businessPhoneInput, '5555551234')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(addressLine2Input, 'Suite 100')
    await user.type(cityInput, 'San Francisco')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '94102')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555559999')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(mockFinixProvisionMerchant).toHaveBeenCalledWith({
        business_name: 'Test Business LLC',
        doing_business_as: 'Test DBA',
        business_type: 'LIMITED_LIABILITY_COMPANY',
        business_phone: '5555551234',
        business_address: {
          line1: '123 Main St',
          line2: 'Suite 100',
          city: 'San Francisco',
          region: 'CA',
          postal_code: '94102',
          country: 'US'
        },
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '5555559999',
        dob: {
          year: 1980,
          month: 5,
          day: 15
        },
        tax_id: '1234',
        business_tax_id: '123456789'
      })
    })
  })

  it('calls completeBusinessSetup after successful finixProvisionMerchant', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockResolvedValue({
      finix_merchant_id: 'merchant_123',
      merchant_name: 'Test Business'
    } as ProvisionMerchantResult)
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(mockCompleteBusinessSetup).toHaveBeenCalled()
    })
  })

  it('trims whitespace from text fields before submission', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockResolvedValue({
      finix_merchant_id: 'merchant_123',
      merchant_name: 'Test Business'
    } as ProvisionMerchantResult)
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, '  Test Business  ')
    await user.type(dbaInput, '  Test DBA  ')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '  123 Main St  ')
    await user.type(cityInput, '  Anytown  ')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, '  John  ')
    await user.type(lastNameInput, '  Doe  ')
    await user.type(emailInput, '  john@example.com  ')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(mockFinixProvisionMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          business_name: 'Test Business',
          doing_business_as: 'Test DBA',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          business_address: expect.objectContaining({
            line1: '123 Main St',
            city: 'Anytown'
          })
        })
      )
    })
  })

  it('omits address line 2 if empty during submission', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockResolvedValue({
      finix_merchant_id: 'merchant_123',
      merchant_name: 'Test Business'
    } as ProvisionMerchantResult)
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(mockFinixProvisionMerchant).toHaveBeenCalledWith(
        expect.objectContaining({
          business_address: expect.not.objectContaining({
            line2: expect.anything()
          })
        })
      )
    })
  })

  // ── Loading State Tests ──

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockImplementation(() => new Promise(() => {}))

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(screen.getByText('Activating payments...')).toBeInTheDocument()
    })
  })

  it('disables inputs during submission', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockImplementation(() => new Promise(() => {}))

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name') as HTMLInputElement
    const dbaInput = screen.getByPlaceholderText('Store name customers see') as HTMLInputElement
    const businessPhoneInput = screen.getByLabelText('Business Phone') as HTMLInputElement
    const addressLine1Input = screen.getByPlaceholderText('Street address') as HTMLInputElement
    const cityInput = screen.getByPlaceholderText('City') as HTMLInputElement
    const stateSelect = screen.getByLabelText('State') as HTMLSelectElement
    const zipInput = screen.getByPlaceholderText('12345') as HTMLInputElement
    const firstNameInput = screen.getByPlaceholderText('First name') as HTMLInputElement
    const lastNameInput = screen.getByPlaceholderText('Last name') as HTMLInputElement
    const emailInput = screen.getByPlaceholderText('owner@example.com') as HTMLInputElement
    const ownerPhoneInput = screen.getByLabelText('Phone') as HTMLInputElement
    const monthInput = screen.getByPlaceholderText('MM') as HTMLInputElement
    const dayInput = screen.getByPlaceholderText('DD') as HTMLInputElement
    const yearInput = screen.getByPlaceholderText('YYYY') as HTMLInputElement
    const ssnInput = screen.getByPlaceholderText('1234') as HTMLInputElement
    const einInput = screen.getByPlaceholderText('123456789') as HTMLInputElement

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(businessNameInput).toBeDisabled()
      expect(dbaInput).toBeDisabled()
      expect(businessPhoneInput).toBeDisabled()
      expect(addressLine1Input).toBeDisabled()
      expect(cityInput).toBeDisabled()
      expect(stateSelect).toBeDisabled()
      expect(zipInput).toBeDisabled()
      expect(firstNameInput).toBeDisabled()
      expect(lastNameInput).toBeDisabled()
      expect(emailInput).toBeDisabled()
      expect(ownerPhoneInput).toBeDisabled()
      expect(monthInput).toBeDisabled()
      expect(dayInput).toBeDisabled()
      expect(yearInput).toBeDisabled()
      expect(ssnInput).toBeDisabled()
      expect(einInput).toBeDisabled()
    })
  })

  // ── Error Handling Tests ──

  it('shows error when finixProvisionMerchant throws', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockRejectedValue(new Error('Invalid merchant credentials'))

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid merchant credentials')).toBeInTheDocument()
    })
  })

  it('strips IPC prefix from error messages', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockRejectedValue(
      new Error("Error invoking remote method 'finixProvisionMerchant': Error: Network error")
    )

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('handles generic error when finixProvisionMerchant throws non-Error', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockRejectedValue('Unknown error')

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to activate payments')).toBeInTheDocument()
    })
  })

  it('clears error on new submission attempt', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockRejectedValueOnce(new Error('First error'))
    mockFinixProvisionMerchant.mockResolvedValueOnce({
      finix_merchant_id: 'merchant_123',
      merchant_name: 'Test Business'
    } as ProvisionMerchantResult)
    mockCompleteBusinessSetup.mockResolvedValue(undefined)

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name')
    const dbaInput = screen.getByPlaceholderText('Store name customers see')
    const businessPhoneInput = screen.getByLabelText('Business Phone')
    const addressLine1Input = screen.getByPlaceholderText('Street address')
    const cityInput = screen.getByPlaceholderText('City')
    const stateSelect = screen.getByLabelText('State')
    const zipInput = screen.getByPlaceholderText('12345')
    const firstNameInput = screen.getByPlaceholderText('First name')
    const lastNameInput = screen.getByPlaceholderText('Last name')
    const emailInput = screen.getByPlaceholderText('owner@example.com')
    const ownerPhoneInput = screen.getByLabelText('Phone')
    const monthInput = screen.getByPlaceholderText('MM')
    const dayInput = screen.getByPlaceholderText('DD')
    const yearInput = screen.getByPlaceholderText('YYYY')
    const ssnInput = screen.getByPlaceholderText('1234')
    const einInput = screen.getByPlaceholderText('123456789')

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    // First submission - should fail
    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument()
    })

    // Second submission - error should be cleared
    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    expect(screen.queryByText('First error')).not.toBeInTheDocument()
  })

  it('re-enables inputs after error during submission', async () => {
    const user = userEvent.setup()
    mockFinixProvisionMerchant.mockRejectedValue(new Error('Submission failed'))

    render(<BusinessSetupScreen />)

    const businessNameInput = screen.getByPlaceholderText('Legal business name') as HTMLInputElement
    const dbaInput = screen.getByPlaceholderText('Store name customers see') as HTMLInputElement
    const businessPhoneInput = screen.getByLabelText('Business Phone') as HTMLInputElement
    const addressLine1Input = screen.getByPlaceholderText('Street address') as HTMLInputElement
    const cityInput = screen.getByPlaceholderText('City') as HTMLInputElement
    const stateSelect = screen.getByLabelText('State') as HTMLSelectElement
    const zipInput = screen.getByPlaceholderText('12345') as HTMLInputElement
    const firstNameInput = screen.getByPlaceholderText('First name') as HTMLInputElement
    const lastNameInput = screen.getByPlaceholderText('Last name') as HTMLInputElement
    const emailInput = screen.getByPlaceholderText('owner@example.com') as HTMLInputElement
    const ownerPhoneInput = screen.getByLabelText('Phone') as HTMLInputElement
    const monthInput = screen.getByPlaceholderText('MM') as HTMLInputElement
    const dayInput = screen.getByPlaceholderText('DD') as HTMLInputElement
    const yearInput = screen.getByPlaceholderText('YYYY') as HTMLInputElement
    const ssnInput = screen.getByPlaceholderText('1234') as HTMLInputElement
    const einInput = screen.getByPlaceholderText('123456789') as HTMLInputElement

    await user.type(businessNameInput, 'Test Business')
    await user.type(dbaInput, 'Test DBA')
    await user.type(businessPhoneInput, '5555555555')
    await user.type(addressLine1Input, '123 Main St')
    await user.type(cityInput, 'Anytown')
    await user.selectOptions(stateSelect, 'CA')
    await user.type(zipInput, '12345')
    await user.type(firstNameInput, 'John')
    await user.type(lastNameInput, 'Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(ownerPhoneInput, '5555555555')
    await user.type(monthInput, '05')
    await user.type(dayInput, '15')
    await user.type(yearInput, '1980')
    await user.type(ssnInput, '1234')
    await user.type(einInput, '123456789')

    await user.click(screen.getByRole('button', { name: /activate payment processing/i }))

    await waitFor(() => {
      expect(screen.getByText('Submission failed')).toBeInTheDocument()
    })

    // Inputs should be re-enabled after error
    expect(businessNameInput).not.toBeDisabled()
    expect(dbaInput).not.toBeDisabled()
    expect(businessPhoneInput).not.toBeDisabled()
    expect(addressLine1Input).not.toBeDisabled()
    expect(cityInput).not.toBeDisabled()
    expect(stateSelect).not.toBeDisabled()
    expect(zipInput).not.toBeDisabled()
    expect(firstNameInput).not.toBeDisabled()
    expect(lastNameInput).not.toBeDisabled()
    expect(emailInput).not.toBeDisabled()
    expect(ownerPhoneInput).not.toBeDisabled()
    expect(monthInput).not.toBeDisabled()
    expect(dayInput).not.toBeDisabled()
    expect(yearInput).not.toBeDisabled()
    expect(ssnInput).not.toBeDisabled()
    expect(einInput).not.toBeDisabled()
  })
})
