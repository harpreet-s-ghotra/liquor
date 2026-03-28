import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FooterActionBar, type FooterActionBarProps } from './FooterActionBar'
import { createRef } from 'react'
import type { InventoryProduct } from '@renderer/types/pos'

const sampleProduct: InventoryProduct = {
  item_number: 1,
  sku: 'WINE-001',
  item_name: 'Red Wine',
  dept_id: null,
  category_id: null,
  category_name: null,
  cost: 5,
  retail_price: 9.99,
  in_stock: 10,
  tax_1: 0.08,
  tax_2: 0,
  distributor_number: null,
  distributor_name: null,
  bottles_per_case: 12,
  case_discount_price: null,
  special_pricing_enabled: 0,
  special_price: null,
  is_active: 1,
  barcode: null,
  description: null,
  item_type: null,
  size: null,
  case_cost: null,
  nysla_discounts: null
}

function makeProps(overrides?: Partial<FooterActionBarProps>): FooterActionBarProps {
  return {
    activeTab: 'items',
    searchTerm: '',
    onSearchTermChange: vi.fn(),
    onSearch: vi.fn(),
    searchResults: [],
    showSearchDropdown: false,
    onSelectSearchResult: vi.fn(),
    onCloseDropdown: vi.fn(),
    searchWrapperRef: createRef(),
    searchInputRef: createRef(),
    noResultsSku: null,
    onAddNewWithSku: vi.fn(),
    showItemActions: true,
    canSave: true,
    canDelete: true,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides
  }
}

describe('FooterActionBar', () => {
  it('renders search input and action buttons on items tab', () => {
    render(<FooterActionBar {...makeProps()} />)
    expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    expect(screen.queryByText('+ New Item')).not.toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Discard')).toBeInTheDocument()
  })

  it('hides action buttons when showItemActions is false', () => {
    render(<FooterActionBar {...makeProps({ showItemActions: false })} />)
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('calls onSearch when Enter is pressed in search input', () => {
    const onSearch = vi.fn()
    render(<FooterActionBar {...makeProps({ onSearch })} />)
    fireEvent.keyDown(screen.getByLabelText('Search Inventory'), { key: 'Enter' })
    expect(onSearch).toHaveBeenCalled()
  })

  it('calls onCloseDropdown when Escape is pressed', () => {
    const onCloseDropdown = vi.fn()
    render(<FooterActionBar {...makeProps({ onCloseDropdown })} />)
    fireEvent.keyDown(screen.getByLabelText('Search Inventory'), { key: 'Escape' })
    expect(onCloseDropdown).toHaveBeenCalled()
  })

  it('calls onSearchTermChange on input', () => {
    const onSearchTermChange = vi.fn()
    render(<FooterActionBar {...makeProps({ onSearchTermChange })} />)
    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'wine' } })
    expect(onSearchTermChange).toHaveBeenCalledWith('wine')
  })

  it('shows search dropdown with results on items tab', () => {
    render(
      <FooterActionBar
        {...makeProps({
          showSearchDropdown: true,
          searchTerm: 'wine',
          searchResults: [sampleProduct]
        })}
      />
    )
    expect(screen.getByRole('listbox', { name: 'Search results' })).toBeInTheDocument()
    expect(screen.getByText('Red Wine')).toBeInTheDocument()
  })

  it('does not show search dropdown on non-items tab', () => {
    render(
      <FooterActionBar
        {...makeProps({
          activeTab: 'departments',
          showSearchDropdown: true,
          searchTerm: 'dept',
          searchResults: [sampleProduct]
        })}
      />
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('calls onSelectSearchResult when a result is clicked', () => {
    const onSelectSearchResult = vi.fn()
    render(
      <FooterActionBar
        {...makeProps({
          showSearchDropdown: true,
          searchTerm: 'wine',
          searchResults: [sampleProduct],
          onSelectSearchResult
        })}
      />
    )
    fireEvent.mouseDown(screen.getByText('Red Wine'))
    expect(onSelectSearchResult).toHaveBeenCalledWith(sampleProduct)
  })

  it('shows no-results prompt with Add New button', () => {
    const onAddNewWithSku = vi.fn()
    render(
      <FooterActionBar
        {...makeProps({
          noResultsSku: 'XYZ-999',
          onAddNewWithSku
        })}
      />
    )
    expect(screen.getByText('XYZ-999')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('+ Add New Item'))
    expect(onAddNewWithSku).toHaveBeenCalledWith('XYZ-999')
  })

  it('does not show no-results prompt on non-items tab', () => {
    render(
      <FooterActionBar
        {...makeProps({
          activeTab: 'distributors',
          noResultsSku: 'XYZ-999'
        })}
      />
    )
    expect(screen.queryByText('XYZ-999')).not.toBeInTheDocument()
  })

  it('uses correct placeholder per tab', () => {
    const { rerender } = render(<FooterActionBar {...makeProps({ activeTab: 'items' })} />)
    expect(screen.getByPlaceholderText('Scan or enter SKU / name...')).toBeInTheDocument()

    rerender(<FooterActionBar {...makeProps({ activeTab: 'departments' })} />)
    expect(screen.getByPlaceholderText('Filter departments...')).toBeInTheDocument()

    rerender(<FooterActionBar {...makeProps({ activeTab: 'tax-codes' })} />)
    expect(screen.getByPlaceholderText('Filter tax codes...')).toBeInTheDocument()

    rerender(<FooterActionBar {...makeProps({ activeTab: 'distributors' })} />)
    expect(screen.getByPlaceholderText('Filter distributors...')).toBeInTheDocument()
  })

  it('calls action handlers when buttons are clicked', () => {
    const onSave = vi.fn()
    const onDelete = vi.fn()
    const onDiscard = vi.fn()
    render(<FooterActionBar {...makeProps({ onSave, onDelete, onDiscard })} />)

    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Delete Item'))
    expect(onDelete).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Discard'))
    expect(onDiscard).toHaveBeenCalled()
  })

  it('disables buttons based on canSave, canDelete', () => {
    render(<FooterActionBar {...makeProps({ canSave: false, canDelete: false })} />)
    expect(screen.getByText('Save').closest('button')).toBeDisabled()
    expect(screen.getByText('Delete Item').closest('button')).toBeDisabled()
  })
})
