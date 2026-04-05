import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      transactionDiscountPercent: 0,
      specialPricingMap: new Map()
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: vi.fn().mockResolvedValue(mockProducts),
      getActiveSpecialPricing: vi.fn().mockResolvedValue([])
    }
  })

  const waitForHookStartup = async (): Promise<void> => {
    await waitFor(() => {
      expect(window.api?.getActiveSpecialPricing).toHaveBeenCalled()
    })
  }

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

  describe('hold transaction actions', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api = {
        getProducts: async () => mockProducts,
        getActiveSpecialPricing: async () => [],
        saveHeldTransaction: async () => ({
          id: 1,
          hold_number: 1,
          cart_snapshot: '[]',
          transaction_discount_percent: 0,
          subtotal: 0,
          total: 0,
          item_count: 0,
          held_at: new Date().toISOString()
        }),
        getHeldTransactions: async () => [],
        deleteHeldTransaction: async () => undefined
      }
    })

    it('holdTransaction saves cart and clears it', async () => {
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      act(() => result.current.addToCart(result.current.filteredProducts[0]))
      expect(result.current.cart).toHaveLength(1)

      await act(async () => {
        await result.current.holdTransaction()
      })

      expect(result.current.cart).toHaveLength(0)
    })

    it('holdTransaction is no-op when cart is empty', async () => {
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const saveHeldTransaction = (window as any).api.saveHeldTransaction as ReturnType<
        typeof vi.fn
      >
      const spySave = vi.fn(saveHeldTransaction)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.saveHeldTransaction = spySave

      await act(async () => {
        await result.current.holdTransaction()
      })

      expect(spySave).not.toHaveBeenCalled()
    })

    it('loadHeldTransactions populates heldTransactions', async () => {
      const held = {
        id: 1,
        hold_number: 1,
        cart_snapshot: '[]',
        transaction_discount_percent: 0,
        subtotal: 10,
        total: 11,
        item_count: 1,
        held_at: new Date().toISOString()
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.getHeldTransactions = async () => [held]

      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.loadHeldTransactions()
      })

      expect(result.current.heldTransactions).toHaveLength(1)
      expect(result.current.heldTransactions[0].hold_number).toBe(1)
    })

    it('openHoldLookup sets isHoldLookupOpen to true', async () => {
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.openHoldLookup()
      })

      expect(result.current.isHoldLookupOpen).toBe(true)
    })

    it('dismissHoldLookup sets isHoldLookupOpen to false', async () => {
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.openHoldLookup()
      })
      act(() => result.current.dismissHoldLookup())

      expect(result.current.isHoldLookupOpen).toBe(false)
    })

    it('recallHeldTransaction restores cart from snapshot', async () => {
      const cartSnapshot = [
        {
          id: 1,
          sku: 'WINE-001',
          name: 'Cabernet Sauvignon 750ml',
          category: 'Wine',
          price: 19.99,
          basePrice: 19.99,
          quantity: 24,
          tax_rate: 0.13,
          lineQuantity: 2,
          itemDiscountPercent: 0
        }
      ]
      const held = {
        id: 5,
        hold_number: 1,
        cart_snapshot: JSON.stringify(cartSnapshot),
        transaction_discount_percent: 10,
        subtotal: 39.98,
        total: 43.98,
        item_count: 2,
        held_at: new Date().toISOString()
      }

      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.recallHeldTransaction(held)
      })

      expect(result.current.cart).toHaveLength(1)
      expect(result.current.cart[0].sku).toBe('WINE-001')
      expect(result.current.transactionDiscountPercent).toBe(10)
      expect(result.current.isHoldLookupOpen).toBe(false)
    })

    it('deleteOneHeldTransaction removes a single hold', async () => {
      const deleteHeldTransaction = vi.fn().mockResolvedValue(undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.deleteHeldTransaction = deleteHeldTransaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.getHeldTransactions = async () => []

      const held = {
        id: 3,
        hold_number: 1,
        cart_snapshot: '[]',
        transaction_discount_percent: 0,
        subtotal: 10,
        total: 11,
        item_count: 1,
        held_at: new Date().toISOString()
      }

      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.deleteOneHeldTransaction(held)
      })

      expect(deleteHeldTransaction).toHaveBeenCalledWith(3)
    })

    it('clearAllHeldTransactions removes all holds', async () => {
      const clearAll = vi.fn().mockResolvedValue(undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.clearAllHeldTransactions = clearAll

      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      // Pre-populate heldTransactions via store
      act(() => {
        usePosStore.setState({
          heldTransactions: [
            {
              id: 1,
              hold_number: 1,
              cart_snapshot: '[]',
              transaction_discount_percent: 0,
              subtotal: 0,
              total: 0,
              item_count: 0,
              held_at: new Date().toISOString()
            }
          ]
        })
      })
      expect(result.current.heldTransactions).toHaveLength(1)

      await act(async () => {
        await result.current.clearAllHeldTransactions()
      })

      expect(clearAll).toHaveBeenCalled()
      expect(result.current.heldTransactions).toHaveLength(0)
    })

    it('recallHeldTransaction auto-holds current cart before restoring', async () => {
      const saveHeldTransaction = vi.fn().mockResolvedValue({
        id: 2,
        hold_number: 1,
        cart_snapshot: '[]',
        transaction_discount_percent: 0,
        subtotal: 0,
        total: 0,
        item_count: 0,
        held_at: new Date().toISOString()
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.saveHeldTransaction = saveHeldTransaction

      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      // Add item to cart first
      act(() => result.current.addToCart(result.current.filteredProducts[0]))
      expect(result.current.cart).toHaveLength(1)

      const held = {
        id: 5,
        hold_number: 2,
        cart_snapshot: JSON.stringify([
          {
            id: 2,
            sku: 'BEER-001',
            name: 'Craft IPA',
            category: 'Beer',
            price: 13.49,
            basePrice: 13.49,
            quantity: 40,
            tax_rate: 0.13,
            lineQuantity: 1,
            itemDiscountPercent: 0
          }
        ]),
        transaction_discount_percent: 0,
        subtotal: 13.49,
        total: 15.24,
        item_count: 1,
        held_at: new Date().toISOString()
      }

      await act(async () => {
        await result.current.recallHeldTransaction(held)
      })

      // Auto-hold should have been called
      expect(saveHeldTransaction).toHaveBeenCalled()
      // Cart should now have the recalled item
      expect(result.current.cart[0].sku).toBe('BEER-001')
    })
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

  describe('recallTransaction edge cases', () => {
    it('returns false when transaction is not found', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.getTransactionByNumber = vi.fn().mockResolvedValue(null)
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      let ok: boolean = true
      await act(async () => {
        ok = await result.current.recallTransaction('TXN-NONE')
      })
      expect(ok).toBe(false)
    })

    it('returns false when api call throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.getTransactionByNumber = vi.fn().mockRejectedValue(new Error('db error'))
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      let ok: boolean = true
      await act(async () => {
        ok = await result.current.recallTransaction('TXN-ERR')
      })
      expect(ok).toBe(false)
      consoleErrorSpy.mockRestore()
    })

    it('returns false when api is unavailable', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).api.getTransactionByNumber
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      let ok: boolean = true
      await act(async () => {
        ok = await result.current.recallTransaction('TXN-001')
      })
      expect(ok).toBe(false)
    })
  })

  describe('held transaction error branches', () => {
    it('loadHeldTransactions handles api error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.getHeldTransactions = vi.fn().mockRejectedValue(new Error('load error'))
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.loadHeldTransactions()
      })
      // Should not throw; heldTransactions stays unchanged
      expect(result.current.heldTransactions).toEqual([])
      consoleErrorSpy.mockRestore()
    })

    it('clearAllHeldTransactions handles api error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api.clearAllHeldTransactions = vi
        .fn()
        .mockRejectedValue(new Error('clear error'))
      const { result } = renderHook(() => usePosScreen())
      await waitFor(() => expect(result.current.filteredProducts.length).toBeGreaterThan(0))

      await act(async () => {
        await result.current.clearAllHeldTransactions()
      })
      // Should not throw
      expect(result.current.heldTransactions).toEqual([])
      consoleErrorSpy.mockRestore()
    })
  })

  describe('return/refund', () => {
    const mockTransaction = {
      id: 1,
      transaction_number: 'TXN-001',
      subtotal: 33.48,
      tax_amount: 4.35,
      total: 37.83,
      payment_method: 'cash',
      status: 'completed' as const,
      created_at: '2026-01-01T00:00:00Z',
      stax_transaction_id: null,
      card_last_four: null,
      card_type: null,
      original_transaction_id: null,
      items: [
        {
          id: 1,
          product_id: 1,
          product_name: 'Cabernet Sauvignon 750ml',
          quantity: 1,
          unit_price: 19.99,
          total_price: 19.99
        },
        {
          id: 2,
          product_id: 2,
          product_name: 'Craft IPA 6-Pack',
          quantity: 1,
          unit_price: 13.49,
          total_price: 13.49
        }
      ]
    }

    function setupRecalledState(): void {
      usePosStore.setState({
        products: mockProducts,
        cart: mockTransaction.items.map((item) => ({
          id: item.product_id,
          sku: '',
          name: item.product_name,
          category: '',
          price: item.unit_price,
          quantity: 0,
          tax_rate: 0,
          lineQuantity: item.quantity
        })),
        viewingTransaction: mockTransaction,
        selectedCartId: 1,
        returnItems: {}
      })
    }

    it('toggleReturnItem adds item with full lineQuantity', async () => {
      setupRecalledState()
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnItem(1)
      })

      expect(result.current.returnItems).toEqual({ 1: 1 })
      expect(result.current.isReturning).toBe(true)
    })

    it('toggleReturnItem removes item on second call', async () => {
      setupRecalledState()
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnItem(1)
      })
      act(() => {
        result.current.toggleReturnItem(1)
      })

      expect(result.current.returnItems).toEqual({})
      expect(result.current.isReturning).toBe(false)
    })

    it('toggleReturnItem blocks on refund transactions', async () => {
      setupRecalledState()
      usePosStore.setState({
        viewingTransaction: { ...mockTransaction, status: 'refund' as const }
      })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnItem(1)
      })

      expect(result.current.returnItems).toEqual({})
    })

    it('toggleReturnItem does nothing without viewingTransaction', async () => {
      usePosStore.setState({
        products: mockProducts,
        cart: [],
        viewingTransaction: null,
        returnItems: {}
      })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnItem(1)
      })

      expect(result.current.returnItems).toEqual({})
    })

    it('toggleReturnAll marks all cart items', async () => {
      setupRecalledState()
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnAll()
      })

      expect(result.current.returnItems).toEqual({ 1: 1, 2: 1 })
    })

    it('toggleReturnAll unmarks all when all are marked', async () => {
      setupRecalledState()
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnAll()
      })
      act(() => {
        result.current.toggleReturnAll()
      })

      expect(result.current.returnItems).toEqual({})
    })

    it('toggleReturnAll blocks on refund transactions', async () => {
      setupRecalledState()
      usePosStore.setState({
        viewingTransaction: { ...mockTransaction, status: 'refund' as const }
      })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnAll()
      })

      expect(result.current.returnItems).toEqual({})
    })

    it('setReturnItemQuantity clamps between 1 and lineQuantity', async () => {
      setupRecalledState()
      usePosStore.setState({
        cart: [
          {
            id: 1,
            sku: '',
            name: 'Test',
            category: '',
            price: 10,
            quantity: 0,
            tax_rate: 0,
            lineQuantity: 5
          }
        ],
        returnItems: { 1: 5 }
      })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.setReturnItemQuantity(1, 3)
      })
      expect(result.current.returnItems[1]).toBe(3)

      act(() => {
        result.current.setReturnItemQuantity(1, 0)
      })
      expect(result.current.returnItems[1]).toBe(1)

      act(() => {
        result.current.setReturnItemQuantity(1, 99)
      })
      expect(result.current.returnItems[1]).toBe(5)
    })

    it('setReturnItemQuantity does nothing without viewingTransaction', async () => {
      usePosStore.setState({
        products: mockProducts,
        cart: [
          {
            id: 1,
            sku: '',
            name: 'Test',
            category: '',
            price: 10,
            quantity: 0,
            tax_rate: 0,
            lineQuantity: 5
          }
        ],
        viewingTransaction: null,
        returnItems: { 1: 5 }
      })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.setReturnItemQuantity(1, 3)
      })
      expect(result.current.returnItems[1]).toBe(5)
    })

    it('setReturnItemQuantity does nothing for non-existent item', async () => {
      setupRecalledState()
      usePosStore.setState({ returnItems: { 1: 1 } })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.setReturnItemQuantity(999, 3)
      })
      expect(result.current.returnItems).toEqual({ 1: 1 })
    })

    it('dismissRecalledTransaction resets returnItems', async () => {
      setupRecalledState()
      usePosStore.setState({ returnItems: { 1: 1, 2: 1 } })
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.dismissRecalledTransaction()
      })

      expect(result.current.returnItems).toEqual({})
      expect(result.current.isReturning).toBe(false)
    })

    it('computes negative return totals', async () => {
      setupRecalledState()
      const { result } = renderHook(() => usePosScreen())
      await waitForHookStartup()

      act(() => {
        result.current.toggleReturnItem(1)
      })

      expect(result.current.returnSubtotal).toBeLessThan(0)
      expect(result.current.returnTax).toBeLessThan(0)
      expect(result.current.returnTotal).toBeLessThan(0)
    })

    it('return totals are zero when no items marked', async () => {
      setupRecalledState()
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(window.api?.getActiveSpecialPricing).toHaveBeenCalled()
      })

      expect(result.current.returnSubtotal).toBe(0)
      expect(result.current.returnTax).toBe(0)
      expect(result.current.returnTotal).toBe(0)
    })

    it('return totals are zero without viewingTransaction', async () => {
      usePosStore.setState({
        products: mockProducts,
        cart: [],
        viewingTransaction: null,
        returnItems: {}
      })
      const { result } = renderHook(() => usePosScreen())

      await waitFor(() => {
        expect(window.api?.getActiveSpecialPricing).toHaveBeenCalled()
      })

      expect(result.current.returnSubtotal).toBe(0)
      expect(result.current.returnTax).toBe(0)
      expect(result.current.returnTotal).toBe(0)
    })
  })
})
