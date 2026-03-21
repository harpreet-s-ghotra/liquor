import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VendorPanel } from './VendorPanel'

type V = {
  vendor_number: number
  vendor_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  is_active: number
}

describe('VendorPanel', () => {
  let store: V[]

  beforeEach(() => {
    store = [
      {
        vendor_number: 1,
        vendor_name: 'Acme Wine Co',
        contact_name: 'John Doe',
        phone: '555-1234',
        email: 'john@acme.com',
        is_active: 1
      },
      {
        vendor_number: 2,
        vendor_name: 'Best Spirits',
        contact_name: null,
        phone: null,
        email: null,
        is_active: 1
      }
    ]

    const api = {
      getVendors: vi.fn(async () => [...store]),
      createVendor: vi.fn(
        async (input: {
          vendor_name: string
          contact_name?: string
          phone?: string
          email?: string
        }) => {
          const v: V = {
            vendor_number: store.length + 1,
            vendor_name: input.vendor_name,
            contact_name: input.contact_name || null,
            phone: input.phone || null,
            email: input.email || null,
            is_active: 1
          }
          store.push(v)
          return v
        }
      ),
      updateVendor: vi.fn(
        async (input: {
          vendor_number: number
          vendor_name: string
          contact_name?: string
          phone?: string
          email?: string
        }) => {
          const idx = store.findIndex((v) => v.vendor_number === input.vendor_number)
          if (idx >= 0) {
            store[idx] = {
              ...store[idx],
              vendor_name: input.vendor_name,
              contact_name: input.contact_name || null,
              phone: input.phone || null,
              email: input.email || null
            }
          }
          return store[idx]
        }
      ),
      deleteVendor: vi.fn(async (num: number) => {
        store = store.filter((v) => v.vendor_number !== num)
        return undefined
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { ...(window as any).api, ...api }
  })

  /** Helper: click a table row to select a vendor */
  const selectRow = async (name: string): Promise<void> => {
    const cell = await screen.findByText(name)
    fireEvent.click(cell.closest('tr')!)
  }

  it('loads and displays vendors', async () => {
    render(<VendorPanel />)

    expect(await screen.findByText('Acme Wine Co')).toBeInTheDocument()
    expect(screen.getByText('Best Spirits')).toBeInTheDocument()
  })

  it('displays vendor contact details', async () => {
    render(<VendorPanel />)

    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('555-1234')).toBeInTheDocument()
    expect(screen.getByText('john@acme.com')).toBeInTheDocument()
  })

  it('shows empty state when no vendors', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getVendors = vi.fn(async () => [])

    render(<VendorPanel />)

    expect(
      await screen.findByText('No vendors yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('shows placeholder text when nothing selected', async () => {
    render(<VendorPanel />)

    expect(
      await screen.findByText('Select a vendor above to view and edit its details.')
    ).toBeInTheDocument()
  })

  it('validates empty vendor name', async () => {
    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Vendor name is required')).toBeInTheDocument()
  })

  it('creates a vendor', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Vendor Name'), {
      target: { value: 'New Vendor' }
    })
    fireEvent.change(screen.getByLabelText('Contact Name'), {
      target: { value: 'Jane' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.createVendor).toHaveBeenCalledWith({
        vendor_name: 'New Vendor',
        contact_name: 'Jane',
        phone: undefined,
        email: undefined
      })
    })
    expect(await screen.findByText('Vendor created')).toBeInTheDocument()
  })

  it('selects a vendor and shows edit panel', async () => {
    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    expect(screen.getByLabelText('Edit Vendor Name')).toHaveValue('Acme Wine Co')
    expect(screen.getByLabelText('Edit Contact Name')).toHaveValue('John Doe')
    expect(screen.getByLabelText('Edit Phone')).toHaveValue('555-1234')
    expect(screen.getByLabelText('Edit Email')).toHaveValue('john@acme.com')
    expect(screen.getByText('Editing: Acme Wine Co')).toBeInTheDocument()
  })

  it('edits and saves a vendor via bottom panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    const nameInput = screen.getByLabelText('Edit Vendor Name')
    fireEvent.change(nameInput, { target: { value: 'Acme Wines Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateVendor).toHaveBeenCalledWith(
        expect.objectContaining({
          vendor_number: 1,
          vendor_name: 'Acme Wines Updated'
        })
      )
    })
    expect(await screen.findByText('Vendor saved')).toBeInTheDocument()
  })

  it('deletes a vendor via bottom panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await selectRow('Acme Wine Co')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(api.deleteVendor).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Vendor deleted')).toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.createVendor = vi.fn(async () => {
      throw new Error('Duplicate vendor')
    })

    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Vendor Name'), {
      target: { value: 'Bad Vendor' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Duplicate vendor')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateVendor = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<VendorPanel />)

    await selectRow('Acme Wine Co')
    fireEvent.change(screen.getByLabelText('Edit Vendor Name'), {
      target: { value: 'Acme Changed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteVendor = vi.fn(async () => {
      throw new Error('In use')
    })

    render(<VendorPanel />)

    await selectRow('Acme Wine Co')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('In use')).toBeInTheDocument()
  })

  it('validates empty edit name', async () => {
    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    fireEvent.change(screen.getByLabelText('Edit Vendor Name'), {
      target: { value: '' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Vendor name is required')).toBeInTheDocument()
  })

  it('shows all edit fields pre-populated when selecting a vendor', async () => {
    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    expect(screen.getByLabelText('Edit Vendor Name')).toHaveValue('Acme Wine Co')
    expect(screen.getByLabelText('Edit Contact Name')).toHaveValue('John Doe')
    expect(screen.getByLabelText('Edit Phone')).toHaveValue('555-1234')
    expect(screen.getByLabelText('Edit Email')).toHaveValue('john@acme.com')
  })

  it('saves edit via Enter key on name field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    const nameInput = screen.getByLabelText('Edit Vendor Name')
    fireEvent.keyDown(nameInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateVendor).toHaveBeenCalled()
    })
  })

  it('saves edit via Enter key on email field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    const emailInput = screen.getByLabelText('Edit Email')
    fireEvent.keyDown(emailInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateVendor).toHaveBeenCalled()
    })
  })

  it('creates vendor via Enter key on email field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Vendor Name'), {
      target: { value: 'Enter Vendor' }
    })
    fireEvent.keyDown(screen.getByLabelText('Email'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createVendor).toHaveBeenCalled()
    })
  })

  it('validates invalid email on create', async () => {
    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Vendor Name'), {
      target: { value: 'Good Vendor' }
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Invalid email format')).toBeInTheDocument()
  })

  it('validates invalid phone on create', async () => {
    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Vendor Name'), {
      target: { value: 'Good Vendor' }
    })
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '123' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Must have at least 7 digits')).toBeInTheDocument()
  })

  it('accepts valid phone and email on create', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<VendorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Vendor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Vendor Name'), {
      target: { value: 'Valid Vendor' }
    })
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '(555) 123-4567' }
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'vendor@example.com' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.createVendor).toHaveBeenCalledWith({
        vendor_name: 'Valid Vendor',
        contact_name: undefined,
        phone: '(555) 123-4567',
        email: 'vendor@example.com'
      })
    })
  })

  it('validates invalid email during edit', async () => {
    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    fireEvent.change(screen.getByLabelText('Edit Email'), {
      target: { value: 'bad-email' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Invalid email format')).toBeInTheDocument()
  })

  it('validates invalid phone during edit', async () => {
    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    fireEvent.change(screen.getByLabelText('Edit Phone'), {
      target: { value: '12' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Must have at least 7 digits')).toBeInTheDocument()
  })

  it('filters vendors via bottom search bar', async () => {
    render(<VendorPanel />)

    await screen.findByText('Acme Wine Co')

    const searchInput = screen.getByLabelText('Search Vendors')
    fireEvent.change(searchInput, { target: { value: 'best' } })

    expect(screen.queryByText('Acme Wine Co')).not.toBeInTheDocument()
    expect(screen.getByText('Best Spirits')).toBeInTheDocument()
  })

  it('shows no-match message when search yields no results', async () => {
    render(<VendorPanel />)

    await screen.findByText('Acme Wine Co')

    const searchInput = screen.getByLabelText('Search Vendors')
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } })

    expect(screen.getByText('No vendors match your search.')).toBeInTheDocument()
  })

  it('refreshes edit form from backend data after save', async () => {
    render(<VendorPanel />)

    await selectRow('Acme Wine Co')

    fireEvent.change(screen.getByLabelText('Edit Vendor Name'), {
      target: { value: 'Acme Updated' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Edit Vendor Name')).toHaveValue('Acme Updated')
    })
    // Table should also reflect the change
    expect(screen.getByText('Acme Updated')).toBeInTheDocument()
  })
})
