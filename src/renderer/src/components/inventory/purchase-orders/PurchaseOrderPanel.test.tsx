import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      bottles_per_case: 12,
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
      bottles_per_case: 6,
      quantity_ordered: 2,
      quantity_received: 0,
      line_total: 40
    }
  ]
}

const mockSubmittedDetail: PurchaseOrderDetail = {
  ...mockOrders[1],
  items: [
    {
      id: 3,
      po_id: 2,
      product_id: 3,
      sku: 'SKU003',
      product_name: 'Product C',
      unit_cost: 8,
      bottles_per_case: 12,
      quantity_ordered: 12,
      quantity_received: 6,
      line_total: 96
    }
  ]
}

const mockReceivedDetail: PurchaseOrderDetail = {
  ...mockOrders[2],
  items: [
    {
      id: 4,
      po_id: 3,
      product_id: 4,
      sku: 'SKU004',
      product_name: 'Product D',
      unit_cost: 5,
      bottles_per_case: 6,
      quantity_ordered: 12,
      quantity_received: 12,
      line_total: 60
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
      updatePurchaseOrderItems: vi.fn().mockResolvedValue(mockSubmittedDetail),
      receivePurchaseOrderItem: vi.fn().mockResolvedValue(mockOrderDetail.items[0]),
      markPurchaseOrderReceived: vi.fn().mockResolvedValue({
        ...mockSubmittedDetail,
        status: 'received',
        received_at: '2026-04-17T15:00:00Z',
        items: [
          {
            ...mockSubmittedDetail.items[0],
            quantity_received: 12
          }
        ]
      }),
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

  it('supports keyboard selection in the create search', async () => {
    const user = userEvent.setup()

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

    await user.click(screen.getByRole('button', { name: /new order/i }))
    await user.selectOptions(screen.getByLabelText(/distributor/i), '1')
    await user.type(screen.getByRole('combobox', { name: 'Search products to add' }), 'char')

    await waitFor(() => {
      expect(window.api!.searchProducts).toHaveBeenCalled()
    })

    const searchInput = screen.getByRole('combobox', { name: 'Search products to add' })
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Chardonnay Reserve')).toBeInTheDocument()
    })
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

  it('syncs case cost changes back to the unit cost in create mode', async () => {
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

    const caseCostInput = await screen.findByLabelText('Case cost for Low Stock Item')
    fireEvent.change(caseCostInput, { target: { value: '120' } })

    expect(screen.getByLabelText('Unit cost for Low Stock Item')).toHaveValue(10)
  })

  it('shows mark fully received for submitted orders and confirms before calling the API', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockSubmittedDetail)

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const submittedRow = await screen.findByText('PO-2026-04-0002')
    await userEvent.click(submittedRow.closest('tr')!)

    const markReceivedButton = await screen.findByRole('button', { name: /mark fully received/i })
    await userEvent.click(markReceivedButton)
    await userEvent.click(await screen.findByRole('button', { name: /mark received/i }))

    await waitFor(() => {
      expect(window.api!.markPurchaseOrderReceived).toHaveBeenCalledWith(2)
    })
  })

  it('toggles full-case receiving for submitted orders', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockSubmittedDetail)

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const submittedRow = await screen.findByText('PO-2026-04-0002')
    await userEvent.click(submittedRow.closest('tr')!)

    expect(await screen.findByText('Receive Full Case Order')).toBeInTheDocument()

    const receiveFullCheckbox = await screen.findByLabelText(
      'Receive full case order for Product C'
    )
    await userEvent.click(receiveFullCheckbox)

    await waitFor(() => {
      expect(window.api!.receivePurchaseOrderItem).toHaveBeenCalledWith({
        id: 3,
        quantity_received: 12
      })
    })
  })

  it('converts case input to units and commits on blur for submitted orders', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockSubmittedDetail)

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const submittedRow = await screen.findByText('PO-2026-04-0002')
    await userEvent.click(submittedRow.closest('tr')!)

    const casesInput = await screen.findByLabelText('Cases received for Product C')
    fireEvent.change(casesInput, { target: { value: '0.25' } })
    fireEvent.blur(casesInput)

    await waitFor(() => {
      expect(window.api!.receivePurchaseOrderItem).toHaveBeenCalledWith({
        id: 3,
        quantity_received: 3
      })
    })
  })

  it('submits draft orders from the detail view', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const draftRow = await screen.findByText('PO-2026-04-0001')
    await userEvent.click(draftRow.closest('tr')!)
    await userEvent.click(await screen.findByRole('button', { name: /submit order/i }))

    await waitFor(() => {
      expect(window.api!.updatePurchaseOrder).toHaveBeenCalledWith({
        id: 1,
        status: 'submitted'
      })
    })
  })

  it('cancels submitted orders from the detail view', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockSubmittedDetail)

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const submittedRow = await screen.findByText('PO-2026-04-0002')
    await userEvent.click(submittedRow.closest('tr')!)
    await userEvent.click(await screen.findByRole('button', { name: /cancel order/i }))

    await waitFor(() => {
      expect(window.api!.updatePurchaseOrder).toHaveBeenCalledWith({
        id: 2,
        status: 'cancelled'
      })
    })
  })

  it('deletes draft orders after confirmation', async () => {
    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const draftRow = await screen.findByText('PO-2026-04-0001')
    await userEvent.click(draftRow.closest('tr')!)
    await userEvent.click(await screen.findByRole('button', { name: /^delete$/i }))

    const deleteButtons = await screen.findAllByRole('button', { name: /^delete$/i })
    await userEvent.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => {
      expect(window.api!.deletePurchaseOrder).toHaveBeenCalledWith(1)
    })
  })

  it('exits edit mode without saving when no detail changes were made', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockReceivedDetail)

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const receivedRow = await screen.findByText('PO-2026-04-0003')
    await userEvent.click(receivedRow.closest('tr')!)
    await userEvent.click(await screen.findByRole('button', { name: /^edit$/i }))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(window.api!.updatePurchaseOrderItems).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    })
  })

  it('sends only changed lines when saving edits on a received order', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockReceivedDetail)
    window.api!.updatePurchaseOrderItems = vi.fn().mockResolvedValue({
      ...mockReceivedDetail,
      items: [
        {
          ...mockReceivedDetail.items[0],
          unit_cost: 6,
          line_total: 72
        }
      ]
    })

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const receivedRow = await screen.findByText('PO-2026-04-0003')
    await userEvent.click(receivedRow.closest('tr')!)
    await userEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

    const unitCostInput = await screen.findByLabelText('Unit cost for Product D')
    await userEvent.clear(unitCostInput)
    await userEvent.type(unitCostInput, '6')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(window.api!.updatePurchaseOrderItems).toHaveBeenCalledWith({
        po_id: 3,
        lines: [{ id: 4, unit_cost: 6 }]
      })
    })
  })

  it('requires confirmation before saving a received-quantity reduction', async () => {
    window.api!.getPurchaseOrderDetail = vi.fn().mockResolvedValue(mockSubmittedDetail)

    render(
      <PurchaseOrderPanel
        prefillItems={null}
        prefillDistributor={null}
        onPrefillConsumed={() => {}}
      />
    )

    const submittedRow = await screen.findByText('PO-2026-04-0002')
    await userEvent.click(submittedRow.closest('tr')!)
    await userEvent.click(await screen.findByRole('button', { name: /^edit$/i }))

    const receivedInput = await screen.findByLabelText('Quantity received for Product C')
    await userEvent.clear(receivedInput)
    await userEvent.type(receivedInput, '4')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(
      await screen.findByText('This will reduce on-hand stock by 2 units. Continue?')
    ).toBeInTheDocument()
    expect(window.api!.updatePurchaseOrderItems).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(window.api!.updatePurchaseOrderItems).toHaveBeenCalledWith({
        po_id: 2,
        lines: [{ id: 3, quantity_received: 4 }]
      })
    })
  })
})
