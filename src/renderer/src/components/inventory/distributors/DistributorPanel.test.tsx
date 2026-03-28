import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DistributorPanel } from './DistributorPanel'

type D = {
  distributor_number: number
  distributor_name: string
  license_id: string | null
  serial_number: string | null
  premises_name: string | null
  premises_address: string | null
  is_active: number
}

type SR = {
  sales_rep_id: number
  distributor_number: number
  rep_name: string
  phone: string | null
  email: string | null
  is_active: number
}

describe('DistributorPanel', () => {
  let store: D[]
  let repsStore: SR[]

  beforeEach(() => {
    store = [
      {
        distributor_number: 1,
        distributor_name: 'Empire Merchants North',
        license_id: 'LIC-001',
        serial_number: 'SN-001',
        premises_name: 'Main Warehouse',
        premises_address: '123 Distillery Rd',
        is_active: 1
      },
      {
        distributor_number: 2,
        distributor_name: 'Best Spirits LLC',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1
      }
    ]

    repsStore = [
      {
        sales_rep_id: 1,
        distributor_number: 1,
        rep_name: 'John Doe',
        phone: '555-1234',
        email: 'john@empire.com',
        is_active: 1
      }
    ]

    const api = {
      getDistributors: vi.fn(async () => [...store]),
      createDistributor: vi.fn(async (input: { distributor_name: string }) => {
        const d: D = {
          distributor_number: store.length + 1,
          distributor_name: input.distributor_name,
          license_id: null,
          serial_number: null,
          premises_name: null,
          premises_address: null,
          is_active: 1
        }
        store.push(d)
        return d
      }),
      updateDistributor: vi.fn(
        async (input: {
          distributor_number: number
          distributor_name: string
          license_id?: string
          serial_number?: string
          premises_name?: string
          premises_address?: string
        }) => {
          const idx = store.findIndex((d) => d.distributor_number === input.distributor_number)
          if (idx >= 0) {
            store[idx] = {
              ...store[idx],
              distributor_name: input.distributor_name,
              license_id: input.license_id || null,
              serial_number: input.serial_number || null,
              premises_name: input.premises_name || null,
              premises_address: input.premises_address || null
            }
          }
          return store[idx]
        }
      ),
      deleteDistributor: vi.fn(async (num: number) => {
        store = store.filter((d) => d.distributor_number !== num)
        return undefined
      }),
      getSalesRepsByDistributor: vi.fn(async (distNum: number) =>
        repsStore.filter((r) => r.distributor_number === distNum)
      ),
      createSalesRep: vi.fn(
        async (input: {
          distributor_number: number
          rep_name: string
          phone?: string
          email?: string
        }) => {
          const rep: SR = {
            sales_rep_id: repsStore.length + 1,
            distributor_number: input.distributor_number,
            rep_name: input.rep_name,
            phone: input.phone || null,
            email: input.email || null,
            is_active: 1
          }
          repsStore.push(rep)
          return rep
        }
      ),
      deleteSalesRep: vi.fn(async (repId: number) => {
        repsStore = repsStore.filter((r) => r.sales_rep_id !== repId)
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { ...(window as any).api, ...api }
  })

  /** Helper: click a table row to select a distributor */
  const selectRow = async (name: string): Promise<void> => {
    const cell = await screen.findByText(name)
    fireEvent.click(cell.closest('tr')!)
  }

  it('loads and displays distributors', async () => {
    render(<DistributorPanel />)

    expect(await screen.findByText('Empire Merchants North')).toBeInTheDocument()
    expect(screen.getByText('Best Spirits LLC')).toBeInTheDocument()
  })

  it('displays distributor license details in table', async () => {
    render(<DistributorPanel />)

    expect(await screen.findByText('LIC-001')).toBeInTheDocument()
    expect(screen.getByText('Main Warehouse')).toBeInTheDocument()
  })

  it('shows empty state when no distributors', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getDistributors = vi.fn(async () => [])

    render(<DistributorPanel />)

    expect(
      await screen.findByText('No distributors yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('shows placeholder text when nothing selected', async () => {
    render(<DistributorPanel />)

    expect(
      await screen.findByText('Select a distributor above to view and edit its details.')
    ).toBeInTheDocument()
  })

  it('validates empty distributor name', async () => {
    render(<DistributorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Distributor Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Distributor name is required')).toBeInTheDocument()
  })

  it('creates a distributor with just a name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Distributor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Distributor Name'), {
      target: { value: 'New Distributor' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.createDistributor).toHaveBeenCalledWith({
        distributor_name: 'New Distributor'
      })
    })
    expect(await screen.findByText('Distributor created')).toBeInTheDocument()
  })

  it('selects a distributor and shows edit panel with license fields', async () => {
    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')

    expect(screen.getByLabelText('Edit Distributor Name')).toHaveValue('Empire Merchants North')
    expect(screen.getByLabelText('Edit License ID')).toHaveValue('LIC-001')
    expect(screen.getByLabelText('Edit Serial Number')).toHaveValue('SN-001')
    expect(screen.getByLabelText('Edit Premises Name')).toHaveValue('Main Warehouse')
    expect(screen.getByLabelText('Edit Premises Address')).toHaveValue('123 Distillery Rd')
    expect(screen.getByText('Editing: Empire Merchants North')).toBeInTheDocument()
  })

  it('edits and saves a distributor via bottom panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')

    const nameInput = screen.getByLabelText('Edit Distributor Name')
    fireEvent.change(nameInput, { target: { value: 'Empire Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateDistributor).toHaveBeenCalledWith(
        expect.objectContaining({
          distributor_number: 1,
          distributor_name: 'Empire Updated'
        })
      )
    })
    expect(await screen.findByText('Distributor saved')).toBeInTheDocument()
  })

  it('deletes a distributor via bottom panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    await waitFor(() => {
      expect(api.deleteDistributor).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Distributor deleted')).toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.createDistributor = vi.fn(async () => {
      throw new Error('Duplicate distributor')
    })

    render(<DistributorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Distributor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Distributor Name'), {
      target: { value: 'Bad Distributor' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Duplicate distributor')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateDistributor = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    fireEvent.change(screen.getByLabelText('Edit Distributor Name'), {
      target: { value: 'Empire Changed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteDistributor = vi.fn(async () => {
      throw new Error('In use')
    })

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    expect(await screen.findByText('In use')).toBeInTheDocument()
  })

  it('validates empty edit name', async () => {
    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')

    fireEvent.change(screen.getByLabelText('Edit Distributor Name'), {
      target: { value: '' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Distributor name is required')).toBeInTheDocument()
  })

  it('creates distributor via Enter key on name field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Distributor Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Distributor Name'), {
      target: { value: 'Enter Distributor' }
    })
    fireEvent.keyDown(screen.getByLabelText('Distributor Name'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createDistributor).toHaveBeenCalled()
    })
  })

  it('saves edit via Enter key on name field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')

    const nameInput = screen.getByLabelText('Edit Distributor Name')
    fireEvent.keyDown(nameInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateDistributor).toHaveBeenCalled()
    })
  })

  it('filters distributors via searchFilter prop', async () => {
    const { rerender } = render(<DistributorPanel searchFilter="" />)

    await screen.findByText('Empire Merchants North')

    rerender(<DistributorPanel searchFilter="best" />)

    expect(screen.queryByText('Empire Merchants North')).not.toBeInTheDocument()
    expect(screen.getByText('Best Spirits LLC')).toBeInTheDocument()
  })

  it('shows no-match message when search yields no results', async () => {
    const { rerender } = render(<DistributorPanel searchFilter="" />)

    await screen.findByText('Empire Merchants North')

    rerender(<DistributorPanel searchFilter="zzzzz" />)

    expect(screen.getByText('No distributors match your search.')).toBeInTheDocument()
  })

  it('refreshes edit form from backend data after save', async () => {
    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')

    fireEvent.change(screen.getByLabelText('Edit Distributor Name'), {
      target: { value: 'Empire Updated' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Edit Distributor Name')).toHaveValue('Empire Updated')
    })
    // Table should also reflect the change
    expect(screen.getByText('Empire Updated')).toBeInTheDocument()
  })

  // ── Sales Rep tests ──

  it('loads and displays sales reps when a distributor is selected', async () => {
    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')

    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('555-1234')).toBeInTheDocument()
    expect(screen.getByText('john@empire.com')).toBeInTheDocument()
  })

  it('shows empty sales reps message for distributor with no reps', async () => {
    render(<DistributorPanel />)

    await selectRow('Best Spirits LLC')

    expect(await screen.findByText('No sales reps yet.')).toBeInTheDocument()
  })

  it('adds a sales rep to a distributor', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    await screen.findByText('John Doe')

    fireEvent.change(screen.getByLabelText('New Rep Name'), {
      target: { value: 'Jane Smith' }
    })
    fireEvent.change(screen.getByLabelText('New Rep Phone'), {
      target: { value: '555-5678' }
    })
    fireEvent.change(screen.getByLabelText('New Rep Email'), {
      target: { value: 'jane@empire.com' }
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1])

    await waitFor(() => {
      expect(api.createSalesRep).toHaveBeenCalledWith({
        distributor_number: 1,
        rep_name: 'Jane Smith',
        phone: '555-5678',
        email: 'jane@empire.com'
      })
    })
  })

  it('validates empty rep name', async () => {
    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    await screen.findByText('John Doe')

    // Click the sales rep Add button without entering a name
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1])

    expect(await screen.findByText('Rep name is required')).toBeInTheDocument()
  })

  it('removes a sales rep', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    await screen.findByText('John Doe')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(api.deleteSalesRep).toHaveBeenCalledWith(1)
    })
  })

  it('adds sales rep via Enter key on email field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DistributorPanel />)

    await selectRow('Empire Merchants North')
    await screen.findByText('John Doe')

    fireEvent.change(screen.getByLabelText('New Rep Name'), {
      target: { value: 'Enter Rep' }
    })
    fireEvent.keyDown(screen.getByLabelText('New Rep Email'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createSalesRep).toHaveBeenCalled()
    })
  })
})
