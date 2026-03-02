import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePosScreen, usePosStore } from './usePosScreen'

const mockProducts = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Cabernet Sauvignon 750ml',
    category: 'Wine',
    price: 19.99,
    quantity: 24,
    tax_rate: 0.13
  },
  {
    id: 2,
    sku: 'BEER-001',
    name: 'Craft IPA 6-Pack',
    category: 'Beer',
    price: 13.49,
    quantity: 40,
    tax_rate: 0.13
  },
  {
    id: 3,
    sku: 'SPIRIT-001',
    name: 'Premium Vodka 1L',
    category: 'Spirits',
    price: 32.99,
    quantity: 18,
    tax_rate: 0.13
  }
]

describe('usePosScreen', () => {
  beforeEach(() => {
    // Reset Zustand store between tests
    usePosStore.setState({
      products: [],
      productsLoadError: null,
      isPreviewMode: false,
      cart: [],
      selectedCartId: null,
      search: '',
      quantity: '1',
      activeCategory: 'Favorites',
      transactionDiscountPercent: 0
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: async () => mockProducts
    }
  })

  it('defaults to Favorites category and provides filtered products', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.activeCategory).toBe('Favorites')
      expect(result.current.categories).toContain('Favorites')
      expect(result.current.categories).toContain('All')
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })
  })

  it('selects latest added item and removes selected line', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.setQuantity('2')
    })

    act(() => {
      result.current.addToCart(firstProduct)
    })

    expect(result.current.selectedCartId).toBe(firstProduct.id)
    expect(result.current.cart[0].lineQuantity).toBe(2)

    act(() => {
      result.current.addToCart(firstProduct)
    })

    expect(result.current.cart[0].lineQuantity).toBe(4)

    act(() => {
      result.current.removeSelectedLine()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCartId).toBeNull()
  })

  it('clears transaction state', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.addToCart(firstProduct)
      result.current.clearTransaction()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCartId).toBeNull()
    expect(result.current.total).toBe(0)
  })

  it('supports category filtering across All and specific categories', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.setActiveCategory('All')
    })
    const allCount = result.current.filteredProducts.length

    act(() => {
      result.current.setActiveCategory('Wine')
    })

    expect(allCount).toBeGreaterThan(result.current.filteredProducts.length)
    expect(result.current.filteredProducts.every((product) => product.category === 'Wine')).toBe(
      true
    )
  })

  it('is no-op when deleting without a selected line', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.removeSelectedLine()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCartId).toBeNull()
  })

  it('loads products from API when available', async () => {
    const apiProducts = [
      {
        id: 11,
        sku: 'CUSTOM-001',
        name: 'Custom Product',
        category: 'Custom',
        price: 5,
        quantity: 10,
        tax_rate: 0.13
      }
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: async () => apiProducts
    }

    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.isPreviewMode).toBe(false)
      expect(result.current.categories).toContain('Custom')
    })
  })

  it('shows backend error and no products when API load fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: async () => {
        throw new Error('failed')
      }
    }

    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.productsLoadError).toBe('Unable to load products from backend.')
      expect(result.current.filteredProducts).toHaveLength(0)
    })
  })

  it('updates selected line quantity and price', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.addToCart(firstProduct)
    })

    act(() => {
      result.current.updateSelectedLineQuantity(3)
      result.current.updateSelectedLinePrice(10)
    })

    expect(result.current.cart[0].lineQuantity).toBe(3)
    expect(result.current.cart[0].price).toBe(10)
    expect(result.current.cart[0].basePrice).toBe(firstProduct.price)
  })

  it('applies item and transaction discount to totals', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.addToCart(firstProduct)
      result.current.applyDiscount(10, 'item')
    })

    const totalAfterItemDiscount = result.current.total

    act(() => {
      result.current.applyDiscount(5, 'transaction')
    })

    expect(result.current.total).toBeLessThan(totalAfterItemDiscount)
  })

  it('ignores invalid selected-line edits and handles transaction discount bounds', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.updateSelectedLineQuantity(0)
      result.current.updateSelectedLinePrice(0)
      result.current.applyDiscount(15, 'item')
    })

    expect(result.current.cart).toHaveLength(0)

    act(() => {
      result.current.addToCart(firstProduct)
    })

    const totalBefore = result.current.total

    act(() => {
      result.current.updateSelectedLineQuantity(0)
      result.current.updateSelectedLinePrice(0)
      result.current.applyDiscount(200, 'transaction')
    })

    expect(result.current.cart[0].lineQuantity).toBe(1)
    expect(result.current.cart[0].price).toBe(firstProduct.price)
    expect(result.current.total).toBeLessThan(totalBefore)
    expect(result.current.total).toBe(0)
  })

  it('keeps selection on another line when deleting with remaining cart items', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(1)
    })

    act(() => {
      result.current.setActiveCategory('All')
    })

    const firstProduct = result.current.filteredProducts[0]
    const secondProduct = result.current.filteredProducts[1]

    act(() => {
      result.current.addToCart(firstProduct)
      result.current.addToCart(secondProduct)
    })

    act(() => {
      result.current.removeSelectedLine()
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.selectedCartId).toBe(firstProduct.id)
  })

  it('uses top-quantity fallback for favorites when preferred SKUs are absent', async () => {
    const apiProducts = [
      {
        id: 51,
        sku: 'CUSTOM-AAA',
        name: 'Custom A',
        category: 'Custom',
        price: 5,
        quantity: 1,
        tax_rate: 0.13
      },
      {
        id: 52,
        sku: 'CUSTOM-BBB',
        name: 'Custom B',
        category: 'Custom',
        price: 6,
        quantity: 20,
        tax_rate: 0.13
      }
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: async () => apiProducts
    }

    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.activeCategory).toBe('Favorites')
      expect(result.current.filteredProducts).toHaveLength(2)
    })
  })

  it('adds and removes transaction discount line when selected for delete', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.addToCart(firstProduct)
      result.current.applyDiscount(20, 'transaction')
    })

    act(() => {
      result.current.setSelectedCartId(-1)
    })

    act(() => {
      result.current.removeSelectedLine()
    })

    expect(result.current.transactionDiscountPercent).toBe(0)
    expect(result.current.cartLines.some((line) => line.kind === 'transaction-discount')).toBe(
      false
    )
  })

  it('reloads products when reloadProducts is called', async () => {
    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    // Switch to All so the new product is visible regardless of favorites
    act(() => {
      result.current.setActiveCategory('All')
    })

    const initialCount = result.current.filteredProducts.length

    // Swap mock to return an extra product
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getProducts = async () => [
      ...mockProducts,
      {
        id: 99,
        sku: 'NEW-001',
        name: 'New Product',
        category: 'Wine',
        price: 9.99,
        quantity: 5,
        tax_rate: 0.13
      }
    ]

    await act(async () => {
      result.current.reloadProducts()
    })

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBe(initialCount + 1)
    })
  })

  it('search by SKU shows results across all categories', async () => {
    // Use a larger product set so not all SKUs are in favorites
    const extendedProducts = [
      ...mockProducts,
      {
        id: 4,
        sku: 'COOLER-001',
        name: 'Vodka Soda 473ml',
        category: 'Coolers',
        price: 4.25,
        quantity: 96,
        tax_rate: 0.13
      },
      {
        id: 5,
        sku: 'MIXER-001',
        name: 'Tonic Water 1L',
        category: 'Mixers',
        price: 2.99,
        quantity: 52,
        tax_rate: 0.13
      },
      {
        id: 6,
        sku: 'MIXER-002',
        name: 'Club Soda 1L',
        category: 'Mixers',
        price: 2.59,
        quantity: 47,
        tax_rate: 0.13
      }
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { getProducts: async () => extendedProducts }

    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })

    // Default category is Favorites — search for a non-favorite SKU
    act(() => {
      result.current.setSearch('COOLER-001')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].sku).toBe('COOLER-001')

    // Search by partial SKU
    act(() => {
      result.current.setSearch('MIXER')
    })

    expect(result.current.filteredProducts.length).toBe(2)
    expect(
      result.current.filteredProducts.every((p) => p.sku.toLowerCase().includes('mixer'))
    ).toBe(true)

    // Clearing search restores category filter
    act(() => {
      result.current.setSearch('')
    })

    expect(result.current.activeCategory).toBe('Favorites')
  })

  describe('addToCartBySku', () => {
    it('adds a product to cart by exact SKU match and clears search', async () => {
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(result.current.filteredProducts.length).toBeGreaterThan(0)
      })

      act(() => {
        result.current.setSearch('WINE-001')
        result.current.setQuantity('3')
      })

      let added: boolean = false
      act(() => {
        added = result.current.addToCartBySku('WINE-001')
      })

      expect(added).toBe(true)
      expect(result.current.cart).toHaveLength(1)
      expect(result.current.cart[0].sku).toBe('WINE-001')
      expect(result.current.cart[0].lineQuantity).toBe(3)
      expect(result.current.search).toBe('')
      expect(result.current.quantity).toBe('1')
    })

    it('matches SKU case-insensitively', async () => {
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(result.current.filteredProducts.length).toBeGreaterThan(0)
      })

      let added: boolean = false
      act(() => {
        added = result.current.addToCartBySku('wine-001')
      })

      expect(added).toBe(true)
      expect(result.current.cart).toHaveLength(1)
      expect(result.current.cart[0].sku).toBe('WINE-001')
    })

    it('returns false for empty SKU', async () => {
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(result.current.filteredProducts.length).toBeGreaterThan(0)
      })

      let added: boolean = false
      act(() => {
        added = result.current.addToCartBySku('')
      })

      expect(added).toBe(false)
      expect(result.current.cart).toHaveLength(0)
    })

    it('returns false for non-existent SKU', async () => {
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(result.current.filteredProducts.length).toBeGreaterThan(0)
      })

      let added: boolean = false
      act(() => {
        added = result.current.addToCartBySku('INVALID-999')
      })

      expect(added).toBe(false)
      expect(result.current.cart).toHaveLength(0)
    })

    it('does not match partial SKU', async () => {
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(result.current.filteredProducts.length).toBeGreaterThan(0)
      })

      let added: boolean = false
      act(() => {
        added = result.current.addToCartBySku('WINE')
      })

      expect(added).toBe(false)
      expect(result.current.cart).toHaveLength(0)
    })
  })
})
