import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorModal } from './ErrorModal'

describe('ErrorModal', () => {
  it('renders default title and message when open', () => {
    render(<ErrorModal isOpen={true} message="Something failed" onDismiss={vi.fn()} />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Something failed')).toBeInTheDocument()
    expect(screen.getByTestId('error-modal-ok')).toBeInTheDocument()
  })

  it('renders custom title', () => {
    render(<ErrorModal isOpen={true} title="Save Failed" message="Try again" onDismiss={vi.fn()} />)

    expect(screen.getByText('Save Failed')).toBeInTheDocument()
  })

  it('calls onDismiss when OK is clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorModal isOpen={true} message="Nope" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId('error-modal-ok'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when isOpen is false', () => {
    render(<ErrorModal isOpen={false} message="Hidden" onDismiss={vi.fn()} />)
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('calls onDismiss when Escape key is pressed', async () => {
    const onDismiss = vi.fn()
    render(<ErrorModal isOpen={true} message="Press esc" onDismiss={onDismiss} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })
})
