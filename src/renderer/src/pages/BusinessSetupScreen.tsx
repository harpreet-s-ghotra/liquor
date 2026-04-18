import { useCallback, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { stripIpcPrefix } from '../utils/ipc-error'
import type { BusinessInfoInput } from '../../../shared/types'
import '../styles/auth.css'
import './BusinessSetupScreen.css'

const IS_DEV = import.meta.env.DEV

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC'
]

const BUSINESS_TYPES = [
  { value: 'INDIVIDUAL_SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LIMITED_LIABILITY_COMPANY', label: 'LLC' },
  { value: 'CORPORATION', label: 'Corporation' }
] as const

const NEEDS_EXTRA_FIELDS: BusinessInfoInput['business_type'][] = [
  'LIMITED_LIABILITY_COMPANY',
  'CORPORATION',
  'PARTNERSHIP'
]

type Step = 'business' | 'owner' | 'entity' | 'bank'

const STEP_LABELS: Record<Step, string> = {
  business: 'Business Info',
  owner: 'Owner Details',
  entity: 'Entity Details',
  bank: 'Bank Account'
}

type FormState = {
  business_name: string
  doing_business_as: string
  business_type: BusinessInfoInput['business_type']
  business_phone: string
  address_line1: string
  address_line2: string
  city: string
  region: string
  postal_code: string
  first_name: string
  last_name: string
  email: string
  phone: string
  dob_month: string
  dob_day: string
  dob_year: string
  tax_id: string
  business_tax_id: string
  // LLC / Corp / Partnership only
  url: string
  ownership_pct: string
  annual_volume: string
  inc_month: string
  inc_day: string
  inc_year: string
  // Bank account
  bank_account_number: string
  bank_routing_number: string
  bank_account_type:
    | 'PERSONAL_CHECKING'
    | 'PERSONAL_SAVINGS'
    | 'BUSINESS_CHECKING'
    | 'BUSINESS_SAVINGS'
  bank_account_name: string
}

const INITIAL_FORM: FormState = {
  business_name: '',
  doing_business_as: '',
  business_type: 'LIMITED_LIABILITY_COMPANY',
  business_phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  region: '',
  postal_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  dob_month: '',
  dob_day: '',
  dob_year: '',
  tax_id: '',
  business_tax_id: '',
  url: '',
  ownership_pct: '100',
  annual_volume: '',
  inc_month: '',
  inc_day: '',
  inc_year: '',
  bank_account_number: '',
  bank_routing_number: '',
  bank_account_type: 'BUSINESS_CHECKING',
  bank_account_name: ''
}

const DEMO_VALUES: Record<Step, Partial<FormState>> = {
  business: {
    business_name: 'Corner Spirits LLC',
    doing_business_as: 'Corner Spirits',
    business_type: 'LIMITED_LIABILITY_COMPANY',
    business_phone: '5555550100',
    address_line1: '123 Main Street',
    address_line2: '',
    city: 'New York',
    region: 'NY',
    postal_code: '10001'
  },
  owner: {
    first_name: 'John',
    last_name: 'Smith',
    email: 'john@cornerstore.com',
    phone: '5555550200',
    dob_month: '01',
    dob_day: '15',
    dob_year: '1980',
    tax_id: '123456789',
    business_tax_id: '123456789'
  },
  entity: {
    url: 'https://cornerstore.com',
    ownership_pct: '100',
    annual_volume: '150000',
    inc_month: '01',
    inc_day: '01',
    inc_year: '2020'
  },
  bank: {
    bank_account_name: 'Corner Spirits LLC',
    bank_routing_number: '021000021',
    bank_account_number: '1234567890',
    bank_account_type: 'BUSINESS_CHECKING'
  }
}

function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, '').slice(0, max)
}

