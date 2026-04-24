import { render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { POSScreen } from './POSScreen'

const mockUsePosScreen = vi.fn()
const mockShowError = vi.fn()
const mockDismissAlert = vi.fn()
const mockLogout = vi.fn()

const authStoreState = {
  currentCashier: {
    id: 1,
    name: 'Cashier 1',
    role: 'admin',
    pin: '1234',
    created_at: '',
    updated_at: ''
  },
  merchantConfig: {
    id: 1,
    finix_api_username: 'UStest',
    finix_api_password: 'test-password',
    merchant_id: 'MUtest',
    merchant_name: 'My Store'
  },
  logout: mockLogout
}

vi.mock('@renderer/store/usePosScreen', () => ({
  usePosScreen: () => mockUsePosScreen()
}))

vi.mock('@renderer/store/useAlertStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAlertStore: (selector: any) =>
    selector({ showError: mockShowError, alerts: [], dismissAlert: mockDismissAlert })
}))

vi.mock('@renderer/store/useAuthStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (selector: any) => selector(authStoreState)
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
    heldTransactions: [],
    isHoldLookupOpen: false,
    holdTransaction: vi.fn(),
    recallHeldTransaction: vi.fn(),
    deleteOneHeldTransaction: vi.fn(),
    clearAllHeldTransactions: vi.fn(),
    loadHeldTransactions: vi.fn(),
    openHoldLookup: vi.fn(),
    dismissHoldLookup: vi.fn(),
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
    mockShowError.mockReset()
    mockDismissAlert.mockReset()
    mockLogout.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getDepartments: vi.fn().mockResolvedValue([]),
      getDistributors: vi.fn().mockResolvedValue([]),
      getHeldTransactions: vi.fn().mockResolvedValue([]),
      saveHeldTransaction: vi.fn().mockResolvedValue({
        id: 1,
        hold_number: 1,
        cart_snapshot: '[]',
        transaction_discount_percent: 0,
        subtotal: 0,
        total: 0,
        item_count: 0,
        held_at: ''
      }),
      deleteHeldTransaction: vi.fn().mockResolvedValue(undefined),
      clearAllHeldTransactions: vi.fn().mockResolvedValue(undefined),
      getReceiptConfig: vi.fn().mockResolvedValue({
        fontSize: 10,
        paddingY: 4,
        paddingX: 4,
        storeName: '',
        footerMessage: '',
        alwaysPrint: false
      }),
      listSessions: vi.fn().mockResolvedValue({ sessions: [], total_count: 0 }),
      createSession: vi.fn().mockResolvedValue({ id: 1, status: 'active' })
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

  it('opens payment modal when Pay is clicked and cart has items', async () => {
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [sampleCartItem],
        total: 5.5
      })
    )
    render(<POSScreen />)

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Pay Now'))
      await Promise.resolve()
    })

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

    expect(screen.getByRole('dialog', { name: 'Inventory Management' })).toBeInTheDocument()
  })

  it('calls clearTransaction and closes payment on payment complete', async () => {
    const clearTransaction = vi.fn()
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [sampleCartItem],
        total: 5.5,
        clearTransaction
      })
    )
    render(<POSScreen />)

    await act(async () => {
      await Promise.resolve()
    })

    // Open payment
    await act(async () => {
      fireEvent.click(screen.getByText('Pay Now'))
      await Promise.resolve()
    })

    // Pay with exact cash
    await act(async () => {
      fireEvent.click(screen.getByText('Cash (Exact)'))
      await Promise.resolve()
    })

    // Click OK to complete
    await act(async () => {
      fireEvent.click(screen.getByTestId('payment-ok-btn'))
      await Promise.resolve()
    })

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
    fireEvent.click(screen.getByRole('button', { name: /^Close/ }))

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(reloadProducts).toHaveBeenCalled()
  })

  it('cancels payment and closes modal', async () => {
    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        cart: [sampleCartItem],
        total: 5.5
      })
    )
    render(<POSScreen />)

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Pay Now'))
      await Promise.resolve()
    })
    expect(screen.getByRole('dialog', { name: 'Payment' })).toBeInTheDocument()

    // Cancel payment
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'))
      await Promise.resolve()
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Payment modal should be hidden
    expect(screen.queryByRole('dialog', { name: 'Payment' })).not.toBeInTheDocument()
  })

  it('clears transaction on addToCart when payment is complete', async () => {
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

    await act(async () => {
      await Promise.resolve()
    })

    // Open payment
    await act(async () => {
      fireEvent.click(screen.getByText('Pay Now'))
      await Promise.resolve()
    })

    // Complete payment with exact cash
    await act(async () => {
      fireEvent.click(screen.getByText('Cash (Exact)'))
      await Promise.resolve()
    })

    // Now click a product tile in the action panel to trigger handleAddToCart
    // while payment is complete
    const productBtn = screen.getByText('Product B')
    await act(async () => {
      fireEvent.click(productBtn)
      await Promise.resolve()
    })

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

  it('routes TXN search input to recallTransaction', () => {
    const addToCartBySku = vi.fn()
    const recallTransaction = vi.fn().mockResolvedValue(true)

    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        search: 'TXN-1001',
        addToCartBySku,
        recallTransaction
      })
    )

    render(<POSScreen />)

    const searchInput = screen.getByPlaceholderText('Search item')
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(recallTransaction).toHaveBeenCalledWith('TXN-1001')
    expect(addToCartBySku).not.toHaveBeenCalled()
  })

  it('prints viewed transaction when Receipt button is clicked', () => {
    const printReceipt = vi.fn().mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    win.api = { ...win.api, printReceipt }

    mockUsePosScreen.mockReturnValue(
      createDefaultMock({
        viewingTransaction: {
          id: 100,
          transaction_number: 'TXN-PRINT-1',
          subtotal: 10,
          tax_amount: 1,
          total: 11,
          payment_method: 'credit',
          finix_authorization_id: 'AU-stx_1',
          card_last_four: '4242',
          card_type: 'visa',
          status: 'completed',
          original_transaction_id: null,
          has_refund: false,
          created_at: '2026-03-27T10:00:00.000Z',
          items: [
            {
              id: 1,
              product_id: 1,
              product_name: 'Item',
              quantity: 1,
              unit_price: 10,
              total_price: 10
            }
          ]
        },
        isViewingTransaction: true
      })
    )

    render(<POSScreen />)
    fireEvent.click(screen.getByTestId('print-receipt-btn'))

    expect(printReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_number: 'TXN-PRINT-1',
        store_name: 'My Store',
        cashier_name: 'Cashier 1',
        payment_method: 'credit'
      })
    )
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
      getDistributors: vi.fn().mockResolvedValue([]),
      getHeldTransactions: vi.fn().mockResolvedValue([]),
      saveHeldTransaction: vi.fn().mockResolvedValue({}),
      deleteHeldTransaction: vi.fn().mockResolvedValue(undefined),
      clearAllHeldTransactions: vi.fn().mockResolvedValue(undefined)
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
      getDistributors: vi.fn().mockResolvedValue([]),
      getHeldTransactions: vi.fn().mockResolvedValue([]),
      saveHeldTransaction: vi.fn().mockResolvedValue({}),
      deleteHeldTransaction: vi.fn().mockResolvedValue(undefined),
      clearAllHeldTransactions: vi.fn().mockResolvedValue(undefined)
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

  it('opens clock out modal when F3 is pressed', async () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    act(() => {
      fireEvent.keyDown(window, { key: 'F3' })
    })

    expect(screen.getByRole('dialog', { name: 'Clock Out' })).toBeInTheDocument()
  })

  it('opens inventory modal when F2 is pressed', async () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    act(() => {
      fireEvent.keyDown(window, { key: 'F2' })
    })

    expect(screen.getByRole('dialog', { name: 'Inventory Management' })).toBeInTheDocument()
  })

  it('opens reports modal when F5 is pressed', async () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    act(() => {
      fireEvent.keyDown(window, { key: 'F5' })
    })

    expect(screen.getByRole('dialog', { name: 'Reports' })).toBeInTheDocument()
  })

  it('opens sales history modal when F7 is pressed', async () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    act(() => {
      fireEvent.keyDown(window, { key: 'F7' })
    })

    expect(
      screen.getByText('Sales History', { selector: '.app-modal-header__title' })
    ).toBeInTheDocument()
  })

  it('blocks F2/F5/F7 shortcuts for cashier role', async () => {
    authStoreState.currentCashier = {
      id: 2,
      name: 'Cashier 2',
      role: 'cashier',
      pin: '5678',
      created_at: '',
      updated_at: ''
    }
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)

    await act(async () => {
      fireEvent.keyDown(window, { key: 'F2' })
    })
    expect(screen.queryByRole('dialog', { name: 'Inventory' })).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'F5' })
    })
    expect(screen.queryByRole('dialog', { name: /reports/i })).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(window, { key: 'F7' })
    })
    expect(screen.queryByRole('dialog', { name: 'Sales History' })).not.toBeInTheDocument()

    // Restore admin for other tests
    authStoreState.currentCashier = {
      id: 1,
      name: 'Cashier 1',
      role: 'admin',
      pin: '1234',
      created_at: '',
      updated_at: ''
    }
  })

  it('opens inventory modal with F2 key for admin', () => {
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    render(<POSScreen />)
    // Simulate F2 keydown as admin
    fireEvent.keyDown(window, { key: 'F2' })
    expect(screen.getByRole('dialog', { name: 'Inventory Management' })).toBeInTheDocument()
  })

  it('does not crash if merchantConfig is null', () => {
    // Patch authStoreState to simulate missing merchantConfig
    const originalMerchantConfig = authStoreState.merchantConfig
    authStoreState.merchantConfig = {} as unknown as typeof originalMerchantConfig
    mockUsePosScreen.mockReturnValue(createDefaultMock())
    expect(() => render(<POSScreen />)).not.toThrow()
    // Restore
    authStoreState.merchantConfig = originalMerchantConfig
  })
})
