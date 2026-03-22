import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppButton } from './AppButton'

describe('AppButton', () => {
  it('renders default variant and size', () => {
    render(<AppButton>Default</AppButton>)

    const button = screen.getByRole('button', { name: 'Default' })
    expect(button).toBeInTheDocument()
    // Button uses BEM classes, verify it renders with the base class
    expect(button.className).toContain('btn')
  })

  it('renders success variant for save actions', () => {
    render(<AppButton variant="success">Save Item</AppButton>)

    const button = screen.getByRole('button', { name: 'Save Item' })
    expect(button.className).toContain('btn--success')
  })

  it('fires click handler when enabled and blocks when disabled', () => {
    const onClick = vi.fn()

    const { rerender } = render(<AppButton onClick={onClick}>Run</AppButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <AppButton onClick={onClick} disabled>
        Run
      </AppButton>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
