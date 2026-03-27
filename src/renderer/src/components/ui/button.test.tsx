import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders a native button by default', () => {
    render(<Button>Pay</Button>)

    const button = screen.getByRole('button', { name: 'Pay' })
    expect(button.tagName).toBe('BUTTON')
    expect(button.className).toContain('btn--default')
    expect(button.className).toContain('btn--md')
  })

  it('renders child element when asChild is true', () => {
    render(
      <Button asChild variant="outline" size="icon">
        <a href="/receipt">Receipt</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Receipt' })
    expect(link.tagName).toBe('A')
    expect(link.className).toContain('btn')
    expect(link.className).toContain('btn--outline')
    expect(link.className).toContain('btn--icon')
  })
})
