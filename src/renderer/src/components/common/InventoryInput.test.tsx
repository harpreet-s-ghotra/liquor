import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InventoryInput, InventorySelect } from './InventoryInput'

describe('InventoryInput', () => {
  it('renders without error class by default', () => {
    render(<InventoryInput aria-label="Cost" />)

    const input = screen.getByLabelText('Cost')
    expect(input).toHaveClass('inventory-input')
    expect(input).not.toHaveClass('inventory-input--error')
  })

  it('applies error class when hasError is true', () => {
    render(<InventoryInput aria-label="Retail" hasError />)

    expect(screen.getByLabelText('Retail')).toHaveClass('inventory-input--error')
  })
})

describe('InventorySelect', () => {
  it('applies error class when hasError is true', () => {
    render(
      <InventorySelect aria-label="Department" hasError>
        <option value="1">Wine</option>
      </InventorySelect>
    )

    expect(screen.getByLabelText('Department')).toHaveClass('inventory-select--error')
  })
})
