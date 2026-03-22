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

const baseProps = {
  cartCount: 0,
  filteredProducts: products,
  addToCart: vi.fn(),
  subtotalBeforeDiscount: 12,
  subtotalDiscounted: 10,
  tax: 1.2,
  total: 10.5,
  onPay: vi.fn(),
  onCash: vi.fn(),
  onCredit: vi.fn(),
  onDebit: vi.fn(),
  heldCount: 0,
  onHold: vi.fn(),
  onTsLookup: vi.fn()
}

describe('ActionPanel', () => {
  it('renders category dropdown and opens menu on click', () => {
    const setActiveCategory = vi.fn()

    render(
      <ActionPanel
        {...baseProps}
        activeCategory="Favorites"
        categories={['Favorites', 'Wine', 'All']}
        setActiveCategory={setActiveCategory}
      />
    )

    // Should show the current category in the trigger
    const trigger = screen.getByRole('button', { name: /Favorites/i })
    expect(trigger).toBeInTheDocument()

    // Menu should NOT be visible initially
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    // Open the menu
    fireEvent.click(trigger)
    const menu = screen.getByRole('listbox', { name: 'Categories' })
    expect(menu).toBeInTheDocument()

    // All categories listed as options
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)

    // Active category has checkmark
    const favOption = screen.getByRole('option', { name: /Favorites/i })
    expect(favOption).toHaveAttribute('aria-selected', 'true')
    expect(favOption).toHaveTextContent('✓')

    // Non-active has no checkmark
    const wineOption = screen.getByRole('option', { name: /Wine/i })
    expect(wineOption).toHaveAttribute('aria-selected', 'false')

    // Clicking an option calls setActiveCategory and closes menu
    fireEvent.click(wineOption)
    expect(setActiveCategory).toHaveBeenCalledWith('Wine')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('renders category tone classes on dropdown items', () => {
    render(
      <ActionPanel
        {...baseProps}
        activeCategory="All"
        categories={['Favorites', 'Wine', 'Beer', 'Spirits', 'All']}
        setActiveCategory={vi.fn()}
        cartCount={2}
      />
    )

    // Open the dropdown
    const trigger = screen.getByRole('button', { name: /^\W*All\W*$/i })
    fireEvent.click(trigger)

    const options = screen.getAllByRole('option')
    expect(options[0].className).toContain('category-tone-favorite')
    expect(options[1].className).toContain('category-tone-1')
    expect(options[2].className).toContain('category-tone-2')
    expect(options[3].className).toContain('category-tone-3')
    expect(options[4].className).toContain('category-tone-all')
  })

  it('enables pay button when cart has items', () => {
    render(
      <ActionPanel
        {...baseProps}
        activeCategory="All"
        categories={['All']}
        setActiveCategory={vi.fn()}
        cartCount={2}
      />
    )

    expect(screen.getByRole('button', { name: 'Pay Now' })).toBeEnabled()
  })

  it('shows size toggle and product items with correct layout', () => {
    const addToCart = vi.fn()

    render(
      <ActionPanel
        {...baseProps}
        activeCategory="All"
        categories={['All']}
        setActiveCategory={vi.fn()}
        addToCart={addToCart}
      />
    )

    // Size toggle buttons present
    const smallBtn = screen.getByRole('button', { name: 'Small items' })
    const largeBtn = screen.getByRole('button', { name: 'Large items' })
    expect(smallBtn).toBeInTheDocument()
    expect(largeBtn).toBeInTheDocument()

    // Small is active by default (uses BEM modifier for active state)
    expect(smallBtn.className).toContain('action-panel__size-btn--active')
    expect(largeBtn.className).not.toContain('action-panel__size-btn--active')

    // Product button is present and clickable
    fireEvent.click(screen.getByRole('button', { name: /Cabernet Sauvignon/i }))
    expect(addToCart).toHaveBeenCalledTimes(1)

    // Switch to large
    fireEvent.click(largeBtn)
    expect(largeBtn.className).toContain('action-panel__size-btn--active')
    expect(smallBtn.className).not.toContain('action-panel__size-btn--active')
  })

  it('shows discount amount in totals', () => {
    render(
      <ActionPanel
        {...baseProps}
        activeCategory="All"
        categories={['All']}
        setActiveCategory={vi.fn()}
      />
    )

    expect(screen.getByText('Discount')).toBeInTheDocument()
    expect(screen.getByText('-$2.00')).toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(
      <ActionPanel
        {...baseProps}
        activeCategory="All"
        categories={['All', 'Wine']}
        setActiveCategory={vi.fn()}
      />
    )

    // Open menu
    const trigger = screen.getByRole('button', { name: /^\W*All\W*$/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    // Click outside the dropdown
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('selects category via keyboard Enter on dropdown item', () => {
    const setActiveCategory = vi.fn()
    render(
      <ActionPanel
        {...baseProps}
        activeCategory="All"
        categories={['All', 'Wine']}
        setActiveCategory={setActiveCategory}
      />
    )

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: /^\W*All\W*$/i }))
    const wineOption = screen.getByRole('option', { name: /Wine/i })

    // Press Enter
    fireEvent.keyDown(wineOption, { key: 'Enter' })
    expect(setActiveCategory).toHaveBeenCalledWith('Wine')
  })

  describe('return/refund mode', () => {
    it('shows refund labels and enables payment buttons when isReturning', () => {
      render(
        <ActionPanel
          {...baseProps}
          activeCategory="All"
          categories={['All']}
          setActiveCategory={vi.fn()}
          cartCount={2}
          subtotalBeforeDiscount={-19.99}
          subtotalDiscounted={-19.99}
          tax={-2.6}
          total={-22.59}
          isViewingTransaction={true}
          isReturning={true}
        />
      )

      expect(screen.getByText('Refund Sub-Total')).toBeInTheDocument()
      expect(screen.getByText('Refund Tax')).toBeInTheDocument()
      expect(screen.getByText('Refund')).toBeInTheDocument()

      expect(screen.getByRole('button', { name: 'Cash Refund' })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Credit Refund' })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Debit Refund' })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Process Refund' })).not.toBeDisabled()
    })

    it('hides discount row when isReturning', () => {
      render(
        <ActionPanel
          {...baseProps}
          activeCategory="All"
          categories={['All']}
          setActiveCategory={vi.fn()}
          isReturning={true}
          isViewingTransaction={true}
        />
      )

      expect(screen.queryByText('Discount')).not.toBeInTheDocument()
    })

    it('disables payment buttons when viewing transaction without return', () => {
      render(
        <ActionPanel
          {...baseProps}
          activeCategory="All"
          categories={['All']}
          setActiveCategory={vi.fn()}
          cartCount={2}
          isViewingTransaction={true}
          isReturning={false}
        />
      )

      expect(screen.getByRole('button', { name: 'Cash' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Credit' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Debit' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Pay Now' })).toBeDisabled()
    })
  })
})
