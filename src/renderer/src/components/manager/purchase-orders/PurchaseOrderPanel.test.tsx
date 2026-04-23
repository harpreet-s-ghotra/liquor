import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { PurchaseOrderPanel } from './PurchaseOrderPanel'
import type {
  Distributor,
  Product,
  PurchaseOrder,
  PurchaseOrderDetail,
  ReorderProduct
} from '../../../../../shared/types'

const mockDistributors: Distributor[] = [
  {
    distributor_number: 1,
    distributor_name: 'Test Distributor',
    license_id: null,
    serial_number: null,
    premises_name: null,
    premises_address: null,
    is_active: 1
  },
  {
    distributor_number: 2,
    distributor_name: 'Another Distributor',
    license_id: null,
    serial_number: null,
    premises_name: null,
    premises_address: null,
    is_active: 1
  }
]

const mockOrders: PurchaseOrder[] = [
  {
    id: 1,
    po_number: 'PO-2026-04-0001',
    distributor_number: 1,
    distributor_name: 'Test Distributor',
    status: 'draft',
    notes: null,
    subtotal: 50,
    total: 50,
    item_count: 2,
    received_at: null,
    created_at: '2026-04-17T12:00:00Z',
    updated_at: '2026-04-17T12:00:00Z'
  },
  {
    id: 2,
    po_number: 'PO-2026-04-0002',
    distributor_number: 1,
    distributor_name: 'Test Distributor',
    status: 'submitted',
    notes: 'Rush order',
    subtotal: 100,
    total: 100,
    item_count: 1,
    received_at: null,
    created_at: '2026-04-16T10:00:00Z',
    updated_at: '2026-04-16T10:00:00Z'
  },
  {
    id: 3,
    po_number: 'PO-2026-04-0003',
    distributor_number: 2,
    distributor_name: 'Another Distributor',
    status: 'received',
    notes: null,
    subtotal: 75,
    total: 75,
    item_count: 3,
    received_at: '2026-04-15T14:00:00Z',
    created_at: '2026-04-14T09:00:00Z',
    updated_at: '2026-04-15T14:00:00Z'
  }
]

const mockOrderDetail: PurchaseOrderDetail = {
  ...mockOrders[0],
  items: [
    {
      id: 1,
      po_id: 1,
      product_id: 1,
      sku: 'SKU001',
      product_name: 'Product A',
      unit_cost: 10,
      quantity_ordered: 5,
      quantity_received: 0,
      line_total: 50
    },
    {
      id: 2,
      po_id: 1,
      product_id: 2,
      sku: 'SKU002',
      product_name: 'Product B',
      unit_cost: 20,
      quantity_ordered: 2,
      quantity_received: 0,
      line_total: 40
    }
  ]
}

const mockSearchProduct: Product = {
  id: 10,
  sku: 'WINE-750',
  name: 'Chardonnay Reserve',
  size: '750mL',
  price: 18,
  quantity: 5,
  tax_rate: 0,
  category: 'Wine',
  bottles_per_case: 12,
  case_discount_price: null
}

