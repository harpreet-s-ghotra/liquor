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

const mockDepartments = [
  { id: 1, name: 'Wine', description: null, default_profit_margin: 30, default_tax_rate: 0.13 },
  { id: 2, name: 'Beer', description: null, default_profit_margin: 25, default_tax_rate: 0.13 }
]

const mockVendors = [
  {
    vendor_number: 1,
    vendor_name: 'Wine Co',
    contact_name: null,
    phone: null,
    email: null,
    is_active: 1
  }
]

describe('SearchModal', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      searchProducts: vi.fn().mockResolvedValue(mockProducts),
      getDepartments: vi.fn().mockResolvedValue(mockDepartments),
      getVendors: vi.fn().mockResolvedValue(mockVendors)
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

  it('renders the modal with header and search input', () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    expect(screen.getByText('Product Search')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('shows initial state message before any search', () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    expect(screen.getByText('Type a search term to find items.')).toBeInTheDocument()
  })

  it('shows department and vendor filter dropdowns', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by department')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by vendor')).toBeInTheDocument()
    })
  })

  it('searches products when Go button is clicked', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith('cab', {
        departmentId: undefined,
        vendorNumber: undefined
      })
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
      expect(screen.getByText('IPA 6-pack')).toBeInTheDocument()
    })
  })

  it('searches products on Enter key', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    const input = screen.getByPlaceholderText('Search items...')
    fireEvent.change(input, { target: { value: 'wine' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith('wine', {
        departmentId: undefined,
        vendorNumber: undefined
      })
    })
  })

  it('highlights selected item and shows action buttons', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

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

    render(
      <SearchModal
        isOpen={true}
        onClose={onClose}
        onAddToCart={onAddToCart}
        onOpenInInventory={vi.fn()}
      />
    )

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

    render(
      <SearchModal
        isOpen={true}
        onClose={onClose}
        onAddToCart={vi.fn()}
        onOpenInInventory={onOpenInInventory}
      />
    )

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

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'xyz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('No items found. Try a different search.')).toBeInTheDocument()
    })
  })

  it('deselects item when clicking the same row again', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

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

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <SearchModal
        isOpen={true}
        onClose={onClose}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('displays correct price and quantity in results', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'cab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('$19.99')).toBeInTheDocument()
      expect(screen.getByText('24')).toBeInTheDocument()
      expect(screen.getByText('$12.99')).toBeInTheDocument()
      expect(screen.getByText('48')).toBeInTheDocument()
    })
  })

  it('does not search when query is empty', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    expect(window.api!.searchProducts).not.toHaveBeenCalled()
    expect(screen.getByText('Type a search term to find items.')).toBeInTheDocument()
  })

  it('re-searches when department filter changes after a search', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by department')).toBeInTheDocument()
    })

    // Perform initial search
    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'wine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    // Change department filter — should trigger re-search
    fireEvent.change(screen.getByLabelText('Filter by department'), { target: { value: '1' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('wine', {
        departmentId: 1,
        vendorNumber: undefined
      })
    })
  })

  it('re-searches when vendor filter changes after a search', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by vendor')).toBeInTheDocument()
    })

    // Perform initial search
    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'beer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    // Change vendor filter — should trigger re-search
    fireEvent.change(screen.getByLabelText('Filter by vendor'), { target: { value: '1' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('beer', {
        departmentId: undefined,
        vendorNumber: 1
      })
    })
  })

  it('handles search API errors gracefully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.searchProducts = vi.fn().mockRejectedValue(new Error('API error'))

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

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

    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Search items...'), {
      target: { value: 'refund' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(screen.getByText('-$5.50')).toBeInTheDocument()
    })
  })

  it('resets department filter to all when cleared', async () => {
    render(
      <SearchModal
        isOpen={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        onOpenInInventory={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Filter by department')).toBeInTheDocument()
    })

    // Search, then set filter, then clear it
    fireEvent.change(screen.getByPlaceholderText('Search items...'), { target: { value: 'wine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByLabelText('Filter by department'), { target: { value: '1' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText('Filter by department'), { target: { value: '' } })

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledTimes(3)
      expect(window.api!.searchProducts).toHaveBeenLastCalledWith('wine', {
        departmentId: undefined,
        vendorNumber: undefined
      })
    })
  })
})
