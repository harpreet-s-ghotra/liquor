import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Separator } from './separator'

describe('Separator', () => {
  it('renders with default orientation', () => {
    const { container } = render(<Separator />)
    const el = container.querySelector('.separator')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('separator--horizontal')
  })
  it('renders with vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />)
    const el = container.querySelector('.separator')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('separator--vertical')
  })
})