function validateStep(step: Step, f: FormState): string | null {
  if (step === 'business') {
    if (!f.business_name.trim()) return 'Business name is required'
    if (!f.doing_business_as.trim()) return 'Doing business as is required'
    if (!f.business_phone.trim()) return 'Business phone is required'
    if (!f.address_line1.trim()) return 'Address is required'
    if (!f.city.trim()) return 'City is required'
    if (!f.region) return 'State is required'
    if (f.postal_code.length !== 5) return 'ZIP code must be 5 digits'
  }
  if (step === 'owner') {
    if (!f.first_name.trim()) return 'First name is required'
    if (!f.last_name.trim()) return 'Last name is required'
    if (!f.email.trim()) return 'Email is required'
    if (!f.phone.trim()) return 'Phone is required'
    const month = parseInt(f.dob_month, 10)
    const day = parseInt(f.dob_day, 10)
    const year = parseInt(f.dob_year, 10)
    if (!month || month < 1 || month > 12) return 'Valid birth month is required (1–12)'
    if (!day || day < 1 || day > 31) return 'Valid birth day is required (1–31)'
    if (!year || year < 1900 || year > 2010) return 'Valid birth year is required'
    if (f.tax_id.replace(/\D/g, '').length !== 9) return 'SSN must be exactly 9 digits'
    if (f.business_tax_id.length !== 9) return 'EIN must be exactly 9 digits'
  }
  if (step === 'entity') {
    if (!f.url.trim()) return 'Business website URL is required'
    const pct = parseInt(f.ownership_pct, 10)
    if (isNaN(pct) || pct < 1 || pct > 100) return 'Ownership % must be between 1 and 100'
    const vol = parseFloat(f.annual_volume)
    if (isNaN(vol) || vol <= 0) return 'Estimated annual card volume is required'
    const incMonth = parseInt(f.inc_month, 10)
    const incDay = parseInt(f.inc_day, 10)
    const incYear = parseInt(f.inc_year, 10)
    if (!incMonth || incMonth < 1 || incMonth > 12) return 'Valid incorporation month is required'
    if (!incDay || incDay < 1 || incDay > 31) return 'Valid incorporation day is required'
    if (!incYear || incYear < 1900 || incYear > 2030) return 'Valid incorporation year is required'
  }
  if (step === 'bank') {
    if (!f.bank_account_name.trim()) return 'Account holder name is required'
    if (f.bank_routing_number.length !== 9) return 'Routing number must be 9 digits'
    if (!f.bank_account_number.trim()) return 'Account number is required'
  }
  return null
}

