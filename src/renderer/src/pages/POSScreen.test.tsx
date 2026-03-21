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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getDepartments: vi.fn().mockResolvedValue([]),
      getVendors: vi.fn().mockResolvedValue([])
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
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

    fireEvent.click(screen.getByText('Pay Now'))

    // PaymentModal renders a dialog with aria-label="Payment"
    expect(screen.getByRole('dialog', { name: 'Payment' })).toBeInTheDocument()
  })

  it('does not open payment modal when cart is empty', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock({ cart: [] }))
    render(<POSScreen />)

    fireEvent.click(screen.getByText('Pay Now'))

    expect(screen.queryByRole('dialog', { name: 'Payment' })).not.toBeInTheDocument()
  })

  it('opens inventory modal when Inventory shortcut is clicked', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    fireEvent.click(screen.getByText(/Inventory/i))

    expect(screen.getByText('Inventory Maintenance')).toBeInTheDocument()
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
    fireEvent.click(screen.getByText('Pay Now'))

    // Pay with exact cash
    fireEvent.click(screen.getByText('Cash (Exact)'))

    // Click OK to complete
    fireEvent.click(screen.getByTestId('payment-ok-btn'))

    act(() => {
      vi.advanceTimersByTime(100)
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
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    act(() => {
      vi.advanceTimersByTime(100)
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

    fireEvent.click(screen.getByText('Pay Now'))
    expect(screen.getByRole('dialog', { name: 'Payment' })).toBeInTheDocument()

    // Cancel payment
    fireEvent.click(screen.getByText('Cancel'))

    act(() => {
      vi.advanceTimersByTime(100)
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
    fireEvent.click(screen.getByText('Pay Now'))

    // Complete payment with exact cash
    fireEvent.click(screen.getByText('Cash (Exact)'))

    // Now click a product tile in the action panel to trigger handleAddToCart
    // while payment is complete
    const productBtn = screen.getByText('Product B')
    fireEvent.click(productBtn)

    act(() => {
      vi.advanceTimersByTime(100)
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
      vi.advanceTimersByTime(100)
    })

    expect(addToCartBySku).toHaveBeenCalledWith('WINE-001')
  })

  it('saves discounted unit_price and total_price when discounts are applied', () => {
    const clearTransaction = vi.fn()
    const discountedItem = {
      ...sampleCartItem,
      price: 10,
      lineQuantity: 2,
      itemDiscountPercent: 20 // 20% item-level discount
    }

    const saveTransaction = vi.fn(async () => ({}))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      saveTransaction,
      getDepartments: vi.fn().mockResolvedValue([]),
      getVendors: vi.fn().mockResolvedValue([])
    }

    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [discountedItem],
        total: 17.6,
        tax: 1.6,
        subtotalDiscounted: 16,
        transactionDiscountPercent: 0,
        clearTransaction
      })
    )
    render(<POSScreen />)

    // Open payment → Cash (Exact) → OK
    fireEvent.click(screen.getByText('Pay Now'))
    fireEvent.click(screen.getByText('Cash (Exact)'))
    fireEvent.click(screen.getByTestId('payment-ok-btn'))

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            unit_price: 8, // $10 * (1 - 0.20) = $8
            total_price: 16 // $8 * 2
          })
        ])
      })
    )
  })

  it('saves with both item and transaction discounts applied', () => {
    const clearTransaction = vi.fn()
    const discountedItem = {
      ...sampleCartItem,
      price: 100,
      lineQuantity: 1,
      itemDiscountPercent: 10 // 10% item discount
    }

    const saveTransaction = vi.fn(async () => ({}))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      saveTransaction,
      getDepartments: vi.fn().mockResolvedValue([]),
      getVendors: vi.fn().mockResolvedValue([])
    }

    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [discountedItem],
        total: 81,
        tax: 0,
        subtotalDiscounted: 81,
        transactionDiscountPercent: 10, // 10% transaction discount
        clearTransaction
      })
    )
    render(<POSScreen />)

    // Open payment → Cash (Exact) → OK
    fireEvent.click(screen.getByText('Pay Now'))
    fireEvent.click(screen.getByText('Cash (Exact)'))
    fireEvent.click(screen.getByTestId('payment-ok-btn'))

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // $100 * 0.9 (item) * 0.9 (tx) = $81
    expect(saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            unit_price: 81,
            total_price: 81
          })
        ])
      })
    )
  })
})
