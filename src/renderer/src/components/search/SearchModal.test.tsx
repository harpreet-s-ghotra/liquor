import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SearchModal } from './SearchModal'

const mockProducts = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Cabernet Sauvignon',
    category: 'Wine',
    price: 19.99,
    quantity: 24,
    tax_rate: 0.13
  },
  {
    id: 2,
    sku: 'BEER-001',
    name: 'IPA 6-pack',
    category: 'Beer',
    price: 12.99,
    quantity: 48,
    tax_rate: 0.13
  }
]

const mockItemTypes = [
  { id: 1, name: 'Wine', description: null, default_profit_margin: 30, default_tax_rate: 0.13 },
  { id: 2, name: 'Beer', description: null, default_profit_margin: 25, default_tax_rate: 0.13 }
]

const mockDistributors = [
  {
    distributor_number: 1,
    distributor_name: 'Wine Co',
    license_id: null,
    serial_number: null,
    premises_name: null,
    premises_address: null,
    is_active: 1
  }
]

const renderOpenSearchModal = async (
  props?: Partial<React.ComponentProps<typeof SearchModal>>
): Promise<void> => {
  render(
    <SearchModal
      isOpen={true}
      onClose={vi.fn()}
      onAddToCart={vi.fn()}
      onOpenInInventory={vi.fn()}
      {...props}
    />
  )

  await waitFor(() => {
    expect(window.api!.getItemTypes).toHaveBeenCalled()
    expect(window.api!.getDistributors).toHaveBeenCalled()
  })
}

describe('SearchModal', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      searchProducts: vi.fn().mockResolvedValue(mockProducts),
      getItemTypes: vi.fn().mockResolvedValue(mockItemTypes),
      getDepartments: vi.fn().mockResolvedValue(mockItemTypes),
      getDistributors: vi.fn().mockResolvedValue(mockDistributors),
      getDistinctSizes: vi.fn().mockResolvedValue(['750ML', '1.5L'])
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('returns empty when not open', () => {
    const { container } = render(
      <SearchModal
        isOpen={false}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the modal with header and search input', async () => {
    await renderOpenSearchModal()

    expect(screen.getByText('Product Search')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Close/ })).toBeInTheDocument()
  })

  it('auto-searches on open and shows all products', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith('', {})
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
      expect(screen.getByText('IPA 6-pack')).toBeInTheDocument()
    })
  })

  it('shows item type and distributor filter dropdowns', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by item type')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by distributor')).toBeInTheDocument()
    })
  })

  it('searches products when Go button is clicked', async () => {
    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith('cab', {
        departmentId: undefined,
        distributorNumber: undefined
      })
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
      expect(screen.getByText('IPA 6-pack')).toBeInTheDocument()
    })
  })

  it('searches products on Enter key', async () => {
    await renderOpenSearchModal()

    const input = screen.getByPlaceholderText('Search items...')
    fireEvent.change(input, { target: { value: 'wine' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith('wine', {
        departmentId: undefined,
        distributorNumber: undefined
      })
    })
  })

  it('highlights selected item and shows action buttons', async () => {
    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('search-result-1'))

    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open in Inventory' })).toBeInTheDocument()
  })

  it('calls onAddToCart and onClose when Add to Cart is clicked', async () => {
    const onAddToCart = vi.fn()
    const onClose = vi.fn()

    await renderOpenSearchModal({ onClose, onAddToCart })

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('search-result-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))

    expect(onAddToCart).toHaveBeenCalledWith(mockProducts[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenInInventory and onClose when Open in Inventory is clicked', async () => {
    const onOpenInInventory = vi.fn()
    const onClose = vi.fn()

    await renderOpenSearchModal({ onClose, onOpenInInventory })

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('search-result-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Open in Inventory' }))

    expect(onOpenInInventory).toHaveBeenCalledWith(mockProducts[0])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows empty state when no results found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.searchProducts = vi.fn().mockResolvedValue([])

    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'xyz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('No items found. Try a different search.')).toBeInTheDocument()
    })
  })

  it('deselects item when clicking the same row again', async () => {
    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    // Select
    fireEvent.click(screen.getByTestId('search-result-1'))
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument()

    // Deselect
    fireEvent.click(screen.getByTestId('search-result-1'))
    expect(screen.queryByRole('button', { name: 'Add to Cart' })).not.toBeInTheDocument()
  })

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn()
    await renderOpenSearchModal({ onClose })

    fireEvent.click(screen.getByRole('button', { name: /^Close/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('displays correct price and quantity in results', async () => {
    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('$19.99')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument()
      expect(screen.getByText('$12.99')).toBeInTheDocument()
      expect(screen.getByText('48')).toBeInTheDocument()
    })
  })

  it('searches with empty query when Go is clicked without input', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('', {
        departmentId: undefined,
        distributorNumber: undefined,
        size: undefined
      })
    })
  })

  it('re-searches when item type filter changes after a search', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'wine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText('Filter by item type'), { target: { value: '1' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(3)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('wine', {
        departmentId: 1,
        distributorNumber: undefined,
        size: undefined
      })
    })
  })

  it('re-searches when distributor filter changes after a search', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'beer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText('Filter by distributor'), { target: { value: '1' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(3)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('beer', {
        departmentId: undefined,
        distributorNumber: 1,
        size: undefined
      })
    })
  })

  it('loads distinct sizes and renders them in the size filter', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.getDistinctSizes).toHaveBeenCalled()
    })

    const sizeFilter = screen.getByLabelText('Filter by size') as HTMLSelectElement
    const options = Array.from(sizeFilter.options).map((o) => o.textContent)
    expect(options).toEqual(['All Sizes', '750ML', '1.5L'])
  })

  it('re-searches when size filter changes after a search', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByPlaceholderText('Search items...'), {
      target: { value: 'cabernet' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText('Filter by size'), { target: { value: '750ML' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(3)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('cabernet', {
        departmentId: undefined,
        distributorNumber: undefined,
        size: '750ML'
      })
    })
  })

  it('combines size with existing filters', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByLabelText('Filter by item type'), { target: { value: '1' } })
    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText('Filter by size'), { target: { value: '1.5L' } })
    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('', {
        departmentId: 1,
        distributorNumber: undefined,
        size: '1.5L'
      })
    })
  })

  it('handles search API errors gracefully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.searchProducts = vi.fn().mockRejectedValue(new Error('API error'))

    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('No items found. Try a different search.')).toBeInTheDocument()
    })
  })

  it('renders without window.api gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    expect(screen.getByText('Product Search')).toBeInTheDocument()
  })

  it('displays negative prices with correct format', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.searchProducts = vi.fn().mockResolvedValue([
      {
        id: 10,
        sku: 'NEG-1',
        name: 'Refund Item',
        category: 'X',
        price: -5.5,
        quantity: 1,
        tax_rate: 0
      }
    ])

    await renderOpenSearchModal()

    fireEvent.change(screen.getByPlaceholderText('Search items...'), {
      target: { value: 'refund' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('-$5.50')).toBeInTheDocument()
    })
  })

  it('resets item type filter to all when cleared', async () => {
    await renderOpenSearchModal()

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'wine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText('Filter by item type'), { target: { value: '1' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(3)
    })

    fireEvent.change(screen.getByLabelText('Filter by item type'), { target: { value: '' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(4)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('wine', {
        departmentId: undefined,
        distributorNumber: undefined
      })
    })
  })
})
