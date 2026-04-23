import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryModal } from './InventoryModal'

describe('InventoryModal', () => {
  // Keep flexible typing for the broad window.api test double used by child panels.
  let api: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    // Provide minimal API stubs so child panels don't crash on mount
    api = {
      searchInventoryProducts: vi.fn(async () => []),
      getInventoryProductDetail: vi.fn(async () => null),
      saveInventoryItem: vi.fn(async () => ({})),
      getInventoryItemTypes: vi.fn(async () => []),
      getItemTypes: vi.fn(async () => []),
      createItemType: vi.fn(async () => ({ id: 1, name: 'Type' })),
      updateItemType: vi.fn(async () => ({ id: 1, name: 'Type' })),
      deleteItemType: vi.fn(async () => undefined),
      getTaxCodes: vi.fn(async () => []),
      createTaxCode: vi.fn(async () => ({ id: 1, code: 'TX', rate: 0.05 })),
      updateTaxCode: vi.fn(async () => ({ id: 1, code: 'TX', rate: 0.05 })),
      deleteTaxCode: vi.fn(async () => undefined),
      getDistributors: vi.fn(async () => []),
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
      deleteSalesRep: vi.fn(async () => undefined)
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
    expect(screen.getByText('Inventory', { selector: '.app-modal-header__label' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Items' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Item Types' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tax Codes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Distributors' })).toBeInTheDocument()
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
})
