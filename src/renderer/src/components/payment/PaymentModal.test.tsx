import { fireEvent, render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { PaymentModal } from './PaymentModal'

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when not open', () => {
    const { container } = render(
      <PaymentModal isOpen={false} total={22.59} onComplete={vi.fn()} onCancel={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the payment modal with total and empty paid-so-far', () => {
    render(<PaymentModal isOpen={true} total={22.59} onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText('Payment')).toBeInTheDocument()
    expect(screen.getByText('Transaction Total')).toBeInTheDocument()
    const totalBar = screen.getByText('Transaction Total').closest('.payment-total-bar')!
    expect(totalBar).toHaveTextContent('$22.59')
    expect(screen.getByText('No payments yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cash (Exact)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Credit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Debit' })).toBeEnabled()
  })

  it('shows correct remaining amount', () => {
    render(<PaymentModal isOpen={true} total={17.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('Remaining: $17.00')
  })

  it('handles cash exact payment and calls onComplete via OK button', () => {
    const onComplete = vi.fn()
    render(<PaymentModal isOpen={true} total={10.0} onComplete={onComplete} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cash (Exact)' }))

    expect(screen.getByTestId('payment-complete')).toHaveTextContent('Payment complete!')
    expect(screen.getByTestId('paid-so-far-list')).toHaveTextContent('$10.00 Cash (Exact)')

    // Modal stays open until OK is clicked
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByTestId('payment-ok-btn')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('payment-ok-btn'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('handles credit card payment with processing state', () => {
    const onComplete = vi.fn()
    render(<PaymentModal isOpen={true} total={15.0} onComplete={onComplete} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

    expect(screen.getByTestId('payment-processing')).toHaveTextContent('Processing card payment...')
    // Buttons should be disabled during processing
    expect(screen.getByRole('button', { name: 'Cash (Exact)' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    // Advance past the card processing delay
    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(screen.getByTestId('payment-complete')).toHaveTextContent('Payment complete!')

    // Modal stays open until OK is clicked
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('payment-ok-btn'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('handles debit card payment', () => {
    const onComplete = vi.fn()
    render(<PaymentModal isOpen={true} total={8.5} onComplete={onComplete} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Debit' }))
    expect(screen.getByTestId('payment-processing')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('payment-ok-btn'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('accumulates tender denominations and shows change', () => {
    const onComplete = vi.fn()
    render(<PaymentModal isOpen={true} total={17.0} onComplete={onComplete} onCancel={vi.fn()} />)

    // Click $10 tender
    fireEvent.click(screen.getByRole('button', { name: '$10' }))
    expect(screen.getByTestId('paid-so-far-list')).toHaveTextContent('$10.00 Cash')

    // Click $5 tender
    fireEvent.click(screen.getByRole('button', { name: '$5' }))
    expect(screen.getByTestId('paid-so-far-list')).toHaveTextContent('$5.00 Cash')

    // Not yet fully paid
    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('Remaining: $2.00')

    // Click another $5 tender — now we've paid $20 on a $17 total
    fireEvent.click(screen.getByRole('button', { name: '$5' }))

    // Check complete and change
    expect(screen.getByTestId('payment-complete')).toHaveTextContent('Change: $3.00')

    // Modal stays open — click OK
    fireEvent.click(screen.getByTestId('payment-ok-btn'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('supports split payment: partial cash then card', () => {
    const onComplete = vi.fn()
    render(<PaymentModal isOpen={true} total={25.0} onComplete={onComplete} onCancel={vi.fn()} />)

    // Pay $10 cash via tender
    fireEvent.click(screen.getByRole('button', { name: '$10' }))
    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('Remaining: $15.00')

    // Pay remaining via credit
    fireEvent.click(screen.getByRole('button', { name: 'Credit' }))
    expect(screen.getByTestId('payment-processing')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(screen.getByTestId('payment-complete')).toBeInTheDocument()

    // Should have 2 entries in paid-so-far
    const paidList = screen.getByTestId('paid-so-far-list')
    expect(paidList).toHaveTextContent('$10.00 Cash')
    expect(paidList).toHaveTextContent('$15.00 Credit')

    // Modal stays open — click OK
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('payment-ok-btn'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('cancel calls onCancel and resets state', () => {
    const onCancel = vi.fn()
    render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders all seven tender denomination buttons', () => {
    render(<PaymentModal isOpen={true} total={50.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

    for (const amount of [1, 2, 5, 10, 20, 50, 100]) {
      expect(screen.getByRole('button', { name: `$${amount}` })).toBeInTheDocument()
    }
  })

  it('disables tender buttons when remaining is zero', () => {
    const onComplete = vi.fn()
    render(<PaymentModal isOpen={true} total={5.0} onComplete={onComplete} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '$5' }))

    // After exact pay, all tenders should be disabled
    for (const amount of [1, 2, 5, 10, 20, 50, 100]) {
      expect(screen.getByRole('button', { name: `$${amount}` })).toBeDisabled()
    }
  })
})
