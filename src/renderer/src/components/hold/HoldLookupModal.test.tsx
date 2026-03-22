import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HoldLookupModal } from './HoldLookupModal'
import type { HeldTransaction } from '../../../../shared/types'

const makeHeld = (overrides: Partial<HeldTransaction> = {}): HeldTransaction => ({
  id: 1,
  hold_number: 1,
  cart_snapshot: JSON.stringify([{ id: 1, sku: 'WINE-001', name: 'Test Wine', lineQuantity: 2 }]),
  transaction_discount_percent: 0,
  subtotal: 31.98,
  total: 34.54,
  item_count: 2,
  held_at: new Date('2026-03-21T14:30:00').toISOString(),
  ...overrides
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const defaultProps = () => ({
  isOpen: true as const,
  heldTransactions: [] as HeldTransaction[],
  onRecall: vi.fn(),
  onDelete: vi.fn(),
  onClearAll: vi.fn(),
  onClose: vi.fn()
})

describe('HoldLookupModal', () => {
  it('renders header when open', () => {
    render(<HoldLookupModal {...defaultProps()} />)
    expect(screen.getByText('Transaction Hold Lookup')).toBeInTheDocument()
  })

  it('shows empty state when no holds', () => {
    render(<HoldLookupModal {...defaultProps()} />)
    expect(screen.getByTestId('hold-lookup-empty')).toBeInTheDocument()
    expect(screen.getByText('No transactions on hold.')).toBeInTheDocument()
  })

  it('does not show Clear All button when empty', () => {
    render(<HoldLookupModal {...defaultProps()} />)
    expect(screen.queryByTestId('hold-clear-all-btn')).not.toBeInTheDocument()
  })

  it('renders a row for each held transaction', () => {
    const holds = [makeHeld({ hold_number: 1 }), makeHeld({ id: 2, hold_number: 2, total: 55.0 })]
    render(<HoldLookupModal {...defaultProps()} heldTransactions={holds} />)
    expect(screen.getByTestId('hold-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('hold-row-2')).toBeInTheDocument()
    expect(screen.getByText('Hold #1')).toBeInTheDocument()
    expect(screen.getByText('Hold #2')).toBeInTheDocument()
  })

  it('shows item count and total for each row', () => {
    render(
      <HoldLookupModal
        {...defaultProps()}
        heldTransactions={[makeHeld({ item_count: 3, total: 45.99 })]}
      />
    )
    expect(screen.getByText('3 items')).toBeInTheDocument()
    expect(screen.getByText('$45.99')).toBeInTheDocument()
  })

  it('uses singular "item" when item_count is 1', () => {
    render(<HoldLookupModal {...defaultProps()} heldTransactions={[makeHeld({ item_count: 1 })]} />)
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it('calls onRecall with the correct hold when a row is clicked', () => {
    const onRecall = vi.fn()
    const held = makeHeld()
    render(<HoldLookupModal {...defaultProps()} heldTransactions={[held]} onRecall={onRecall} />)
    fireEvent.click(screen.getByText('Hold #1'))
    expect(onRecall).toHaveBeenCalledWith(held)
  })

  it('shows "X on hold" badge when holds exist', () => {
    const holds = [makeHeld(), makeHeld({ id: 2, hold_number: 2 })]
    render(<HoldLookupModal {...defaultProps()} heldTransactions={holds} />)
    expect(screen.getByText('2 on hold')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<HoldLookupModal {...defaultProps()} isOpen={false} heldTransactions={[makeHeld()]} />)
    expect(screen.queryByText('Transaction Hold Lookup')).not.toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<HoldLookupModal {...defaultProps()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Clear All button when holds exist', () => {
    render(<HoldLookupModal {...defaultProps()} heldTransactions={[makeHeld()]} />)
    expect(screen.getByTestId('hold-clear-all-btn')).toBeInTheDocument()
  })

  it('calls onClearAll when Clear All button is clicked', () => {
    const onClearAll = vi.fn()
    render(
      <HoldLookupModal
        {...defaultProps()}
        heldTransactions={[makeHeld()]}
        onClearAll={onClearAll}
      />
    )
    fireEvent.click(screen.getByTestId('hold-clear-all-btn'))
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('renders a delete button for each held transaction', () => {
    const holds = [makeHeld({ hold_number: 1 }), makeHeld({ id: 2, hold_number: 2 })]
    render(<HoldLookupModal {...defaultProps()} heldTransactions={holds} />)
    expect(screen.getByTestId('hold-delete-1')).toBeInTheDocument()
    expect(screen.getByTestId('hold-delete-2')).toBeInTheDocument()
  })

  it('calls onDelete with the correct hold when delete button is clicked', () => {
    const onDelete = vi.fn()
    const held = makeHeld()
    render(<HoldLookupModal {...defaultProps()} heldTransactions={[held]} onDelete={onDelete} />)
    fireEvent.click(screen.getByTestId('hold-delete-1'))
    expect(onDelete).toHaveBeenCalledWith(held)
  })

  it('does not call onRecall when delete button is clicked', () => {
    const onRecall = vi.fn()
    const onDelete = vi.fn()
    render(
      <HoldLookupModal
        {...defaultProps()}
        heldTransactions={[makeHeld()]}
        onRecall={onRecall}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByTestId('hold-delete-1'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onRecall).not.toHaveBeenCalled()
  })
})
