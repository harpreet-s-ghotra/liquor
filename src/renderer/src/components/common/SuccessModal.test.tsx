import { fireEvent, render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SuccessModal } from './SuccessModal'

describe('SuccessModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders title and message when open', () => {
    render(
      <SuccessModal isOpen={true} title="Saved" message="Settings stored" onDismiss={vi.fn()} />
    )

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Settings stored')).toBeInTheDocument()
    expect(screen.getByTestId('success-modal-ok')).toBeInTheDocument()
  })

  it('calls onDismiss when OK is clicked', () => {
    const onDismiss = vi.fn()
    render(<SuccessModal isOpen={true} message="Done" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId('success-modal-ok'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after timeout', () => {
    const onDismiss = vi.fn()
    render(<SuccessModal isOpen={true} message="Done" onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
