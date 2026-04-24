import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from './badge'

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>)
    const el = screen.getByText('Default')
    expect(el).toHaveClass('badge', 'badge--default')
  })
  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warn</Badge>)
    const el = screen.getByText('Warn')
    expect(el).toHaveClass('badge--warning')
  })
  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>)
    const el = screen.getByText('Success')
    expect(el).toHaveClass('badge--success')
  })
  it('renders with danger variant', () => {
    render(<Badge variant="danger">Danger</Badge>)
    const el = screen.getByText('Danger')
    expect(el).toHaveClass('badge--danger')
  })
  it('applies custom className', () => {
    render(<Badge className="custom">Custom</Badge>)
    const el = screen.getByText('Custom')
    expect(el).toHaveClass('custom')
  })
})
