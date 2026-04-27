import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountPaymentModal } from './AccountPaymentModal'

describe('AccountPaymentModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AccountPaymentModal
        isOpen={false}
        total={20}
        services={['UberEats']}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the configured services as tiles when open', () => {
    render(
      <AccountPaymentModal
        isOpen={true}
        total={42.5}
        services={['UberEats', 'DoorDash']}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByTestId('account-payment-modal')).toBeInTheDocument()
    expect(screen.getByTestId('account-service-tile-UberEats')).toBeInTheDocument()
    expect(screen.getByTestId('account-service-tile-DoorDash')).toBeInTheDocument()
    // Total formatted via formatCurrency
    expect(screen.getByText('$42.50')).toBeInTheDocument()
  })

  it('shows an empty state when no services are configured', () => {
    render(
      <AccountPaymentModal
        isOpen={true}
        total={10}
        services={[]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByTestId('account-payment-modal-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('account-service-tiles')).not.toBeInTheDocument()
  })

  it('fires onSelect with the chosen service name', () => {
    const onSelect = vi.fn()
    render(
      <AccountPaymentModal
        isOpen={true}
        total={10}
        services={['UberEats', 'DoorDash']}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('account-service-tile-DoorDash'))
    expect(onSelect).toHaveBeenCalledWith('DoorDash')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('disables tiles after the first selection to prevent double-charging', () => {
    const onSelect = vi.fn()
    render(
      <AccountPaymentModal
        isOpen={true}
        total={10}
        services={['UberEats', 'DoorDash']}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('account-service-tile-UberEats'))
    fireEvent.click(screen.getByTestId('account-service-tile-DoorDash'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel when the close button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <AccountPaymentModal
        isOpen={true}
        total={10}
        services={['UberEats']}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const onCancel = vi.fn()
    render(
      <AccountPaymentModal
        isOpen={true}
        total={10}
        services={['UberEats']}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})
