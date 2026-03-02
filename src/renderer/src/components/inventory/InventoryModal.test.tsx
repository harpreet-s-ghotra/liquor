import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryModal } from './InventoryModal'

describe('InventoryModal', () => {
  beforeEach(() => {
    // Provide minimal API stubs so child panels don't crash on mount
    const api = {
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
    expect(screen.getByText('Inventory Management')).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('tab', { name: 'Departments' }))

    expect(await screen.findByLabelText('Departments')).toBeInTheDocument()
  })

  it('switches to Tax Codes panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Tax Codes' }))

    expect(await screen.findByLabelText('Tax Codes')).toBeInTheDocument()
  })

  it('switches to Vendors panel when tab is clicked', async () => {
    render(<InventoryModal isOpen onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Vendors' }))

    expect(await screen.findByLabelText('Vendors')).toBeInTheDocument()
  })

  it('calls close handler when Close is clicked', async () => {
    const onClose = vi.fn()
    render(<InventoryModal isOpen onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
