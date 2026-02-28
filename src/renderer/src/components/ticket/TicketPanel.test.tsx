import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CartItem, TransactionDiscountItem } from '@renderer/types/pos'
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

const cartWithTransactionDiscount: Array<CartItem | TransactionDiscountItem> = [
  ...cart,
  {
    id: -1,
    kind: 'transaction-discount',
    name: '20% Discount',
    lineQuantity: 1,
    price: -20,
    discountRate: 20
  }
]

describe('TicketPanel', () => {
  it('renders ticket rows and forwards action handlers', () => {
    const applyDiscount = vi.fn()
    const setQuantity = vi.fn()
    const setSearch = vi.fn()
    const setSelectedCartId = vi.fn()
    const clearTransaction = vi.fn()
    const removeSelectedLine = vi.fn()
    const updateSelectedLinePrice = vi.fn()
    const updateSelectedLineQuantity = vi.fn()

    render(
      <TicketPanel
        applyDiscount={applyDiscount}
        cart={cart}
        quantity="1"
        search=""
        selectedCartId={1}
        selectedCartItem={cart[0]}
        transactionDiscountPercent={0}
        updateSelectedLinePrice={updateSelectedLinePrice}
        updateSelectedLineQuantity={updateSelectedLineQuantity}
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

    fireEvent.click(screen.getByRole('button', { name: 'Qty Change' }))
    expect(screen.getByText('Original Qty: 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateSelectedLineQuantity).toHaveBeenCalledWith(4)

    fireEvent.click(screen.getByRole('button', { name: 'Price Change' }))
    expect(screen.getByText('Original Price: $19.99')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateSelectedLinePrice).toHaveBeenCalledWith(12.5)

    fireEvent.click(screen.getByRole('button', { name: 'Price Change' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateSelectedLinePrice).toHaveBeenCalledWith(9.99)

    fireEvent.click(screen.getByRole('button', { name: 'Discount' }))
    expect(screen.getByText('Original Discount: 0.00%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(applyDiscount).toHaveBeenCalledWith(10, 'item')
  })

  it('shows empty ticket message when cart has no items', () => {
    render(
      <TicketPanel
        applyDiscount={vi.fn()}
        cart={[]}
        quantity="1"
        search=""
        selectedCartId={null}
        selectedCartItem={null}
        transactionDiscountPercent={0}
        updateSelectedLinePrice={vi.fn()}
        updateSelectedLineQuantity={vi.fn()}
        setQuantity={vi.fn()}
        setSearch={vi.fn()}
        setSelectedCartId={vi.fn()}
        clearTransaction={vi.fn()}
        removeSelectedLine={vi.fn()}
      />
    )

    expect(screen.getByText('No items in current transaction')).toBeInTheDocument()
  })

  it('supports transaction discount mode and canceling modal actions', () => {
    const applyDiscount = vi.fn()

    render(
      <TicketPanel
        applyDiscount={applyDiscount}
        cart={cart}
        quantity="1"
        search=""
        selectedCartId={null}
        selectedCartItem={null}
        transactionDiscountPercent={5}
        updateSelectedLinePrice={vi.fn()}
        updateSelectedLineQuantity={vi.fn()}
        setQuantity={vi.fn()}
        setSearch={vi.fn()}
        setSelectedCartId={vi.fn()}
        clearTransaction={vi.fn()}
        removeSelectedLine={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Discount' }))
    expect(screen.getByText('Original Discount: 5.00%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByLabelText('Entire Transaction'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(applyDiscount).toHaveBeenCalledWith(7, 'transaction')

    fireEvent.click(screen.getByRole('button', { name: 'Discount' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
  })

  it('renders transaction discount line and allows selecting/deleting it while qty change stays disabled', () => {
    const setSelectedCartId = vi.fn()
    const removeSelectedLine = vi.fn()

    render(
      <TicketPanel
        applyDiscount={vi.fn()}
        cart={cartWithTransactionDiscount}
        quantity="1"
        search=""
        selectedCartId={-1}
        selectedCartItem={cartWithTransactionDiscount[1]}
        transactionDiscountPercent={20}
        updateSelectedLinePrice={vi.fn()}
        updateSelectedLineQuantity={vi.fn()}
        setQuantity={vi.fn()}
        setSearch={vi.fn()}
        setSelectedCartId={setSelectedCartId}
        clearTransaction={vi.fn()}
        removeSelectedLine={removeSelectedLine}
      />
    )

    const discountLine = screen.getByRole('button', { name: /20% Discount/i })
    expect(discountLine).toHaveClass('transaction-discount-line')
    expect(discountLine).toContainHTML('-$20.00')
    expect(screen.getByRole('button', { name: 'Qty Change' })).toBeDisabled()

    fireEvent.click(discountLine)
    expect(setSelectedCartId).toHaveBeenCalledWith(-1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(removeSelectedLine).toHaveBeenCalledTimes(1)
  })

  it('replaces original qty on first keypad press and supports discount decimals', () => {
    const updateSelectedLineQuantity = vi.fn()
    const applyDiscount = vi.fn()

    render(
      <TicketPanel
        applyDiscount={applyDiscount}
        cart={cart}
        quantity="1"
        search=""
        selectedCartId={1}
        selectedCartItem={cart[0]}
        transactionDiscountPercent={0}
        updateSelectedLinePrice={vi.fn()}
        updateSelectedLineQuantity={updateSelectedLineQuantity}
        setQuantity={vi.fn()}
        setSearch={vi.fn()}
        setSelectedCartId={vi.fn()}
        clearTransaction={vi.fn()}
        removeSelectedLine={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Qty Change' }))
    expect(within(screen.getByTestId('edit-modal')).getByDisplayValue('1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateSelectedLineQuantity).toHaveBeenCalledWith(3)

    fireEvent.click(screen.getByRole('button', { name: 'Discount' }))
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '.' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(applyDiscount).toHaveBeenCalledWith(10.5, 'item')
  })

  it('supports price keypad backspace and clear controls', () => {
    const updateSelectedLinePrice = vi.fn()

    render(
      <TicketPanel
        applyDiscount={vi.fn()}
        cart={cart}
        quantity="1"
        search=""
        selectedCartId={1}
        selectedCartItem={cart[0]}
        transactionDiscountPercent={0}
        updateSelectedLinePrice={updateSelectedLinePrice}
        updateSelectedLineQuantity={vi.fn()}
        setQuantity={vi.fn()}
        setSearch={vi.fn()}
        setSelectedCartId={vi.fn()}
        clearTransaction={vi.fn()}
        removeSelectedLine={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Price Change' }))
    fireEvent.click(screen.getByRole('button', { name: '⌫' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: '0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateSelectedLinePrice).toHaveBeenCalledWith(4)

    fireEvent.click(screen.getByRole('button', { name: 'Price Change' }))
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(updateSelectedLinePrice).toHaveBeenCalledTimes(1)
  })
})
