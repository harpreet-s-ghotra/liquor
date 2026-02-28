import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@renderer/types/pos'
import { ActionPanel } from './ActionPanel'

const products: Product[] = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Cabernet Sauvignon 750ml',
    category: 'Wine',
    price: 19.99,
    quantity: 24,
    tax_rate: 0.13
  }
]

describe('ActionPanel', () => {
  it('renders categories with tone classes and handles actions', () => {
    const setActiveCategory = vi.fn()
    const addToCart = vi.fn()

    render(
      <ActionPanel
        activeCategory="Favorites"
        categories={['Favorites', 'Wine', 'All']}
        cartCount={0}
        filteredProducts={products}
        setActiveCategory={setActiveCategory}
        addToCart={addToCart}
        tax={1.2}
        total={10.5}
      />
    )

    const favoritesButton = screen.getByRole('button', { name: 'Favorites' })
    const wineButton = screen.getByRole('button', { name: 'Wine' })
    const payButton = screen.getByRole('button', { name: 'Pay' })

    expect(favoritesButton.className).toContain('category-tone-favorite')
    expect(wineButton.className).toContain('category-tone-1')
    expect(payButton).toBeDisabled()

    fireEvent.click(wineButton)
    expect(setActiveCategory).toHaveBeenCalledWith('Wine')

    fireEvent.click(screen.getByRole('button', { name: /Cabernet Sauvignon/i }))
    expect(addToCart).toHaveBeenCalledTimes(1)
  })

  it('enables pay button when cart has items and applies tone classes', () => {
    render(
      <ActionPanel
        activeCategory="All"
        categories={['Favorites', 'Wine', 'Beer', 'Spirits', 'All']}
        cartCount={2}
        filteredProducts={products}
        setActiveCategory={vi.fn()}
        addToCart={vi.fn()}
        tax={2}
        total={25}
      />
    )

    expect(screen.getByRole('button', { name: 'Pay' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'All' }).className).toContain('category-tone-all')
    expect(screen.getByRole('button', { name: 'Beer' }).className).toContain('category-tone-2')
  })
})
