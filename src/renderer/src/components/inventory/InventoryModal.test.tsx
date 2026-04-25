import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryModal } from './InventoryModal'

describe('InventoryModal', () => {
  // Keep flexible typing for the broad window.api test double used by child panels.
  let api: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    window.localStorage.clear()

    // Provide minimal API stubs so child panels don't crash on mount
    api = {
      searchInventoryProducts: vi.fn(async () => []),
      getInventoryProductDetail: vi.fn(async () => null),
      getInventoryTaxCodes: vi.fn(async () => []),
      saveInventoryItem: vi.fn(async () => ({})),
      getInventoryItemTypes: vi.fn(async () => []),
      getItemTypes: vi.fn(async () => []),
      getUnpricedProducts: vi.fn(async () => []),
      createItemType: vi.fn(async () => ({ id: 1, name: 'Type' })),
      updateItemType: vi.fn(async () => ({ id: 1, name: 'Type' })),
      deleteItemType: vi.fn(async () => undefined),
      getTaxCodes: vi.fn(async () => []),
      createTaxCode: vi.fn(async () => ({ id: 1, code: 'TX', rate: 0.05 })),
      updateTaxCode: vi.fn(async () => ({ id: 1, code: 'TX', rate: 0.05 })),
      deleteTaxCode: vi.fn(async () => undefined),
      getDistributors: vi.fn(async () => [
        {
          distributor_number: 1,
          distributor_name: 'North Wines',
          license_id: null,
          serial_number: null,
          premises_name: null,
          premises_address: null,
          is_active: 1
        }
      ]),
      createDistributor: vi.fn(async () => ({
        distributor_number: 1,
        distributor_name: 'D',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1
      })),
      updateDistributor: vi.fn(async () => ({
        distributor_number: 1,
        distributor_name: 'D',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1
      })),
      deleteDistributor: vi.fn(async () => undefined),
      getSalesRepsByDistributor: vi.fn(async () => []),
      createSalesRep: vi.fn(async () => ({
        sales_rep_id: 1,
        distributor_number: 1,
        rep_name: 'R',
        phone: null,
        email: null,
        is_active: 1
      })),
      deleteSalesRep: vi.fn(async () => undefined),
      getReorderDistributors: vi.fn(async () => [
        {
          distributor_number: 1,
          distributor_name: 'North Wines',
          product_count: 1
        }
      ]),
      getReorderProducts: vi.fn(async () => ({
        rows: [
          {
            id: 1,
            sku: 'WINE-001',
            name: 'Cabernet',
            item_type: 'Wine',
            in_stock: 2,
            reorder_point: 10,
            distributor_number: 1,
            distributor_name: 'North Wines',
            cost: 8,
            bottles_per_case: 12,
            price: 15,
            velocity_per_day: 0.2,
            days_of_supply: 10,
            projected_stock: -4
          }
        ],
        velocityOffline: false
      })),
      getPurchaseOrders: vi.fn(async () => []),
      getPurchaseOrderDetail: vi.fn(async () => null),
      createPurchaseOrder: vi.fn(async () => ({
        id: 1,
        po_number: 'PO-2026-04-0001',
        distributor_number: 1,
        distributor_name: 'North Wines',
        status: 'draft',
        notes: null,
        subtotal: 0,
        total: 0,
        item_count: 1,
        received_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        items: []
      })),
      updatePurchaseOrder: vi.fn(async () => ({})),
      receivePurchaseOrderItem: vi.fn(async () => ({})),
      deletePurchaseOrder: vi.fn(async () => undefined)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = api
  })

  it('does not render when closed', () => {
    render(<InventoryModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog', { name: 'Inventory Management' })).not.toBeInTheDocument()
  })

  it('renders dialog with header and tabs when open', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Inventory Management' })).toBeInTheDocument()
    // AppModalHeader renders "Inventory" as the breadcrumb label
    expect(
      screen.getByText('Inventory', { selector: '.app-modal-header__label' })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Items' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Item Types' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tax Codes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Distributors' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Reorder' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Purchase Orders' })).toBeInTheDocument()
  })

  it('defaults to Items tab showing the item form', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    // Item form shows search bar
    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })
  })

  it('switches to Item Types panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Item Types' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Item Types' })).toBeInTheDocument()
  })

  it('switches to Tax Codes panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Tax Codes' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Tax Codes' })).toBeInTheDocument()
  })

  it('switches to Distributors panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Distributors' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Distributors' })).toBeInTheDocument()
  })

  it('switches to Reorder panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Reorder' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Cabernet')).toBeInTheDocument()
  })

  it('switches to Purchase Orders panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Purchase Orders' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('No purchase orders found.')).toBeInTheDocument()
  })

  it('calls close handler when Close is clicked', async () => {
    const onClose = vi.fn()
    render(<InventoryModal isOpen onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: /^Close/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "New Item" breadcrumb when no item is selected', () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    expect(screen.getByText('New Item')).toBeInTheDocument()
  })

  it('shows "Item Types" breadcrumb when on item types tab', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Item Types' }))
    // The breadcrumb is in the header span with specific styling
    const breadcrumbs = screen.getAllByText('Item Types')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2) // tab + breadcrumb
  })

  it('shows "Tax Codes" breadcrumb when on tax-codes tab', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tax Codes' }))
    const breadcrumbs = screen.getAllByText('Tax Codes')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2) // tab + breadcrumb
  })

  it('shows "Distributors" breadcrumb when on vendors tab', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Distributors' }))
    const breadcrumbs = screen.getAllByText('Distributors')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2) // tab + breadcrumb
  })

  it('shows reorder and purchase order breadcrumbs on the procurement tabs', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Reorder' }))
    expect(
      screen.getByText('Reorder Dashboard', { selector: '.app-modal-header__title' })
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Purchase Orders' }))
    expect(
      screen.getByText('Purchase Orders', { selector: '.app-modal-header__title' })
    ).toBeInTheDocument()
  })

  it('hands off reorder selections to purchase orders inside inventory', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Reorder' }))
    await waitFor(() => {
      expect(screen.getByText('Cabernet')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Create Order' }))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Purchase Orders' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
    expect(screen.getByText('New Purchase Order')).toBeInTheDocument()
  })

  it('performs search and shows dropdown with results', async () => {
    const mockProducts = [
      {
        item_number: 1,
        sku: 'WINE-001',
        item_name: 'Red Wine',
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
        description: null
      }
    ]
    vi.mocked(api.searchInventoryProducts).mockResolvedValue(mockProducts)

    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const searchInput = screen.getByLabelText('Search Inventory')
    await userEvent.type(searchInput, 'wine')

    // Click the Search button
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(api.searchInventoryProducts).toHaveBeenCalledWith('wine')
    })
  })

  it('shows no-results prompt when search returns empty', async () => {
    vi.mocked(api.searchInventoryProducts).mockResolvedValue([])

    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const searchInput = screen.getByLabelText('Search Inventory')
    await userEvent.type(searchInput, 'NONEXISTENT')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('NONEXISTENT')).toBeInTheDocument()
    })
  })

  it('clears search term and no-results on tab switch', async () => {
    vi.mocked(api.searchInventoryProducts).mockResolvedValue([])

    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const searchInput = screen.getByLabelText('Search Inventory')
    await userEvent.type(searchInput, 'test')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument()
    })

    // Switch tabs — should reset search
    await userEvent.click(screen.getByRole('tab', { name: 'Item Types' }))
    // Switch back
    await userEvent.click(screen.getByRole('tab', { name: 'Items' }))

    expect(screen.getByLabelText('Search Inventory')).toHaveValue('')
  })

  it('clears no-results when search term changes', async () => {
    vi.mocked(api.searchInventoryProducts).mockResolvedValue([])

    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const searchInput = screen.getByLabelText('Search Inventory')
    await userEvent.type(searchInput, 'XYZ')
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('XYZ')).toBeInTheDocument()
    })

    // Typing more should clear the no-results
    await userEvent.type(searchInput, '1')
    await waitFor(() => {
      expect(screen.queryByText('+ Add New Item')).not.toBeInTheDocument()
    })
  })

  it('forces the items tab open when openItemNumber is provided', async () => {
    window.localStorage.setItem('inventory-modal-last-tab', 'tax-codes')

    render(<InventoryModal isOpen onClose={vi.fn()} openItemNumber={42} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Items' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: 'Tax Codes' })).toHaveAttribute(
        'aria-selected',
        'false'
      )
    })
  })

  it('loads the requested item even when last open tab was not Items', async () => {
    // Regression: ItemForm ref was null because selectItem was called in the same
    // tick as setActiveTab('items') — before the items tab mounted ItemForm.
    window.localStorage.setItem('inventory-modal-last-tab', 'tax-codes')

    const detailMock = vi.mocked(api.getInventoryProductDetail).mockResolvedValueOnce({
      item_number: 77,
      sku: 'AUTO-77',
      item_name: 'Auto Loaded Item',
      item_type: 'Wine',
      category_id: null,
      category_name: null,
      cost: 5,
      retail_price: 10,
      in_stock: 4,
      tax_1: 0,
      tax_2: 0,
      distributor_number: null,
      distributor_name: null,
      bottles_per_case: 12,
      case_discount_price: null,
      barcode: null,
      description: null,
      special_pricing_enabled: 0,
      special_price: null,
      is_active: 1,
      size: null,
      case_cost: null,
      nysla_discounts: null,
      brand_name: null,
      proof: null,
      alcohol_pct: null,
      vintage: null,
      ttb_id: null,
      display_name: null,
      is_favorite: 0,
      is_discontinued: 0,
      additional_skus: [],
      tax_rates: [],
      special_pricing: [],
      sales_history: []
    })

    render(<InventoryModal isOpen onClose={vi.fn()} openItemNumber={77} />)

    await waitFor(() => {
      expect(detailMock).toHaveBeenCalledWith(77)
    })
  })

  it('activates needs-pricing mode and clears it when typing a manual search', async () => {
    vi.mocked(api.getUnpricedProducts).mockResolvedValue([
      {
        item_number: 9,
        sku: 'UNPRICED-001',
        item_name: 'Unpriced Item',
        category_id: null,
        category_name: null,
        item_type: 'Wine',
        cost: 3,
        retail_price: 0,
        in_stock: 4,
        tax_1: 0,
        tax_2: 0,
        distributor_number: 1,
        distributor_name: 'North Wines',
        bottles_per_case: 12,
        case_discount_price: null,
        special_pricing_enabled: 0,
        special_price: null,
        is_active: 1,
        barcode: null,
        description: null,
        size: null,
        case_cost: null,
        nysla_discounts: null,
        brand_name: null,
        proof: null,
        alcohol_pct: null,
        vintage: null,
        ttb_id: null,
        display_name: null
      }
    ])

    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const needsPricingChip = await screen.findByRole('button', { name: /Needs pricing/i })
    await waitFor(() => {
      expect(needsPricingChip).toHaveTextContent('1')
    })

    await userEvent.click(needsPricingChip)

    await waitFor(() => {
      expect(api.getUnpricedProducts).toHaveBeenCalledTimes(2)
      expect(needsPricingChip.className).toContain('inventory-modal__filter-chip--active')
    })

    await userEvent.type(screen.getByLabelText('Search Inventory'), 'C')

    await waitFor(() => {
      expect(needsPricingChip.className).not.toContain('inventory-modal__filter-chip--active')
    })
  })
})
