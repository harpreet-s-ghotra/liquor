import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CustomerDisplaySnapshot } from '../../../shared/types'
import { CustomerDisplay } from './CustomerDisplay'

type SnapshotListener = (snapshot: CustomerDisplaySnapshot) => void

describe('CustomerDisplay', () => {
  let listener: SnapshotListener | null

  beforeEach(() => {
    listener = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      onCustomerSnapshot: (cb: SnapshotListener) => {
        listener = cb
        return () => {
          listener = null
        }
      }
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  const push = (snapshot: CustomerDisplaySnapshot): void => {
    act(() => {
      listener?.(snapshot)
    })
  }

  it('renders the empty cart message before any snapshot arrives', () => {
    render(<CustomerDisplay />)
    expect(screen.getByText('No items in current transaction')).toBeInTheDocument()
  })

  it('renders cart lines and totals from the latest snapshot', () => {
    render(<CustomerDisplay />)
    push({
      cart: [
        { id: 1, name: 'Cabernet', quantity: 2, unitPrice: 15.0, lineTotal: 30.0 },
        { id: 2, name: 'IPA 6-pack', quantity: 1, unitPrice: 12.5, lineTotal: 12.5 }
      ],
      subtotal: 42.5,
      tax: 5.53,
      total: 48.03
    })

    expect(screen.getByText('Cabernet')).toBeInTheDocument()
    expect(screen.getByText('IPA 6-pack')).toBeInTheDocument()
    // Sub-Total / Tax / Total values render via the action-panel totals box.
    expect(screen.getByText('$42.50')).toBeInTheDocument()
    expect(screen.getByText('$5.53')).toBeInTheDocument()
    expect(screen.getByText('$48.03')).toBeInTheDocument()
  })

  it('shows the surcharge row and a card-method grand total when paying by credit', () => {
    render(<CustomerDisplay />)
    push({
      cart: [{ id: 1, name: 'Wine', quantity: 1, unitPrice: 100, lineTotal: 100 }],
      subtotal: 100,
      tax: 0,
      total: 100,
      paymentMethod: 'credit',
      paymentStatus: 'processing-card',
      cardSurchargePercent: 3,
      surchargeAmount: 3,
      cardChargeAmount: 103
    })

    expect(screen.getByTestId('customer-display-surcharge-row')).toHaveTextContent('3%')
    expect(screen.getByText('Credit Total')).toBeInTheDocument()
    expect(screen.getByText('$103.00')).toBeInTheDocument()
    expect(screen.getByText(/processing card/i)).toBeInTheDocument()
  })

  it('falls back to the plain Total label when no card method is active', () => {
    render(<CustomerDisplay />)
    push({
      cart: [{ id: 1, name: 'Wine', quantity: 1, unitPrice: 10, lineTotal: 10 }],
      subtotal: 10,
      tax: 1,
      total: 11
    })
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.queryByTestId('customer-display-surcharge-row')).not.toBeInTheDocument()
  })

  it('renders a thank-you and change-due banner when payment completes with cash overpay', () => {
    render(<CustomerDisplay />)
    push({
      cart: [{ id: 1, name: 'Beer', quantity: 1, unitPrice: 43, lineTotal: 43 }],
      subtotal: 43,
      tax: 0,
      total: 43,
      paymentMethod: 'cash',
      paymentStatus: 'complete',
      changeDue: 7
    })
    const banner = screen.getByText(/thank you/i)
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('Change due: $7.00')
  })

  it('does not show change-due text on a complete card payment', () => {
    render(<CustomerDisplay />)
    push({
      cart: [{ id: 1, name: 'Beer', quantity: 1, unitPrice: 43, lineTotal: 43 }],
      subtotal: 43,
      tax: 0,
      total: 43,
      paymentMethod: 'credit',
      paymentStatus: 'complete'
    })
    const banner = screen.getByText(/thank you/i)
    expect(banner.textContent).not.toMatch(/change due/i)
  })
})
