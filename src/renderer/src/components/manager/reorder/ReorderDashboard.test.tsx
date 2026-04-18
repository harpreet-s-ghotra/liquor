import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { ReorderDashboard } from './ReorderDashboard'
import type { LowStockProduct } from '../../../../../shared/types'

const mockProducts: LowStockProduct[] = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Cabernet Sauvignon',
    item_type: 'Wine',
    in_stock: 0,
    reorder_point: 10,
    distributor_name: 'North Wines'
  },
  {
    id: 2,
    sku: 'CHAMPAGNE-001',
    name: 'Dom Pérignon',
    item_type: 'Sparkling',
    in_stock: 3,
    reorder_point: 5,
    distributor_name: 'Premium Imports'
  },
  {
    id: 3,
    sku: 'VODKA-001',
    name: 'Grey Goose',
    item_type: 'Spirits',
    in_stock: 7,
    reorder_point: 8,
    distributor_name: 'Spirits Co'
  },
  {
    id: 4,
    sku: 'BEER-001',
    name: 'IPA 6 Pack',
    item_type: 'Beer',
    in_stock: 12,
    reorder_point: 0,
    distributor_name: 'Craft Brewers'
  }
]

describe('ReorderDashboard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getLowStockProducts: vi.fn().mockResolvedValue(mockProducts)
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('shows loading state initially', () => {
    render(<ReorderDashboard />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('loads and displays low stock products on mount', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    expect(window.api!.getLowStockProducts).toHaveBeenCalledWith(10)
  })

  it('displays product table with SKU, name, and stock levels', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('WINE-001')).toBeInTheDocument()
    })

    expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument() // in_stock for first product
    expect(screen.getByText('10')).toBeInTheDocument() // reorder_point for first product
  })

  it('displays distributor name for each product', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('North Wines')).toBeInTheDocument()
    })

    expect(screen.getByText('Premium Imports')).toBeInTheDocument()
    expect(screen.getByText('Spirits Co')).toBeInTheDocument()
  })

  it('displays summary cards with zero stock count', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Out of stock')).toBeInTheDocument()
    })

    const zeroStockCard = screen.getByText('Out of stock')
    expect(zeroStockCard).toBeInTheDocument()
    // Should count 1 product with in_stock <= 0
    expect(zeroStockCard.parentElement).toHaveTextContent('1')
  })

  it('displays summary cards with below reorder count', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Below reorder point')).toBeInTheDocument()
    })

    const belowReorderCard = screen.getByText('Below reorder point')
    expect(belowReorderCard).toBeInTheDocument()
    // Should count products where in_stock > 0 and in_stock <= reorder_point
    // CHAMPAGNE-001 (3 <= 5) and VODKA-001 (7 <= 8) = 2
    expect(belowReorderCard.parentElement).toHaveTextContent('2')
  })

  it('displays summary card with total low stock count', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total low stock')).toBeInTheDocument()
    })

    const totalCard = screen.getByText('Total low stock')
    expect(totalCard).toBeInTheDocument()
    // Should be all 4 products
    expect(totalCard.parentElement).toHaveTextContent('4')
  })

  it('includes threshold control dropdown with preset options', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    const selectElement = screen.getByRole('combobox')
    expect(selectElement).toBeInTheDocument()

    // Check that preset options are available
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThanOrEqual(5) // [5, 10, 20, 50, 100]
  })

  it('defaults to threshold of 10 units', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    expect(window.api!.getLowStockProducts).toHaveBeenCalledWith(10)
  })

  it('reloads products when threshold is changed', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    vi.mocked(window.api!.getLowStockProducts).mockResolvedValueOnce([
      mockProducts[0],
      mockProducts[1]
    ])

    const selectElement = screen.getByRole('combobox') as HTMLSelectElement
    await user.selectOptions(selectElement, '5')

    await waitFor(() => {
      expect(window.api!.getLowStockProducts).toHaveBeenCalledWith(5)
    })
  })

  it('updates summary counts when threshold changes', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    const fewerProducts = [mockProducts[0]]
    vi.mocked(window.api!.getLowStockProducts).mockResolvedValueOnce(fewerProducts)

    const selectElement = screen.getByRole('combobox') as HTMLSelectElement
    await user.selectOptions(selectElement, '50')

    await waitFor(() => {
      expect(window.api!.getLowStockProducts).toHaveBeenCalledWith(50)
    })

    const totalCard = screen.getByText('Total low stock')
    // Should now show only 1 product instead of 4
    expect(totalCard.parentElement).toHaveTextContent('1')
  })

  it('rows are highlighted for zero stock items', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('WINE-001')).toBeInTheDocument()
    })

    const wineRow = screen.getByText('WINE-001').closest('tr')
    expect(wineRow).toHaveClass(/zero/)
  })

  it('rows are highlighted for below reorder point items', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('CHAMPAGNE-001')).toBeInTheDocument()
    })

    const champagneRow = screen.getByText('CHAMPAGNE-001').closest('tr')
    expect(champagneRow).toHaveClass(/below-reorder/)
  })

  it('rows are normally styled for at-threshold items', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('BEER-001')).toBeInTheDocument()
    })

    const beerRow = screen.getByText('BEER-001').closest('tr')
    expect(beerRow).toHaveClass(/at-threshold/)
  })

  it('handles empty product list gracefully', async () => {
    vi.mocked(window.api!.getLowStockProducts).mockResolvedValueOnce([])

    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total low stock')).toBeInTheDocument()
    })

    const totalCard = screen.getByText('Total low stock')
    expect(totalCard.parentElement).toHaveTextContent('0')
  })

  it('handles API error when loading products', async () => {
    vi.mocked(window.api!.getLowStockProducts).mockRejectedValueOnce(
      new Error('Failed to load low-stock products')
    )

    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  it('displays error state when API call fails', async () => {
    vi.mocked(window.api!.getLowStockProducts).mockRejectedValueOnce(
      new Error('Database connection failed')
    )

    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument()
    })
  })

  it('allows retrying after error via threshold change', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api!.getLowStockProducts).mockRejectedValueOnce(new Error('Connection error'))

    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument()
    })

    // Reset mock to succeed
    vi.mocked(window.api!.getLowStockProducts).mockResolvedValueOnce(mockProducts)

    const selectElement = screen.getByRole('combobox') as HTMLSelectElement
    await user.selectOptions(selectElement, '20')

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })
  })

  it('displays item_type for each product', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Wine')).toBeInTheDocument()
    })

    expect(screen.getByText('Sparkling')).toBeInTheDocument()
    expect(screen.getByText('Spirits')).toBeInTheDocument()
    expect(screen.getByText('Beer')).toBeInTheDocument()
  })

  it('shows label for stock threshold control', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/threshold/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/stock threshold/i)).toBeInTheDocument()
  })

  it('shows "Create Order" button when onCreateOrder prop is provided and products exist', async () => {
    const onCreateOrder = vi.fn()
    render(<ReorderDashboard onCreateOrder={onCreateOrder} />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    const createOrderButton = screen.getByRole('button', { name: /create order/i })
    expect(createOrderButton).toBeInTheDocument()
  })

  it('does not show "Create Order" button when onCreateOrder prop is not provided', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    const createOrderButton = screen.queryByRole('button', { name: /create order/i })
    expect(createOrderButton).not.toBeInTheDocument()
  })

  it('does not show "Create Order" button when no products exist', async () => {
    const onCreateOrder = vi.fn()
    vi.mocked(window.api!.getLowStockProducts).mockResolvedValueOnce([])

    render(<ReorderDashboard onCreateOrder={onCreateOrder} />)

    await waitFor(() => {
      expect(screen.getByText('Total low stock')).toBeInTheDocument()
    })

    const createOrderButton = screen.queryByRole('button', { name: /create order/i })
    expect(createOrderButton).not.toBeInTheDocument()
  })

  it('calls onCreateOrder with products when "Create Order" button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateOrder = vi.fn()
    render(<ReorderDashboard onCreateOrder={onCreateOrder} />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    const createOrderButton = screen.getByRole('button', { name: /create order/i })
    await user.click(createOrderButton)

    expect(onCreateOrder).toHaveBeenCalledWith(mockProducts)
  })

  it('passes all low stock products to onCreateOrder', async () => {
    const user = userEvent.setup()
    const onCreateOrder = vi.fn()

    const filteredProducts = mockProducts.slice(0, 2) // Only 2 products
    vi.mocked(window.api!.getLowStockProducts).mockResolvedValueOnce(filteredProducts)

    render(<ReorderDashboard onCreateOrder={onCreateOrder} />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    const createOrderButton = screen.getByRole('button', { name: /create order/i })
    await user.click(createOrderButton)

    expect(onCreateOrder).toHaveBeenCalledWith(filteredProducts)
    expect(onCreateOrder).toHaveBeenCalledTimes(1)
  })
})
