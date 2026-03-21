import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ValidatedInput } from './ValidatedInput'
import { validateField } from './validation'

describe('ValidatedInput', () => {
  /* ── Rendering ── */
  it('renders with shadcn Input styling by default', () => {
    render(<ValidatedInput fieldType="text" value="" onChange={vi.fn()} aria-label="Field" />)
    const input = screen.getByLabelText('Field')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('merges additional className', () => {
    render(
      <ValidatedInput
        fieldType="text"
        value=""
        onChange={vi.fn()}
        className="extra"
        aria-label="Field"
      />
    )
    const input = screen.getByLabelText('Field')
    expect(input.className).toContain('extra')
  })

  it('passes through native props like placeholder and autoFocus', () => {
    render(
      <ValidatedInput
        fieldType="text"
        value=""
        onChange={vi.fn()}
        placeholder="Type here"
        aria-label="Field"
      />
    )
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  /* ── text type ── */
  it('fires onChange with raw value for text type', () => {
    const onChange = vi.fn()
    render(<ValidatedInput fieldType="text" value="" onChange={onChange} aria-label="Field" />)
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  /* ── name type ── */
  it('fires onChange with raw value for name type', () => {
    const onChange = vi.fn()
    render(<ValidatedInput fieldType="name" value="" onChange={onChange} aria-label="Field" />)
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'Acme Corp' } })
    expect(onChange).toHaveBeenCalledWith('Acme Corp')
  })

  /* ── sku type ── */
  it('sanitizes SKU input to uppercase letters, numbers, hyphens only', () => {
    const onChange = vi.fn()
    render(<ValidatedInput fieldType="sku" value="" onChange={onChange} aria-label="SKU" />)
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'wine@001!' } })
    expect(onChange).toHaveBeenCalledWith('WINE001')
  })

  it('preserves valid SKU characters', () => {
    const onChange = vi.fn()
    render(<ValidatedInput fieldType="sku" value="" onChange={onChange} aria-label="SKU" />)
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'BEER-123' } })
    expect(onChange).toHaveBeenCalledWith('BEER-123')
  })

  it('sets maxLength for SKU type', () => {
    render(<ValidatedInput fieldType="sku" value="" onChange={vi.fn()} aria-label="SKU" />)
    expect(screen.getByLabelText('SKU')).toHaveAttribute('maxlength', '64')
  })

  /* ── phone type ── */
  it('sets inputMode to tel for phone type', () => {
    render(<ValidatedInput fieldType="phone" value="" onChange={vi.fn()} aria-label="Phone" />)
    expect(screen.getByLabelText('Phone')).toHaveAttribute('inputmode', 'tel')
  })

  it('fires onChange with raw value for phone type (no sanitization)', () => {
    const onChange = vi.fn()
    render(<ValidatedInput fieldType="phone" value="" onChange={onChange} aria-label="Phone" />)
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '(555) 123-4567' } })
    expect(onChange).toHaveBeenCalledWith('(555) 123-4567')
  })

  /* ── email type ── */
  it('fires onChange with raw value for email type', () => {
    const onChange = vi.fn()
    render(<ValidatedInput fieldType="email" value="" onChange={onChange} aria-label="Email" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    expect(onChange).toHaveBeenCalledWith('test@example.com')
  })

  /* ── integer type ── */
  it('sets inputMode to numeric for integer type', () => {
    render(<ValidatedInput fieldType="integer" value="" onChange={vi.fn()} aria-label="Stock" />)
    expect(screen.getByLabelText('Stock')).toHaveAttribute('inputmode', 'numeric')
  })

  /* ── decimal type ── */
  it('sets inputMode to decimal for decimal type', () => {
    render(<ValidatedInput fieldType="decimal" value="" onChange={vi.fn()} aria-label="Rate" />)
    expect(screen.getByLabelText('Rate')).toHaveAttribute('inputmode', 'decimal')
  })

  /* ── inputMode / maxLength overrides ── */
  it('allows overriding inputMode and maxLength', () => {
    render(
      <ValidatedInput
        fieldType="sku"
        value=""
        onChange={vi.fn()}
        inputMode="text"
        maxLength={10}
        aria-label="SKU"
      />
    )
    const input = screen.getByLabelText('SKU')
    expect(input).toHaveAttribute('inputmode', 'text')
    expect(input).toHaveAttribute('maxlength', '10')
  })

  /* ── onKeyDown passthrough ── */
  it('forwards onKeyDown events', () => {
    const onKeyDown = vi.fn()
    render(
      <ValidatedInput
        fieldType="text"
        value=""
        onChange={vi.fn()}
        onKeyDown={onKeyDown}
        aria-label="Field"
      />
    )
    fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})

describe('validateField', () => {
  /* ── Required check ── */
  it('returns Required for empty required field', () => {
    expect(validateField('text', '', { required: true })).toBe('Required')
    expect(validateField('text', '  ', { required: true })).toBe('Required')
  })

  it('returns undefined for empty non-required field', () => {
    expect(validateField('text', '')).toBeUndefined()
    expect(validateField('email', '')).toBeUndefined()
    expect(validateField('phone', '')).toBeUndefined()
  })

  /* ── text type ── */
  it('returns undefined for any text value', () => {
    expect(validateField('text', 'anything goes')).toBeUndefined()
    expect(validateField('text', 'anything goes', { required: false })).toBeUndefined()
  })

  /* ── name type ── */
  it('returns undefined for valid name', () => {
    expect(validateField('name', 'Acme Corp')).toBeUndefined()
  })

  it('returns error for name exceeding 120 chars', () => {
    expect(validateField('name', 'A'.repeat(121))).toBe('Must be 120 characters or less')
  })

  it('passes for name at exactly 120 chars', () => {
    expect(validateField('name', 'A'.repeat(120))).toBeUndefined()
  })

  /* ── email type ── */
  it('returns undefined for valid email', () => {
    expect(validateField('email', 'test@example.com')).toBeUndefined()
    expect(validateField('email', 'user.name+tag@sub.domain.co')).toBeUndefined()
  })

  it('returns error for invalid email', () => {
    expect(validateField('email', 'not-an-email')).toBe('Invalid email format')
    expect(validateField('email', 'missing@')).toBe('Invalid email format')
    expect(validateField('email', '@no-user.com')).toBe('Invalid email format')
  })

  it('skips email validation on empty string', () => {
    expect(validateField('email', '')).toBeUndefined()
    expect(validateField('email', '  ')).toBeUndefined()
  })

  /* ── phone type ── */
  it('returns undefined for valid phone formats', () => {
    expect(validateField('phone', '555-123-4567')).toBeUndefined()
    expect(validateField('phone', '(555) 123-4567')).toBeUndefined()
    expect(validateField('phone', '+1 555 1234567')).toBeUndefined()
    expect(validateField('phone', '5551234567')).toBeUndefined()
  })

  it('returns error for phone with too few digits', () => {
    expect(validateField('phone', '555-12')).toBe('Must have at least 7 digits')
  })

  it('returns error for phone with invalid characters', () => {
    expect(validateField('phone', '555-WINE')).toBe('Only digits, spaces, +, -, (, ) allowed')
  })

  it('skips phone validation on empty string', () => {
    expect(validateField('phone', '')).toBeUndefined()
    expect(validateField('phone', '  ')).toBeUndefined()
  })

  /* ── sku type ── */
  it('returns undefined for valid SKU', () => {
    expect(validateField('sku', 'WINE-001')).toBeUndefined()
    expect(validateField('sku', 'ABC123')).toBeUndefined()
  })

  it('returns error for SKU with invalid chars', () => {
    expect(validateField('sku', 'WINE@001')).toBe('Only letters, numbers, and hyphens')
  })

  it('returns error for SKU exceeding 64 chars', () => {
    expect(validateField('sku', 'A'.repeat(65))).toBe('Must be 64 characters or less')
  })

  it('skips SKU validation on empty string', () => {
    expect(validateField('sku', '')).toBeUndefined()
  })

  /* ── integer type ── */
  it('returns undefined for valid integers', () => {
    expect(validateField('integer', '42')).toBeUndefined()
    expect(validateField('integer', '-5')).toBeUndefined()
    expect(validateField('integer', '0')).toBeUndefined()
  })

  it('returns error for non-integer values', () => {
    expect(validateField('integer', '3.14')).toBe('Must be a whole number')
    expect(validateField('integer', 'abc')).toBe('Must be a whole number')
  })

  it('skips integer validation on empty string', () => {
    expect(validateField('integer', '')).toBeUndefined()
  })

  /* ── decimal type ── */
  it('returns undefined for valid decimals', () => {
    expect(validateField('decimal', '13.5')).toBeUndefined()
    expect(validateField('decimal', '0')).toBeUndefined()
    expect(validateField('decimal', '-2.5')).toBeUndefined()
  })

  it('returns error for non-numeric decimal values', () => {
    expect(validateField('decimal', 'abc')).toBe('Must be a number')
  })

  it('skips decimal validation on empty string', () => {
    expect(validateField('decimal', '')).toBeUndefined()
  })
})
