import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { PaymentModal } from './PaymentModal'

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Default: no terminal API (no merchant activated)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {}
  })

  afterEach(() => {
    vi.useRealTimers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
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
    const totalLabel = screen.getByText('Transaction Total')
    expect(totalLabel.parentElement).toHaveTextContent('$22.59')
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

  // ── initialMethod auto-trigger tests ──

  it('auto-triggers cash exact payment when initialMethod is cash', () => {
    const onComplete = vi.fn()
    render(
      <PaymentModal
        isOpen={true}
        total={10.0}
        initialMethod="cash"
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    )

    // Flush the deferred setTimeout(…, 0) that auto-triggers the payment
    act(() => {
      vi.advanceTimersByTime(1)
    })

    // Should immediately show payment complete (cash is instant)
    expect(screen.getByTestId('payment-complete')).toHaveTextContent('Payment complete!')
    expect(screen.getByTestId('paid-so-far-list')).toHaveTextContent('$10.00 Cash (Exact)')
  })

  it('does not auto-trigger when no initialMethod is provided', () => {
    render(<PaymentModal isOpen={true} total={20.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

    // Should show idle state with remaining
    expect(screen.getByTestId('payment-remaining')).toHaveTextContent('Remaining: $20.00')
    expect(screen.queryByTestId('payment-processing')).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-complete')).not.toBeInTheDocument()
  })

  // ── Finix card payment tests ──

  describe('with Finix card API (finixChargeCard)', () => {
    const mockFinixChargeCard = vi.fn()

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api = { finixChargeCard: mockFinixChargeCard }
      mockFinixChargeCard.mockReset()
    })

    it('shows processing spinner when Credit is clicked', async () => {
      vi.useRealTimers()
      // Never resolve to keep spinner visible
      mockFinixChargeCard.mockReturnValue(new Promise(() => {}))

      render(<PaymentModal isOpen={true} total={22.59} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('payment-processing')).toBeInTheDocument()
        expect(screen.getByTestId('payment-processing')).toHaveTextContent('Processing payment...')
      })
    })

    it('shows processing spinner when Debit is clicked', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockReturnValue(new Promise(() => {}))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Debit' }))

      await waitFor(() => {
        expect(screen.getByTestId('payment-processing')).toBeInTheDocument()
      })
    })

    it('calls finixChargeCard and shows success on approved charge', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: 'AU-123',
        transfer_id: 'TR-123',
        success: true,
        last_four: '1111',
        card_type: 'visa',
        total: 22.59,
        message: 'Approved',
        status: 'approved'
      })

      const onComplete = vi.fn()
      render(
        <PaymentModal isOpen={true} total={22.59} onComplete={onComplete} onCancel={vi.fn()} />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      // Should show processing first
      await waitFor(() => {
        expect(screen.getByTestId('payment-processing')).toBeInTheDocument()
      })

      // Then complete
      await waitFor(() => {
        expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      })

      expect(mockFinixChargeCard).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 22.59,
          card_number: '4111111111111111'
        })
      )

      const paidList = screen.getByTestId('paid-so-far-list')
      expect(paidList).toHaveTextContent('Credit')
      expect(paidList).toHaveTextContent('visa')
      expect(paidList).toHaveTextContent('1111')
    })

    it('shows friendly error on declined charge', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: '',
        transfer_id: '',
        success: false,
        last_four: '',
        card_type: 'unknown',
        total: 10.0,
        message: 'Card declined',
        status: 'declined'
      })

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toHaveTextContent(
          'Card declined. Please try a different card or payment method.'
        )
      })
    })

    it('shows generic error for long unknown error messages', async () => {
      vi.useRealTimers()
      const longMsg = 'Something completely unexpected happened in the payment system at layer 7'
      mockFinixChargeCard.mockRejectedValue(new Error(longMsg))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toHaveTextContent(
          'Payment failed. Please try again or use another payment method.'
        )
      })
    })

    it('passes through short unknown error messages as-is', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockRejectedValue(new Error('Try again'))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toHaveTextContent('Try again')
      })
    })

    it('shows friendly error on API failure', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockRejectedValue(new Error('No terminal devices found'))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toHaveTextContent(
          'Card reader not connected. Please check your terminal and try again.'
        )
      })
    })

    it('shows friendly error on timeout', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: '',
        transfer_id: '',
        success: false,
        last_four: '',
        card_type: 'unknown',
        total: 10.0,
        message: 'Terminal timed out — no response from card reader',
        status: 'error'
      })

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toHaveTextContent(
          'No response from the card reader. Please try again.'
        )
      })
    })

    it('dismiss button clears card error', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockRejectedValue(new Error('Connection refused'))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('card-retry-btn'))

      expect(screen.queryByTestId('card-error')).not.toBeInTheDocument()
    })

    it('card error is cleared when Cash (Exact) is clicked', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockRejectedValue(new Error('No terminal devices found'))

      const onComplete = vi.fn()
      render(<PaymentModal isOpen={true} total={10.0} onComplete={onComplete} onCancel={vi.fn()} />)

      // Trigger a card error
      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))
      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toBeInTheDocument()
      })

      // Click Cash (Exact) — error should disappear and payment should complete
      fireEvent.click(screen.getByRole('button', { name: 'Cash (Exact)' }))

      expect(screen.queryByTestId('card-error')).not.toBeInTheDocument()
      expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
    })

    it('card error is cleared when a tender denomination is clicked', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockRejectedValue(new Error('No terminal devices found'))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      // Trigger a card error
      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))
      await waitFor(() => {
        expect(screen.getByTestId('card-error')).toBeInTheDocument()
      })

      // Click $10 tender — error should disappear
      fireEvent.click(screen.getByRole('button', { name: '$10' }))

      expect(screen.queryByTestId('card-error')).not.toBeInTheDocument()
    })

    it('supports split payment: partial cash then credit card', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: 'AU-split',
        transfer_id: 'TR-split',
        success: true,
        last_four: '4444',
        card_type: 'mastercard',
        total: 15.0,
        message: 'Approved',
        status: 'approved'
      })

      const onComplete = vi.fn()
      render(<PaymentModal isOpen={true} total={25.0} onComplete={onComplete} onCancel={vi.fn()} />)

      // Pay $10 cash
      fireEvent.click(screen.getByRole('button', { name: '$10' }))
      expect(screen.getByTestId('payment-remaining')).toHaveTextContent('$15.00')

      // Pay remaining with credit card
      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      })

      const paidList = screen.getByTestId('paid-so-far-list')
      expect(paidList).toHaveTextContent('$10.00 Cash')
      expect(paidList).toHaveTextContent('mastercard')
    })

    it('auto-triggers credit card when initialMethod is credit', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: 'AU-auto',
        transfer_id: 'TR-auto',
        success: true,
        last_four: '9999',
        card_type: 'visa',
        total: 15.0,
        message: 'Approved',
        status: 'approved'
      })

      const onComplete = vi.fn()
      render(
        <PaymentModal
          isOpen={true}
          total={15.0}
          initialMethod="credit"
          onComplete={onComplete}
          onCancel={vi.fn()}
        />
      )

      // Wait for processing and completion
      await waitFor(() => {
        expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      })

      expect(mockFinixChargeCard).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 15.0,
          card_number: '4111111111111111'
        })
      )
    })

    it('auto-triggers debit card when initialMethod is debit', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: 'AU-debit',
        transfer_id: 'TR-debit',
        success: true,
        last_four: '5555',
        card_type: 'mastercard',
        total: 8.5,
        message: 'Approved',
        status: 'approved'
      })

      render(
        <PaymentModal
          isOpen={true}
          total={8.5}
          initialMethod="debit"
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      })

      expect(mockFinixChargeCard).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 8.5,
          card_number: '5555555555554444'
        })
      )
    })

    it('disables Cancel while processing card', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockReturnValue(new Promise(() => {}))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('payment-processing')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })

    it('disables payment method buttons while processing', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockReturnValue(new Promise(() => {}))

      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('payment-processing')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: 'Cash (Exact)' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Credit' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Debit' })).toBeDisabled()
    })

    it('completes transaction and returns result with finix_authorization_id via OK button', async () => {
      vi.useRealTimers()
      mockFinixChargeCard.mockResolvedValue({
        authorization_id: 'AU-ok',
        transfer_id: 'TR-ok',
        success: true,
        last_four: '4242',
        card_type: 'visa',
        total: 10.0,
        message: 'Approved',
        status: 'approved'
      })

      const onComplete = vi.fn()
      render(<PaymentModal isOpen={true} total={10.0} onComplete={onComplete} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Credit' }))

      await waitFor(() => {
        expect(screen.getByTestId('payment-ok-btn')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('payment-ok-btn'))

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'credit',
          finix_authorization_id: 'AU-ok',
          card_last_four: '4242',
          card_type: 'visa'
        })
      )
    })
  })

  // ── Print Receipt button tests ──

  describe('Print Receipt button', () => {
    it('shows Print Receipt button alongside OK when alwaysPrint is false (default)', () => {
      render(<PaymentModal isOpen={true} total={10.0} onComplete={vi.fn()} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Cash (Exact)' }))

      expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      expect(screen.getByTestId('payment-print-btn')).toBeInTheDocument()
      expect(screen.getByTestId('payment-ok-btn')).toBeInTheDocument()
    })

    it('does not show Print Receipt button when alwaysPrint is true', () => {
      render(
        <PaymentModal
          isOpen={true}
          total={10.0}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          alwaysPrint={true}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Cash (Exact)' }))

      expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      expect(screen.queryByTestId('payment-print-btn')).not.toBeInTheDocument()
      expect(screen.getByTestId('payment-ok-btn')).toBeInTheDocument()
    })

    it('does not show Print Receipt button in refund mode', () => {
      render(
        <PaymentModal
          isOpen={true}
          total={10.0}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          isRefund={true}
          initialMethod="cash"
        />
      )

      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(screen.getByTestId('payment-complete')).toBeInTheDocument()
      expect(screen.queryByTestId('payment-print-btn')).not.toBeInTheDocument()
    })

    it('clicking Print Receipt calls onComplete with shouldPrint: true', () => {
      const onComplete = vi.fn()
      render(<PaymentModal isOpen={true} total={10.0} onComplete={onComplete} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Cash (Exact)' }))
      fireEvent.click(screen.getByTestId('payment-print-btn'))

      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ shouldPrint: true }))
    })

    it('clicking OK calls onComplete with shouldPrint: false', () => {
      const onComplete = vi.fn()
      render(<PaymentModal isOpen={true} total={10.0} onComplete={onComplete} onCancel={vi.fn()} />)

      fireEvent.click(screen.getByRole('button', { name: 'Cash (Exact)' }))
      fireEvent.click(screen.getByTestId('payment-ok-btn'))

      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ shouldPrint: false }))
    })
  })

  describe('refund mode', () => {
    it('shows "Process Refund" header and refund amount when isRefund', () => {
      render(
        <PaymentModal
          isOpen={true}
          total={15.0}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
          isRefund={true}
          initialMethod="cash"
        />
      )

      expect(screen.getByText('Process Refund')).toBeInTheDocument()
      expect(screen.getByText('Refund Amount')).toBeInTheDocument()
      expect(screen.getByText('($15.00)')).toBeInTheDocument()
    })

    it('auto-completes refund immediately and shows refund message', () => {
      const onComplete = vi.fn()
      render(
        <PaymentModal
          isOpen={true}
          total={25.5}
          onComplete={onComplete}
          onCancel={vi.fn()}
          isRefund={true}
          initialMethod="cash"
        />
      )

      // Flush the deferred setTimeout(…, 0) that auto-triggers the refund
      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(screen.getByTestId('payment-complete')).toHaveTextContent(
        'Refund of $25.50 processed!'
      )

      fireEvent.click(screen.getByTestId('payment-ok-btn'))
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('auto-completes credit refund', () => {
      const onComplete = vi.fn()
      render(
        <PaymentModal
          isOpen={true}
          total={9.99}
          onComplete={onComplete}
          onCancel={vi.fn()}
          isRefund={true}
          initialMethod="credit"
        />
      )

      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(screen.getByTestId('payment-complete')).toHaveTextContent('Refund of $9.99 processed!')

      fireEvent.click(screen.getByTestId('payment-ok-btn'))
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ method: 'credit' }))
    })
  })
})
