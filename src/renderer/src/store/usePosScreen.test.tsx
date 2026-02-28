import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePosScreen } from './usePosScreen'

describe('usePosScreen', () => {
  beforeEach(() => {
    // Ensure browser-preview mode path for deterministic tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = undefined
  })

  it('defaults to Favorites category and provides filtered products', () => {
    const { result } = renderHook(() => usePosScreen())

    expect(result.current.activeCategory).toBe('Favorites')
    expect(result.current.categories).toContain('Favorites')
    expect(result.current.categories).toContain('All')
    expect(result.current.filteredProducts.length).toBeGreaterThan(0)
  })

  it('selects latest added item and removes selected line', () => {
    const { result } = renderHook(() => usePosScreen())
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

  it('clears transaction state', () => {
    const { result } = renderHook(() => usePosScreen())
    const firstProduct = result.current.filteredProducts[0]

    act(() => {
      result.current.addToCart(firstProduct)
      result.current.clearTransaction()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.selectedCartId).toBeNull()
    expect(result.current.total).toBe(0)
  })

  it('supports category filtering across All and specific categories', () => {
    const { result } = renderHook(() => usePosScreen())

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

  it('is no-op when deleting without a selected line', () => {
    const { result } = renderHook(() => usePosScreen())

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

  it('falls back to preview data when API load fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: async () => {
        throw new Error('failed')
      }
    }

    const { result } = renderHook(() => usePosScreen())

    await waitFor(() => {
      expect(result.current.categories).toContain('Wine')
      expect(result.current.filteredProducts.length).toBeGreaterThan(0)
    })
  })
})
