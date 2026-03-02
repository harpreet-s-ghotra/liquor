import { render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { POSScreen } from './POSScreen'

const mockUsePosScreen = vi.fn()

vi.mock('@renderer/store/usePosScreen', () => ({
  usePosScreen: () => mockUsePosScreen()
}))

function createDefaultMock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    activeCategory: 'Favorites',
    addToCart: vi.fn(),
    addToCartBySku: vi.fn(),
    applyDiscount: vi.fn(),
    cart: [],
    cartLines: [],
    categories: ['Favorites', 'All'],
    clearTransaction: vi.fn(),
    filteredProducts: [],
    productsLoadError: null,
    quantity: '1',
    reloadProducts: vi.fn(),
    removeSelectedLine: vi.fn(),
    search: '',
    selectedCartId: null,
    selectedCartItem: null,
    setActiveCategory: vi.fn(),
    setQuantity: vi.fn(),
    setSearch: vi.fn(),
    setSelectedCartId: vi.fn(),
    subtotalBeforeDiscount: 0,
    subtotalDiscounted: 0,
    tax: 0,
    totalSavings: 0,
    transactionDiscountPercent: 0,
    total: 0,
    updateSelectedLinePrice: vi.fn(),
    updateSelectedLineQuantity: vi.fn(),
    ...overrides
  }
}

const sampleCartItem = {
  id: 1,
  sku: 'A',
  name: 'Item',
  price: 5,
  quantity: 10,
  tax_rate: 0.1,
  category: 'Cat',
  lineQuantity: 1
}

describe('POSScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render preview mode badge', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)
    expect(screen.queryByText('Browser preview mode (mock products)')).not.toBeInTheDocument()
  })

  it('does not render selected item badge', () => {
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        selectedCartId: 7,
        selectedCartItem: {
          id: 7,
          sku: 'WINE-001',
          name: 'Selected Product',
          category: 'Wine',
          price: 10,
          quantity: 3,
          tax_rate: 0.13,
          lineQuantity: 1
        }
      })
    )
    render(<POSScreen />)
    expect(screen.queryByText('Selected: Selected Product')).not.toBeInTheDocument()
  })

  it('displays error message when productsLoadError is set', () => {
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({ productsLoadError: 'Failed to load products' })
    )
    render(<POSScreen />)
    expect(screen.getByText('Failed to load products')).toBeInTheDocument()
  })

  it('does not display error when productsLoadError is null', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)
    expect(screen.queryByText('Failed to load products')).not.toBeInTheDocument()
  })

  it('opens payment modal when Pay is clicked and cart has items', () => {
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [sampleCartItem],
        total: 5.5
      })
    )
    render(<POSScreen />)

    fireEvent.click(screen.getByText('Pay'))

    // PaymentModal renders a dialog with aria-label="Payment"
    expect(screen.getByRole('dialog', { name: 'Payment' })).toBeInTheDocument()
  })

  it('does not open payment modal when cart is empty', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock({ cart: [] }))
    render(<POSScreen />)

    fireEvent.click(screen.getByText('Pay'))

    expect(screen.queryByRole('dialog', { name: 'Payment' })).not.toBeInTheDocument()
  })

  it('opens inventory modal when Inventory shortcut is clicked', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    fireEvent.click(screen.getByText(/Inventory/i))

    expect(screen.getByText('Inventory Management')).toBeInTheDocument()
  })

  it('calls clearTransaction and closes payment on payment complete', () => {
    const clearTransaction = vi.fn()
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [sampleCartItem],
        total: 5.5,
        clearTransaction
      })
    )
    render(<POSScreen />)

    // Open payment
    fireEvent.click(screen.getByText('Pay'))

    // Pay with exact cash
    fireEvent.click(screen.getByText('Cash (Exact)'))

    // Click OK to complete
    fireEvent.click(screen.getByTestId('payment-ok-btn'))

    act(() => {
      vi.runAllTimers()
    })

    expect(clearTransaction).toHaveBeenCalled()
  })

  it('calls reloadProducts when inventory modal closes', () => {
    const reloadProducts = vi.fn()
    mockUsePosScreen.mockReturnValue(createDefaultMock({ reloadProducts }))
    render(<POSScreen />)

    // Open inventory
    fireEvent.click(screen.getByText(/Inventory/i))

    // Close inventory
    fireEvent.click(screen.getByText('Close'))

    act(() => {
      vi.runAllTimers()
    })

    expect(reloadProducts).toHaveBeenCalled()
  })

  it('cancels payment and closes modal', () => {
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [sampleCartItem],
        total: 5.5
      })
    )
    render(<POSScreen />)

    fireEvent.click(screen.getByText('Pay'))
    expect(screen.getByRole('dialog', { name: 'Payment' })).toBeInTheDocument()

    // Cancel payment
    fireEvent.click(screen.getByText('Cancel'))

    act(() => {
      vi.runAllTimers()
    })

    // Payment modal should be hidden
    expect(screen.queryByRole('dialog', { name: 'Payment' })).not.toBeInTheDocument()
  })

  it('clears transaction on addToCart when payment is complete', () => {
    const clearTransaction = vi.fn()
    const addToCart = vi.fn()
    const product = {
      id: 2,
      sku: 'B',
      name: 'Product B',
      price: 8,
      quantity: 20,
      tax_rate: 0.1,
      category: 'Beer'
    }

    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [{ ...product, lineQuantity: 1 }],
        total: 8.8,
        clearTransaction,
        addToCart,
        filteredProducts: [product]
      })
    )
    render(<POSScreen />)

    // Open payment
    fireEvent.click(screen.getByText('Pay'))

    // Complete payment with exact cash
    fireEvent.click(screen.getByText('Cash (Exact)'))

    // Now click a product tile in the action panel to trigger handleAddToCart
    // while payment is complete
    const productBtn = screen.getByText('Product B')
    fireEvent.click(productBtn)

    act(() => {
      vi.runAllTimers()
    })

    expect(clearTransaction).toHaveBeenCalled()
    expect(addToCart).toHaveBeenCalled()
  })

  it('calls addToCartBySku on search submit', () => {
    const addToCartBySku = vi.fn()
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        search: 'WINE-001',
        addToCartBySku
      })
    )
    render(<POSScreen />)

    const searchInput = screen.getByPlaceholderText('Search item')
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    act(() => {
      vi.runAllTimers()
    })

    expect(addToCartBySku).toHaveBeenCalledWith('WINE-001')
  })
})