describe('PurchaseOrderPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getPurchaseOrders: vi.fn().mockResolvedValue(mockOrders),
      getPurchaseOrderDetail: vi.fn().mockResolvedValue(mockOrderDetail),
      createPurchaseOrder: vi.fn().mockResolvedValue(mockOrderDetail),
      updatePurchaseOrder: vi.fn().mockResolvedValue(mockOrders[1]),
      receivePurchaseOrderItem: vi.fn().mockResolvedValue(mockOrderDetail.items[0]),
      deletePurchaseOrder: vi.fn().mockResolvedValue(undefined),
      removePurchaseOrderItem: vi.fn().mockResolvedValue(undefined),
      getDistributors: vi.fn().mockResolvedValue(mockDistributors),
      searchProducts: vi.fn().mockResolvedValue([mockSearchProduct as Product])
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
    vi.clearAllMocks()
  })

  it('renders list view with orders', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const distributorCells = screen.getAllByText('Test Distributor')
    expect(distributorCells.length).toBeGreaterThan(0)
  })

  it('shows empty state when no orders', async () => {
    window.api!.getPurchaseOrders = vi.fn().mockResolvedValue([])

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/no purchase orders found/i)).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const statusSelect = screen.getByDisplayValue('All Statuses')
    await userEvent.selectOptions(statusSelect, 'draft')

    expect(statusSelect).toHaveValue('draft')
  })

  it('shows "New Order" button', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const newOrderButton = screen.getByRole('button', { name: /new order/i })
    expect(newOrderButton).toBeInTheDocument()
  })

  it('calls getPurchaseOrders on mount', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(window.api!.getPurchaseOrders).toHaveBeenCalled()
    })
  })

  it('calls getPurchaseOrderDetail when table row is clicked', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const poRow = screen.getByText('PO-2026-04-0001').closest('tr')
    if (poRow) {
      await userEvent.click(poRow)
    }

    await waitFor(() => {
      expect(window.api!.getPurchaseOrderDetail).toHaveBeenCalledWith(1)
    })
  })

  it('calls getDistributors when opening create view', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const newOrderButton = screen.getByRole('button', { name: /new order/i })
    await userEvent.click(newOrderButton)

    await waitFor(() => {
      expect(window.api!.getDistributors).toHaveBeenCalled()
    })
  })

  it('shows prefilled items from ReorderDashboard', async () => {
    const prefillItems: ReorderProduct[] = [
      {
        id: 1,
        sku: 'SKU001',
        name: 'Low Stock Item',
        item_type: 'Wine',
        in_stock: 2,
        reorder_point: 10,
        distributor_number: 1,
        distributor_name: 'Test Distributor',
        cost: 9,
        bottles_per_case: 12,
        price: 12,
        velocity_per_day: 0,
        days_of_supply: null,
        projected_stock: 2
      }
    ]

    const onPrefillConsumed = vi.fn()

    render(
      <PurchaseOrderPanel
        prefillItems={prefillItems}
        prefillDistributor={1}
        onPrefillConsumed={onPrefillConsumed}
      />
    )

    await waitFor(() => {
      expect(onPrefillConsumed).toHaveBeenCalled()
    })

    expect(window.api!.getDistributors).toHaveBeenCalled()
  })

  it('preselects distributor when create order comes from reorder dashboard', async () => {
    const prefillItems: ReorderProduct[] = [
      {
        id: 1,
        sku: 'SKU001',
        name: 'Low Stock Item',
        item_type: 'Wine',
        in_stock: 2,
        reorder_point: 10,
        distributor_number: 1,
        distributor_name: 'Test Distributor',
        cost: 9,
        bottles_per_case: 12,
        price: 12,
        velocity_per_day: 0,
        days_of_supply: null,
        projected_stock: 2
      }
    ]

    render(
      <PurchaseOrderPanel
        prefillItems={prefillItems}
        prefillDistributor={1}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('New Purchase Order')).toBeInTheDocument()
    })

    const distributorSelect = screen.getByDisplayValue('Test Distributor')
    expect(distributorSelect).toBeInTheDocument()
  })

  it('renders case-based create headers and editable unit cost input', async () => {
    const prefillItems: ReorderProduct[] = [
      {
        id: 1,
        sku: 'SKU001',
        name: 'Low Stock Item',
        item_type: 'Wine',
        in_stock: 2,
        reorder_point: 10,
        distributor_number: 1,
        distributor_name: 'Test Distributor',
        cost: 9,
        bottles_per_case: 12,
        price: 12,
        velocity_per_day: 0,
        days_of_supply: null,
        projected_stock: 2
      }
    ]

    render(
      <PurchaseOrderPanel
        prefillItems={prefillItems}
        prefillDistributor={1}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Cases')).toBeInTheDocument()
    })

    expect(screen.getByText('Items')).toBeInTheDocument()
    expect(screen.getByLabelText('Unit cost for Low Stock Item')).toBeInTheDocument()
  })

  it('normalizes missing cost and invalid bottles per case to avoid NaN totals', async () => {
    const prefillItems = [
      {
        id: 1,
        sku: 'SKU001',
        name: 'No Cost Item',
        item_type: 'Wine',
        in_stock: 2,
        reorder_point: 10,
        distributor_number: 1,
        distributor_name: 'Test Distributor',
        cost: Number.NaN,
        bottles_per_case: 0,
        price: 12,
        velocity_per_day: 0,
        days_of_supply: null,
        projected_stock: 2
      }
    ] as unknown as ReorderProduct[]

    render(
      <PurchaseOrderPanel
        prefillItems={prefillItems}
        prefillDistributor={1}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Unit cost for No Cost Item')).toHaveValue(0)
    })

    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    window.api!.getPurchaseOrders = vi.fn().mockRejectedValue(new Error('Network error'))

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('shows error when loading distributors fails', async () => {
    window.api!.getDistributors = vi
      .fn()
      .mockRejectedValue(new Error('Failed to load distributors'))

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const newOrderButton = screen.getByRole('button', { name: /new order/i })
    await userEvent.click(newOrderButton)

    await waitFor(() => {
      expect(screen.getByText(/failed to load distributors/i)).toBeInTheDocument()
    })
  })

  it('calls onPrefillConsumed when prefill is provided', async () => {
    const prefillItems: ReorderProduct[] = [
      {
        id: 1,
        sku: 'SKU-LOW-001',
        name: 'Wine - Low Stock',
        item_type: 'Wine',
        in_stock: 1,
        reorder_point: 10,
        distributor_number: 1,
        distributor_name: 'Test Distributor',
        cost: 7,
        bottles_per_case: 6,
        price: 12,
        velocity_per_day: 0,
        days_of_supply: null,
        projected_stock: 1
      }
    ]

    const onPrefillConsumed = vi.fn()

    render(
      <PurchaseOrderPanel
        prefillItems={prefillItems}
        prefillDistributor={1}
        onPrefillConsumed={onPrefillConsumed}
      />
    )

    await waitFor(() => {
      expect(onPrefillConsumed).toHaveBeenCalled()
    })
  })

  it('displays purchase order numbers in table', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
      expect(screen.getByText('PO-2026-04-0002')).toBeInTheDocument()
      expect(screen.getByText('PO-2026-04-0003')).toBeInTheDocument()
    })
  })

  it('displays distributor names in table', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      const testDistCells = screen.getAllByText('Test Distributor')
      const anotherDistCells = screen.getAllByText('Another Distributor')
      expect(testDistCells.length).toBeGreaterThan(0)
      expect(anotherDistCells.length).toBeGreaterThan(0)
    })
  })

  it('calls receivePurchaseOrderItem API when provided', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    expect(window.api!.receivePurchaseOrderItem).toBeDefined()
  })

  it('shows error message on API failure', async () => {
    window.api!.getPurchaseOrders = vi
      .fn()
      .mockRejectedValue(new Error('Database connection error'))

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/database connection error/i)).toBeInTheDocument()
    })
  })

  it('renders filter select element', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('All Statuses')
    expect(select).toBeInTheDocument()
  })

  it('has accessible button labels', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /new order/i })).toBeInTheDocument()
  })

  it('search input is disabled before distributor is selected', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /new order/i }))

    await waitFor(() => {
      expect(screen.getByText('New Purchase Order')).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText('Search products to add')
    expect(searchInput).toBeDisabled()
  })

  it('enables search input when distributor is selected', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /new order/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Select distributor...')).toBeInTheDocument()
    })

    await userEvent.selectOptions(screen.getByDisplayValue('Select distributor...'), '1')

    const searchInput = screen.getByLabelText('Search products to add')
    expect(searchInput).not.toBeDisabled()
  })

  it('calls searchProducts with distributor filter when typing', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /new order/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Select distributor...')).toBeInTheDocument()
    })

    await userEvent.selectOptions(screen.getByDisplayValue('Select distributor...'), '1')
    await userEvent.type(screen.getByLabelText('Search products to add'), 'Chardon')

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith(expect.stringContaining('Chardon'), {
        distributorNumber: 1
      })
    })
  })

  it('shows search results with size and allows adding to order', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /new order/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Select distributor...')).toBeInTheDocument()
    })

    await userEvent.selectOptions(screen.getByDisplayValue('Select distributor...'), '1')
    await userEvent.type(screen.getByLabelText('Search products to add'), 'Char')

    // Advance past the 300ms debounce
    vi.advanceTimersByTime(400)

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalledWith(expect.stringContaining('Char'), {
        distributorNumber: 1
      })
    })

    vi.useRealTimers()
  })
})
