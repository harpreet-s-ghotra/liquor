import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CartItem } from '@renderer/types/pos'
import { TicketPanel } from './TicketPanel'

const cart: CartItem[] = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Cabernet Sauvignon 750ml',
    category: 'Wine',
    price: 19.99,
    quantity: 24,
    tax_rate: 0.13,
    lineQuantity: 1
  }
]

describe('TicketPanel', () => {
  it('renders ticket rows and forwards action handlers', () => {
    const setQuantity = vi.fn()
    const setSearch = vi.fn()
    const setSelectedCartId = vi.fn()
    const clearTransaction = vi.fn()
    const removeSelectedLine = vi.fn()

    render(
      <TicketPanel
        cart={cart}
        quantity="1"
        search=""
        selectedCartId={1}
        setQuantity={setQuantity}
        setSearch={setSearch}
        setSelectedCartId={setSelectedCartId}
        clearTransaction={clearTransaction}
        removeSelectedLine={removeSelectedLine}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Search item'), {
      target: { value: 'cab' }
    })
    expect(setSearch).toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('Qty'), {
      target: { value: '3' }
    })
    expect(setQuantity).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Cabernet Sauvignon/i }))
    expect(setSelectedCartId).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(removeSelectedLine).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Void' }))
    expect(clearTransaction).toHaveBeenCalledTimes(1)
  })

  it('shows empty ticket message when cart has no items', () => {
    render(
      <TicketPanel
        cart={[]}
        quantity="1"
        search=""
        selectedCartId={null}
        setQuantity={vi.fn()}
        setSearch={vi.fn()}
        setSelectedCartId={vi.fn()}
        clearTransaction={vi.fn()}
        removeSelectedLine={vi.fn()}
      />
    )

    expect(screen.getByText('No items in current transaction')).toBeInTheDocument()
  })
})
