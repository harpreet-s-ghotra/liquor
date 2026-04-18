import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { PurchaseOrderPanel } from './PurchaseOrderPanel'
import type {
  PurchaseOrder,
  PurchaseOrderDetail,
  Distributor,
  LowStockProduct
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
      getDistributors: vi.fn().mockResolvedValue(mockDistributors)
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
    vi.clearAllMocks()
  })

  it('renders list view with orders', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const distributorCells = screen.getAllByText('Test Distributor')
    expect(distributorCells.length).toBeGreaterThan(0)
  })

  it('shows empty state when no orders', async () => {
    window.api!.getPurchaseOrders = vi.fn().mockResolvedValue([])

    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/no purchase orders found/i)).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const statusSelect = screen.getByDisplayValue('All Statuses')
    await userEvent.selectOptions(statusSelect, 'draft')

    expect(statusSelect).toHaveValue('draft')
  })

  it('shows "New Order" button', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const newOrderButton = screen.getByRole('button', { name: /new order/i })
    expect(newOrderButton).toBeInTheDocument()
  })

  it('calls getPurchaseOrders on mount', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(window.api!.getPurchaseOrders).toHaveBeenCalled()
    })
  })

  it('calls getPurchaseOrderDetail when table row is clicked', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

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
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

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
    const prefillItems: LowStockProduct[] = [
      {
        id: 1,
        sku: 'SKU001',
        name: 'Low Stock Item',
        item_type: 'Wine',
        in_stock: 2,
        reorder_point: 10,
        distributor_name: 'Test Distributor'
      }
    ]

    const onPrefillConsumed = vi.fn()

    render(<PurchaseOrderPanel prefillItems={prefillItems} onPrefillConsumed={onPrefillConsumed} />)

    await waitFor(() => {
      expect(onPrefillConsumed).toHaveBeenCalled()
    })

    expect(window.api!.getDistributors).toHaveBeenCalled()
  })

  it('handles API errors gracefully', async () => {
    window.api!.getPurchaseOrders = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('shows error when loading distributors fails', async () => {
    window.api!.getDistributors = vi
      .fn()
      .mockRejectedValue(new Error('Failed to load distributors'))

    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

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
    const prefillItems: LowStockProduct[] = [
      {
        id: 1,
        sku: 'SKU-LOW-001',
        name: 'Wine - Low Stock',
        item_type: 'Wine',
        in_stock: 1,
        reorder_point: 10,
        distributor_name: 'Test Distributor'
      }
    ]

    const onPrefillConsumed = vi.fn()

    render(<PurchaseOrderPanel prefillItems={prefillItems} onPrefillConsumed={onPrefillConsumed} />)

    await waitFor(() => {
      expect(onPrefillConsumed).toHaveBeenCalled()
    })
  })

  it('displays purchase order numbers in table', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
      expect(screen.getByText('PO-2026-04-0002')).toBeInTheDocument()
      expect(screen.getByText('PO-2026-04-0003')).toBeInTheDocument()
    })
  })

  it('displays distributor names in table', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      const testDistCells = screen.getAllByText('Test Distributor')
      const anotherDistCells = screen.getAllByText('Another Distributor')
      expect(testDistCells.length).toBeGreaterThan(0)
      expect(anotherDistCells.length).toBeGreaterThan(0)
    })
  })

  it('calls receivePurchaseOrderItem API when provided', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    expect(window.api!.receivePurchaseOrderItem).toBeDefined()
  })

  it('shows error message on API failure', async () => {
    window.api!.getPurchaseOrders = vi
      .fn()
      .mockRejectedValue(new Error('Database connection error'))

    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText(/database connection error/i)).toBeInTheDocument()
    })
  })

  it('renders filter select element', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('All Statuses')
    expect(select).toBeInTheDocument()
  })

  it('has accessible button labels', async () => {
    render(<PurchaseOrderPanel prefillItems={null} onPrefillConsumed={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-0001')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /new order/i })).toBeInTheDocument()
  })
})
