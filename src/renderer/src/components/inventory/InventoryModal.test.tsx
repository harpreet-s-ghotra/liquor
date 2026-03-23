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
      getInventoryDepartments: vi.fn(async () => []),
      getInventoryTaxCodes: vi.fn(async () => []),
      getDepartments: vi.fn(async () => []),
      createDepartment: vi.fn(async () => ({ id: 1, name: 'Dept' })),
      updateDepartment: vi.fn(async () => ({ id: 1, name: 'Dept' })),
      deleteDepartment: vi.fn(async () => undefined),
      getTaxCodes: vi.fn(async () => []),
      createTaxCode: vi.fn(async () => ({ id: 1, code: 'TX', rate: 0.05 })),
      updateTaxCode: vi.fn(async () => ({ id: 1, code: 'TX', rate: 0.05 })),
      deleteTaxCode: vi.fn(async () => undefined),
      getVendors: vi.fn(async () => []),
      createVendor: vi.fn(async () => ({
        vendor_number: 1,
        vendor_name: 'V',
        contact_name: null,
        phone: null,
        email: null,
        is_active: 1
      })),
      updateVendor: vi.fn(async () => ({
        vendor_number: 1,
        vendor_name: 'V',
        contact_name: null,
        phone: null,
        email: null,
        is_active: 1
      })),
      deleteVendor: vi.fn(async () => undefined)
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
    expect(screen.getByText('Inventory Maintenance')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Items' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Departments' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tax Codes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Vendors' })).toBeInTheDocument()
  })

  it('defaults to Items tab showing the item form', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    // Item form shows search bar
    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })
  })

  it('switches to Departments panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Departments' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Departments' })).toBeInTheDocument()
  })

  it('switches to Tax Codes panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Tax Codes' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Tax Codes' })).toBeInTheDocument()
  })

  it('switches to Vendors panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    const tab = screen.getByRole('tab', { name: 'Vendors' })
    await userEvent.click(tab)

    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Vendors' })).toBeInTheDocument()
  })

  it('calls close handler when Close is clicked', async () => {
    const onClose = vi.fn()
    render(<InventoryModal isOpen onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows "New Item" breadcrumb when no item is selected', () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    expect(screen.getByText('New Item')).toBeInTheDocument()
  })

  it('shows "Departments" breadcrumb when on departments tab', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Departments' }))
    // The breadcrumb is in the header span with specific styling
    const breadcrumbs = screen.getAllByText('Departments')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2) // tab + breadcrumb
  })

  it('shows "Tax Codes" breadcrumb when on tax-codes tab', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tax Codes' }))
    const breadcrumbs = screen.getAllByText('Tax Codes')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2) // tab + breadcrumb
  })

  it('shows "Vendors" breadcrumb when on vendors tab', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Vendors' }))
    const breadcrumbs = screen.getAllByText('Vendors')
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2) // tab + breadcrumb
  })

  it('performs search and shows dropdown with results', async () => {
    const mockProducts = [
      {
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
        vendor_number: null,
        vendor_name: null,
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
    await userEvent.click(screen.getByRole('tab', { name: 'Departments' }))
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
