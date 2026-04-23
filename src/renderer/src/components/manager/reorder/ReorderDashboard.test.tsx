import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReorderDashboard } from './ReorderDashboard'
import type { ReorderDistributorRow, ReorderProduct } from '../../../../../shared/types'

// Simple in-memory localStorage stub for tests
function makeLocalStorageMock(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null
  } as Storage
}

const mockDistributors: ReorderDistributorRow[] = [
  { distributor_number: 2, distributor_name: 'Beta Spirits', product_count: 1 },
  { distributor_number: 1, distributor_name: 'Alpha Wine', product_count: 2 },
  { distributor_number: null, distributor_name: null, product_count: 1 }
]

const mockProducts: ReorderProduct[] = [
  {
    id: 1,
    sku: 'ALPHA-001',
    name: 'Cabernet Sauvignon',
    item_type: 'Wine',
    in_stock: 12,
    reorder_point: 15,
    distributor_number: 1,
    distributor_name: 'Alpha Wine',
    cost: 10,
    bottles_per_case: 12,
    price: 18,
    velocity_per_day: 1.25,
    days_of_supply: 9.6,
    projected_stock: -25.5
  },
  {
    id: 2,
    sku: 'ALPHA-002',
    name: 'Sparkling Brut',
    item_type: 'Sparkling',
    in_stock: 25,
    reorder_point: 12,
    distributor_number: 1,
    distributor_name: 'Alpha Wine',
    cost: 11,
    bottles_per_case: 12,
    price: 20,
    velocity_per_day: 0.5,
    days_of_supply: 50,
    projected_stock: 10
  },
  {
    id: 3,
    sku: 'ALPHA-003',
    name: 'Zero Velocity Item',
    item_type: 'Spirits',
    in_stock: 8,
    reorder_point: 5,
    distributor_number: 1,
    distributor_name: 'Alpha Wine',
    cost: 8,
    bottles_per_case: 6,
    price: 30,
    velocity_per_day: 0,
    days_of_supply: null,
    projected_stock: 8
  }
]

describe('ReorderDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getReorderDistributors: vi.fn().mockResolvedValue(mockDistributors),
      getReorderProducts: vi.fn().mockResolvedValue(mockProducts),
      searchInventoryProducts: vi.fn().mockResolvedValue([])
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('loads reorder distributors and defaults to the first alphabetical choice', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    expect(window.api!.getReorderDistributors).toHaveBeenCalled()
    expect(window.api!.getReorderProducts).toHaveBeenCalledWith({
      distributor: 1,
      unit_threshold: 10,
      window_days: 30
    })

    const distributorSelect = screen.getByLabelText('Distributor') as HTMLSelectElement
    expect(distributorSelect.value).toBe('1')
  })

  it('refetches when distributor changes', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api!.getReorderProducts)
      .mockResolvedValueOnce(mockProducts)
      .mockResolvedValueOnce([
        {
          ...mockProducts[0],
          id: 10,
          sku: 'BETA-001',
          name: 'Beta Product',
          distributor_number: 2,
          distributor_name: 'Beta Spirits'
        }
      ])

    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Distributor'), '2')

    await waitFor(() => {
      expect(window.api!.getReorderProducts).toHaveBeenLastCalledWith({
        distributor: 2,
        unit_threshold: 10,
        window_days: 30
      })
    })
  })

  it('supports the unassigned bucket', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Distributor'), 'unassigned')

    await waitFor(() => {
      expect(window.api!.getReorderProducts).toHaveBeenLastCalledWith({
        distributor: 'unassigned',
        unit_threshold: 10,
        window_days: 30
      })
    })
  })

  it('refetches when unit threshold changes', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Unit Threshold'), '20')

    await waitFor(() => {
      expect(window.api!.getReorderProducts).toHaveBeenLastCalledWith({
        distributor: 1,
        unit_threshold: 20,
        window_days: 30
      })
    })
  })

  it('refetches when time window changes', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Time Window'), '90')

    await waitFor(() => {
      expect(window.api!.getReorderProducts).toHaveBeenLastCalledWith({
        distributor: 1,
        unit_threshold: 10,
        window_days: 90
      })
    })
  })

  it('renders column headers and summary cards', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    // Column headers
    expect(screen.getByText('Days Supply')).toBeInTheDocument()
    expect(screen.getByText('Est. at 30d')).toBeInTheDocument()

    // Projected value visible in collapsed row
    expect(screen.getByText('-25.5')).toBeInTheDocument()
    // Days of supply visible
    expect(screen.getByText('9.6')).toBeInTheDocument()

    // Summary cards use window-days in label
    expect(screen.getByText('Will run out in 30d')).toBeInTheDocument()
    expect(screen.getByText('Below reorder point in 30d')).toBeInTheDocument()
    expect(screen.getByText('Total flagged')).toBeInTheDocument()
  })

  it('assigns row classes at each threshold boundary', async () => {
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    expect(screen.getByText('Cabernet Sauvignon').closest('.reorder-dashboard__row')).toHaveClass(
      'reorder-dashboard__row--out'
    )
    expect(screen.getByText('Sparkling Brut').closest('.reorder-dashboard__row')).toHaveClass(
      'reorder-dashboard__row--below-reorder'
    )
    expect(screen.getByText('Zero Velocity Item').closest('.reorder-dashboard__row')).toHaveClass(
      'reorder-dashboard__row--below-threshold'
    )
  })

  it('passes all products to onCreateOrder when none are selected', async () => {
    const user = userEvent.setup()
    const onCreateOrder = vi.fn()
    render(<ReorderDashboard onCreateOrder={onCreateOrder} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create order/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create order/i }))
    expect(onCreateOrder).toHaveBeenCalledWith(mockProducts, 1, 10)
  })

  it('shows empty state instead of hanging when no reorderable distributors exist', async () => {
    window.api!.getReorderDistributors = vi.fn().mockResolvedValue([])

    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/no reorderable distributors found/i)).toBeInTheDocument()
    })
  })

  it('disables create order for the unassigned bucket', async () => {
    const user = userEvent.setup()
    const onCreateOrder = vi.fn()
    render(<ReorderDashboard onCreateOrder={onCreateOrder} />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Distributor'), 'unassigned')

    await waitFor(() => {
      expect(window.api!.getReorderProducts).toHaveBeenLastCalledWith({
        distributor: 'unassigned',
        unit_threshold: 10,
        window_days: 30
      })
    })

    expect(screen.getByRole('button', { name: /create order/i })).toBeDisabled()
  })

  it('velocity is shown in expanded body, not in collapsed row', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Cabernet Sauvignon')).toBeInTheDocument()
    })

    // Velocity not visible in collapsed state
    expect(screen.queryByText('1.25/day')).not.toBeInTheDocument()

    // Expand the first row
    await user.click(screen.getByText('Cabernet Sauvignon'))

    await waitFor(() => {
      expect(screen.getByText('1.25')).toBeInTheDocument()
    })
  })

  it('shows zero-velocity fallback in expanded body', async () => {
    const user = userEvent.setup()
    render(<ReorderDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Zero Velocity Item')).toBeInTheDocument()
    })

    // Expand the zero-velocity row
    await user.click(screen.getByText('Zero Velocity Item'))

    await waitFor(() => {
      expect(screen.getByText(/No sales recorded in the last 365 days/i)).toBeInTheDocument()
    })
  })
})
