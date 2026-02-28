import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { POSScreen } from './POSScreen'

const mockUsePosScreen = vi.fn()

vi.mock('@renderer/store/usePosScreen', () => ({
  usePosScreen: () => mockUsePosScreen()
}))

describe('POSScreen', () => {
  it('shows preview mode badge when enabled', () => {
    mockUsePosScreen.mockReturnValue({
      activeCategory: 'Favorites',
      addToCart: vi.fn(),
      applyDiscount: vi.fn(),
      cart: [],
      cartLines: [],
      categories: ['Favorites', 'All'],
      clearTransaction: vi.fn(),
      filteredProducts: [],
      isPreviewMode: true,
      quantity: '1',
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
      updateSelectedLineQuantity: vi.fn()
    })

    render(<POSScreen />)
    expect(screen.getByText('Browser preview mode (mock products)')).toBeInTheDocument()
  })

  it('shows selected item badge when selected item exists', () => {
    mockUsePosScreen.mockReturnValue({
      activeCategory: 'Favorites',
      addToCart: vi.fn(),
      applyDiscount: vi.fn(),
      cart: [],
      cartLines: [],
      categories: ['Favorites', 'All'],
      clearTransaction: vi.fn(),
      filteredProducts: [],
      isPreviewMode: false,
      quantity: '1',
      removeSelectedLine: vi.fn(),
      search: '',
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
      },
      setActiveCategory: vi.fn(),
      setQuantity: vi.fn(),
      setSearch: vi.fn(),
      setSelectedCartId: vi.fn(),
      subtotalBeforeDiscount: 10,
      subtotalDiscounted: 10,
      tax: 1,
      totalSavings: 0,
      transactionDiscountPercent: 0,
      total: 11,
      updateSelectedLinePrice: vi.fn(),
      updateSelectedLineQuantity: vi.fn()
    })

    render(<POSScreen />)
    expect(screen.getByText('Selected: Selected Product')).toBeInTheDocument()
  })
})