export function BusinessSetupScreen(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const completeBusinessSetup = useAuthStore((s) => s.completeBusinessSetup)

  const steps: Step[] = NEEDS_EXTRA_FIELDS.includes(form.business_type)
    ? ['business', 'owner', 'entity', 'bank']
    : ['business', 'owner', 'bank']

  const [stepIndex, setStepIndex] = useState(0)
  const currentStep = steps[stepIndex]

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const fillDemo = useCallback(() => {
    setForm((prev) => ({ ...prev, ...DEMO_VALUES[currentStep] }))
    setError(null)
  }, [currentStep])

  const handleNext = useCallback(() => {
    setError(null)
    const err = validateStep(currentStep, form)
    if (err) {
      setError(err)
      return
    }
    setStepIndex((i) => i + 1)
  }, [currentStep, form])

  const handleBack = useCallback(() => {
    setError(null)
    setStepIndex((i) => i - 1)
  }, [])

  const handleSubmit = useCallback(async () => {
    setError(null)
    const err = validateStep('bank', form)
    if (err) {
      setError(err)
      return
    }

    const needsExtras = NEEDS_EXTRA_FIELDS.includes(form.business_type)
    const input: BusinessInfoInput = {
      business_name: form.business_name.trim(),
      doing_business_as: form.doing_business_as.trim(),
      business_type: form.business_type,
      business_phone: form.business_phone.trim(),
      business_address: {
        line1: form.address_line1.trim(),
        line2: form.address_line2.trim() || undefined,
        city: form.city.trim(),
        region: form.region,
        postal_code: form.postal_code,
        country: 'USA'
      },
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      dob: {
        year: parseInt(form.dob_year, 10),
        month: parseInt(form.dob_month, 10),
        day: parseInt(form.dob_day, 10)
      },
      tax_id: form.tax_id.replace(/\D/g, ''),
      business_tax_id: form.business_tax_id,
      ...(needsExtras && {
        url: form.url.trim(),
        principal_percentage_ownership: parseInt(form.ownership_pct, 10),
        annual_card_volume: Math.round(parseFloat(form.annual_volume) * 100),
        incorporation_date: {
          year: parseInt(form.inc_year, 10),
          month: parseInt(form.inc_month, 10),
          day: parseInt(form.inc_day, 10)
        }
      }),
      bank_account: {
        account_number: form.bank_account_number.trim(),
        routing_number: form.bank_routing_number,
        account_type: form.bank_account_type,
        name: form.bank_account_name.trim()
      }
    }

    setIsSubmitting(true)
    try {
      await window.api!.finixProvisionMerchant(input)
      await completeBusinessSetup()
    } catch (err) {
      setError(err instanceof Error ? stripIpcPrefix(err.message) : 'Failed to activate payments')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, completeBusinessSetup])

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 640 }}>
        <div className="auth-logo">
          <h1 className="auth-brand">High Spirits POS</h1>
        </div>

        <h2 className="auth-title">Set Up Your Business</h2>

        {/* ── Step indicator ── */}
        <div className="business-setup__stepper">
          {steps.map((s, i) => (
            <div
              key={s}
              className={[
                'business-setup__step',
                i < stepIndex ? 'business-setup__step--done' : '',
                i === stepIndex ? 'business-setup__step--active' : ''
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="business-setup__step-dot">{i < stepIndex ? '✓' : i + 1}</span>
              <span className="business-setup__step-label">{STEP_LABELS[s]}</span>
            </div>
          ))}
        </div>

        <div className="auth-form">
          {/* ── Section: Business Information ── */}
          {currentStep === 'business' && (
            <>
              {IS_DEV && (
                <button
                  type="button"
                  className="business-setup__demo-btn"
                  onClick={fillDemo}
                  tabIndex={-1}
                >
                  Fill Demo Values
                </button>
              )}

              <div className="auth-input-group">
                <label htmlFor="bs-business-name" className="auth-label">
                  Business Name
                </label>
                <input
                  id="bs-business-name"
                  type="text"
                  className="auth-input"
                  placeholder="Legal business name"
                  value={form.business_name}
                  onChange={(e) => update('business_name', e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div className="auth-input-group">
                <label htmlFor="bs-dba" className="auth-label">
                  Doing Business As
                </label>
                <input
                  id="bs-dba"
                  type="text"
                  className="auth-input"
                  placeholder="Store name customers see"
                  value={form.doing_business_as}
                  onChange={(e) => update('doing_business_as', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="business-setup__row">
                <div className="auth-input-group">
                  <label htmlFor="bs-business-type" className="auth-label">
                    Business Type
                  </label>
                  <select
                    id="bs-business-type"
                    className="auth-input"
                    value={form.business_type}
                    onChange={(e) =>
                      update('business_type', e.target.value as BusinessInfoInput['business_type'])
                    }
                    disabled={isSubmitting}
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-business-phone" className="auth-label">
                    Business Phone
                  </label>
                  <input
                    id="bs-business-phone"
                    type="tel"
                    className="auth-input"
                    placeholder="(555) 555-5555"
                    value={form.business_phone}
                    onChange={(e) => update('business_phone', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label htmlFor="bs-address1" className="auth-label">
                  Address Line 1
                </label>
                <input
                  id="bs-address1"
                  type="text"
                  className="auth-input"
                  placeholder="Street address"
                  value={form.address_line1}
                  onChange={(e) => update('address_line1', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-input-group">
                <label htmlFor="bs-address2" className="auth-label">
                  Address Line 2
                </label>
                <input
                  id="bs-address2"
                  type="text"
                  className="auth-input"
                  placeholder="Suite, unit, etc. (optional)"
                  value={form.address_line2}
                  onChange={(e) => update('address_line2', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="business-setup__row--address">
                <div className="auth-input-group">
                  <label htmlFor="bs-city" className="auth-label">
                    City
                  </label>
                  <input
                    id="bs-city"
                    type="text"
                    className="auth-input"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-state" className="auth-label">
                    State
                  </label>
                  <select
                    id="bs-state"
                    className="auth-input"
                    value={form.region}
                    onChange={(e) => update('region', e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">--</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-zip" className="auth-label">
                    ZIP
                  </label>
                  <input
                    id="bs-zip"
                    type="text"
                    className="auth-input"
                    placeholder="12345"
                    value={form.postal_code}
                    onChange={(e) => update('postal_code', digitsOnly(e.target.value, 5))}
                    disabled={isSubmitting}
                    maxLength={5}
                    inputMode="numeric"
                  />
                </div>
              </div>

              {/* ── Section nav ── */}
              {error && <div className="auth-error">{error}</div>}
              <div className="business-setup__nav">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    className="business-setup__nav-back"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  className="auth-submit-btn business-setup__nav-next"
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* ── Section: Owner Details ── */}
          {currentStep === 'owner' && (
            <>
              {IS_DEV && (
                <button
                  type="button"
                  className="business-setup__demo-btn"
                  onClick={fillDemo}
                  tabIndex={-1}
                >
                  Fill Demo Values
                </button>
              )}

              <div className="business-setup__row">
                <div className="auth-input-group">
                  <label htmlFor="bs-first-name" className="auth-label">
                    First Name
                  </label>
                  <input
                    id="bs-first-name"
                    type="text"
                    className="auth-input"
                    placeholder="First name"
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-last-name" className="auth-label">
                    Last Name
                  </label>
                  <input
                    id="bs-last-name"
                    type="text"
                    className="auth-input"
                    placeholder="Last name"
                    value={form.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="business-setup__row">
                <div className="auth-input-group">
                  <label htmlFor="bs-email" className="auth-label">
                    Email
                  </label>
                  <input
                    id="bs-email"
                    type="email"
                    className="auth-input"
                    placeholder="owner@example.com"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-phone" className="auth-label">
                    Phone
                  </label>
                  <input
                    id="bs-phone"
                    type="tel"
                    className="auth-input"
                    placeholder="(555) 555-5555"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <p className="auth-label" style={{ marginBottom: '0.5rem' }}>
                Date of Birth
              </p>
              <div className="business-setup__row--three">
                <div className="auth-input-group">
                  <label htmlFor="bs-dob-month" className="auth-label">
                    Month
                  </label>
                  <input
                    id="bs-dob-month"
                    type="text"
                    className="auth-input"
                    placeholder="MM"
                    value={form.dob_month}
                    onChange={(e) => update('dob_month', digitsOnly(e.target.value, 2))}
                    disabled={isSubmitting}
                    maxLength={2}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-dob-day" className="auth-label">
                    Day
                  </label>
                  <input
                    id="bs-dob-day"
                    type="text"
                    className="auth-input"
                    placeholder="DD"
                    value={form.dob_day}
                    onChange={(e) => update('dob_day', digitsOnly(e.target.value, 2))}
                    disabled={isSubmitting}
                    maxLength={2}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-dob-year" className="auth-label">
                    Year
                  </label>
                  <input
                    id="bs-dob-year"
                    type="text"
                    className="auth-input"
                    placeholder="YYYY"
                    value={form.dob_year}
                    onChange={(e) => update('dob_year', digitsOnly(e.target.value, 4))}
                    disabled={isSubmitting}
                    maxLength={4}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="business-setup__row">
                <div className="auth-input-group">
                  <label htmlFor="bs-ssn" className="auth-label">
                    SSN (9 digits)
                  </label>
                  <input
                    id="bs-ssn"
                    type="password"
                    className="auth-input"
                    placeholder="123456789"
                    value={form.tax_id}
                    onChange={(e) => update('tax_id', digitsOnly(e.target.value, 9))}
                    disabled={isSubmitting}
                    maxLength={9}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-ein" className="auth-label">
                    EIN (9 digits)
                  </label>
                  <input
                    id="bs-ein"
                    type="text"
                    className="auth-input"
                    placeholder="123456789"
                    value={form.business_tax_id}
                    onChange={(e) => update('business_tax_id', digitsOnly(e.target.value, 9))}
                    disabled={isSubmitting}
                    maxLength={9}
                    inputMode="numeric"
                  />
                </div>
              </div>

              {error && <div className="auth-error">{error}</div>}
              <div className="business-setup__nav">
                <button
                  type="button"
                  className="business-setup__nav-back"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="auth-submit-btn business-setup__nav-next"
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* ── Section: Entity Details ── */}
          {currentStep === 'entity' && (
            <>
              {IS_DEV && (
                <button
                  type="button"
                  className="business-setup__demo-btn"
                  onClick={fillDemo}
                  tabIndex={-1}
                >
                  Fill Demo Values
                </button>
              )}

              <div className="auth-input-group">
                <label htmlFor="bs-url" className="auth-label">
                  Business Website URL
                </label>
                <input
                  id="bs-url"
                  type="url"
                  className="auth-input"
                  placeholder="https://cornerstore.com"
                  value={form.url}
                  onChange={(e) => update('url', e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div className="business-setup__row">
                <div className="auth-input-group">
                  <label htmlFor="bs-ownership" className="auth-label">
                    Ownership %
                  </label>
                  <input
                    id="bs-ownership"
                    type="text"
                    className="auth-input"
                    placeholder="100"
                    value={form.ownership_pct}
                    onChange={(e) => update('ownership_pct', digitsOnly(e.target.value, 3))}
                    disabled={isSubmitting}
                    maxLength={3}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-annual-volume" className="auth-label">
                    Est. Annual Card Volume ($)
                  </label>
                  <input
                    id="bs-annual-volume"
                    type="text"
                    className="auth-input"
                    placeholder="150000"
                    value={form.annual_volume}
                    onChange={(e) =>
                      update('annual_volume', e.target.value.replace(/[^0-9.]/g, ''))
                    }
                    disabled={isSubmitting}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <p className="auth-label" style={{ marginBottom: '0.5rem' }}>
                Incorporation Date
              </p>
              <div className="business-setup__row--three">
                <div className="auth-input-group">
                  <label htmlFor="bs-inc-month" className="auth-label">
                    Month
                  </label>
                  <input
                    id="bs-inc-month"
                    type="text"
                    className="auth-input"
                    placeholder="MM"
                    value={form.inc_month}
                    onChange={(e) => update('inc_month', digitsOnly(e.target.value, 2))}
                    disabled={isSubmitting}
                    maxLength={2}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-inc-day" className="auth-label">
                    Day
                  </label>
                  <input
                    id="bs-inc-day"
                    type="text"
                    className="auth-input"
                    placeholder="DD"
                    value={form.inc_day}
                    onChange={(e) => update('inc_day', digitsOnly(e.target.value, 2))}
                    disabled={isSubmitting}
                    maxLength={2}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-inc-year" className="auth-label">
                    Year
                  </label>
                  <input
                    id="bs-inc-year"
                    type="text"
                    className="auth-input"
                    placeholder="YYYY"
                    value={form.inc_year}
                    onChange={(e) => update('inc_year', digitsOnly(e.target.value, 4))}
                    disabled={isSubmitting}
                    maxLength={4}
                    inputMode="numeric"
                  />
                </div>
              </div>

              {error && <div className="auth-error">{error}</div>}
              <div className="business-setup__nav">
                <button
                  type="button"
                  className="business-setup__nav-back"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="auth-submit-btn business-setup__nav-next"
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {/* ── Section: Bank Account ── */}
          {currentStep === 'bank' && (
            <>
              {IS_DEV && (
                <button
                  type="button"
                  className="business-setup__demo-btn"
                  onClick={fillDemo}
                  tabIndex={-1}
                >
                  Fill Demo Values
                </button>
              )}

              <div className="auth-input-group">
                <label htmlFor="bs-bank-name" className="auth-label">
                  Account Holder Name
                </label>
                <input
                  id="bs-bank-name"
                  type="text"
                  className="auth-input"
                  placeholder="Name on bank account"
                  value={form.bank_account_name}
                  onChange={(e) => update('bank_account_name', e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>

              <div className="business-setup__row">
                <div className="auth-input-group">
                  <label htmlFor="bs-routing" className="auth-label">
                    Routing Number
                  </label>
                  <input
                    id="bs-routing"
                    type="text"
                    className="auth-input"
                    placeholder="123456789"
                    value={form.bank_routing_number}
                    onChange={(e) => update('bank_routing_number', digitsOnly(e.target.value, 9))}
                    disabled={isSubmitting}
                    maxLength={9}
                    inputMode="numeric"
                  />
                </div>
                <div className="auth-input-group">
                  <label htmlFor="bs-account-number" className="auth-label">
                    Account Number
                  </label>
                  <input
                    id="bs-account-number"
                    type="text"
                    className="auth-input"
                    placeholder="Account number"
                    value={form.bank_account_number}
                    onChange={(e) =>
                      update('bank_account_number', e.target.value.replace(/\D/g, ''))
                    }
                    disabled={isSubmitting}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label htmlFor="bs-account-type" className="auth-label">
                  Account Type
                </label>
                <select
                  id="bs-account-type"
                  className="auth-input"
                  value={form.bank_account_type}
                  onChange={(e) =>
                    update('bank_account_type', e.target.value as FormState['bank_account_type'])
                  }
                  disabled={isSubmitting}
                >
                  <option value="BUSINESS_CHECKING">Business Checking</option>
                  <option value="BUSINESS_SAVINGS">Business Savings</option>
                  <option value="PERSONAL_CHECKING">Personal Checking</option>
                  <option value="PERSONAL_SAVINGS">Personal Savings</option>
                </select>
              </div>

              {error && <div className="auth-error">{error}</div>}
              <div className="business-setup__nav">
                <button
                  type="button"
                  className="business-setup__nav-back"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="auth-submit-btn business-setup__nav-next"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Activating payments...' : 'Activate Payment Processing'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
