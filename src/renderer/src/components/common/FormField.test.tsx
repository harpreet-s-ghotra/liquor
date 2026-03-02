import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'

describe('FormField', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Name">
        <input aria-label="Name" />
      </FormField>
    )

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('shows required marker when required', () => {
    render(
      <FormField label="SKU" required>
        <input />
      </FormField>
    )

    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows error only when showError is true', () => {
    const { rerender } = render(
      <FormField label="SKU" error="SKU is required" showError={false}>
        <input />
      </FormField>
    )

    expect(screen.queryByText('SKU is required')).not.toBeInTheDocument()

    rerender(
      <FormField label="SKU" error="SKU is required" showError>
        <input />
      </FormField>
    )

    expect(screen.getByText('SKU is required')).toBeInTheDocument()
  })

  it('applies has-error class when error is shown', () => {
    render(
      <FormField label="Cost" error="Required" showError>
        <input />
      </FormField>
    )

    const label = screen.getByText('Cost').closest('label')
    expect(label?.className).toContain('has-error')
  })

  it('passes className', () => {
    render(
      <FormField label="Test" className="custom-class">
        <input />
      </FormField>
    )

    const label = screen.getByText('Test').closest('label')
    expect(label?.className).toContain('custom-class')
  })
})
