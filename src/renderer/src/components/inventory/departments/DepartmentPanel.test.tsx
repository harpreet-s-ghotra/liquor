import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DepartmentPanel } from './DepartmentPanel'

type Dept = {
  id: number
  name: string
  description: string | null
  default_profit_margin: number
  default_tax_rate: number
}

describe('DepartmentPanel', () => {
  /** Mutable in-memory store so getDepartments reflects create/update/delete round-trips. */
  let departments: Dept[]
  /** Ordered log of API calls to verify the exact sequence. */
  let callLog: string[]

  beforeEach(() => {
    callLog = []
    departments = [
      {
        id: 1,
        name: 'Wine',
        description: 'Red and white wines',
        default_profit_margin: 25,
        default_tax_rate: 8.25
      },
      { id: 2, name: 'Beer', description: null, default_profit_margin: 0, default_tax_rate: 0 }
    ]

    let nextId = 3

    const api = {
      getDepartments: vi.fn(async () => {
        callLog.push('getDepartments')
        return departments.map((d) => ({ ...d }))
      }),
      createDepartment: vi.fn(
        async (input: {
          name: string
          description?: string | null
          default_profit_margin?: number
          default_tax_rate?: number
        }) => {
          callLog.push('createDepartment')
          const dept: Dept = {
            id: nextId++,
            name: input.name,
            description: input.description ?? null,
            default_profit_margin: input.default_profit_margin ?? 0,
            default_tax_rate: input.default_tax_rate ?? 0
          }
          departments.push(dept)
          return { ...dept }
        }
      ),
      updateDepartment: vi.fn(
        async (input: {
          id: number
          name: string
          description?: string | null
          default_profit_margin?: number
          default_tax_rate?: number
        }) => {
          callLog.push('updateDepartment')
          const dept = departments.find((d) => d.id === input.id)
          if (dept) {
            dept.name = input.name
            dept.description = input.description ?? null
            dept.default_profit_margin = input.default_profit_margin ?? 0
            dept.default_tax_rate = input.default_tax_rate ?? 0
          }
          return dept ? { ...dept } : undefined
        }
      ),
      deleteDepartment: vi.fn(async (id: number) => {
        callLog.push('deleteDepartment')
        const idx = departments.findIndex((d) => d.id === id)
        if (idx >= 0) departments.splice(idx, 1)
      }),
      getTaxCodes: vi.fn(async () => [
        { id: 1, code: 'HST', rate: 0.0825 },
        { id: 2, code: 'PST', rate: 0.095 },
        { id: 3, code: 'QST', rate: 0.075 },
        { id: 4, code: 'VAT', rate: 0.1 }
      ])
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { ...(window as any).api, ...api }
  })

  it('loads and displays departments with new fields', async () => {
    render(<DepartmentPanel />)

    expect(await screen.findByText('Wine')).toBeInTheDocument()
    expect(screen.getByText('Beer')).toBeInTheDocument()
    expect(screen.getByText('Red and white wines')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    // Tax rate 8.25 matches HST tax code (0.0825 * 100 = 8.25)
    const table = screen.getByRole('table', { name: 'Departments list' })
    expect(within(table).getByText('HST (8.25%)')).toBeInTheDocument()
  })

  it('shows empty state when no departments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getDepartments = vi.fn(async () => [])

    render(<DepartmentPanel />)

    expect(
      await screen.findByText('No departments yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('filters departments by search', async () => {
    render(<DepartmentPanel />)

    await screen.findByText('Wine')

    fireEvent.change(screen.getByLabelText('Search Departments'), {
      target: { value: 'wine' }
    })

    expect(screen.getByText('Wine')).toBeInTheDocument()
    expect(screen.queryByText('Beer')).not.toBeInTheDocument()
  })

  it('shows validation when creating with empty name', async () => {
    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
  })

  it('creates a department and shows success', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.createDepartment).toHaveBeenCalledWith({
        name: 'Spirits',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0
      })
    })
    expect(await screen.findByText('Department created')).toBeInTheDocument()
  })

  it('selects a department and shows edit form', async () => {
    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    expect(screen.getByLabelText('Edit Department Name')).toHaveValue('Wine')
    expect(screen.getByLabelText('Edit Department Description')).toHaveValue('Red and white wines')
    expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(25)
    // Tax rate is a <select> with string value matching the percentage
    expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('8.25')
  })

  it('saves department edits with new fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Red Wine' }
    })
    fireEvent.change(screen.getByLabelText('Edit Department Description'), {
      target: { value: 'Premium reds' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Profit Margin'), {
      target: { value: '30' }
    })
    // Select PST (9.5%) from the dropdown
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '9.5' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateDepartment).toHaveBeenCalledWith({
        id: 1,
        name: 'Red Wine',
        description: 'Premium reds',
        default_profit_margin: 30,
        default_tax_rate: 9.5
      })
    })
    expect(await screen.findByText('Department saved')).toBeInTheDocument()
  })

  it('deletes a selected department', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(api.deleteDepartment).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Department deleted')).toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.createDepartment = vi.fn(async () => {
      throw new Error('Duplicate name')
    })

    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Duplicate' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Duplicate name')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateDepartment = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Changed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Update failed')).toBeInTheDocument()
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteDepartment = vi.fn(async () => {
      throw new Error('In use')
    })

    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('In use')).toBeInTheDocument()
  })

  it('validates empty edit name', async () => {
    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: '   ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Department name is required')).toBeInTheDocument()
  })

  it('creates department via Enter key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.keyDown(screen.getByLabelText('Department Name'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createDepartment).toHaveBeenCalledWith({
        name: 'Spirits',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0
      })
    })
  })

  it('saves edit via Enter key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    const input = screen.getByLabelText('Edit Department Name')
    fireEvent.change(input, { target: { value: 'Updated' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateDepartment).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Updated' })
      )
    })
  })

  it('shows prompt to select department when none selected', async () => {
    render(<DepartmentPanel />)

    expect(
      await screen.findByText('Select a department above to view and edit its details.')
    ).toBeInTheDocument()
  })

  it('persists saved name in the department list table', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    render(<DepartmentPanel />)

    // Select Wine
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    // Change the name
    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Red Wine' }
    })

    // Reset call log to track sequence from save onwards
    callLog.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Department saved')).toBeInTheDocument()
    })

    // Verify the call sequence: update THEN reload
    expect(callLog).toEqual(['updateDepartment', 'getDepartments'])

    // Verify updateDepartment was called with correct payload
    expect(api.updateDepartment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'Red Wine' })
    )

    // Verify the in-memory store was mutated (i.e. updateDepartment actually changed data)
    expect(departments.find((d) => d.id === 1)?.name).toBe('Red Wine')

    // getDepartments was called after the update to reload
    const getCallCount = api.getDepartments.mock.calls.length
    expect(getCallCount).toBeGreaterThanOrEqual(2) // initial + post-save

    // The table should now show 'Red Wine' instead of 'Wine'
    const table = screen.getByRole('table', { name: 'Departments list' })
    expect(within(table).getByText('Red Wine')).toBeInTheDocument()
    expect(within(table).queryByText('Wine')).not.toBeInTheDocument()
  })

  it('persists updated description and margins in the table after save', async () => {
    render(<DepartmentPanel />)

    // Select Beer (has no description, margin, or tax)
    const beerRow = await screen.findByText('Beer')
    fireEvent.click(beerRow.closest('tr')!)

    // Fill in all fields
    fireEvent.change(screen.getByLabelText('Edit Department Description'), {
      target: { value: 'Craft and imported beers' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Profit Margin'), {
      target: { value: '30' }
    })
    // Select QST (7.5%) from the dropdown
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '7.5' }
    })

    callLog.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Department saved')).toBeInTheDocument()
    })

    // Verify call sequence
    expect(callLog).toEqual(['updateDepartment', 'getDepartments'])

    // Verify the in-memory store state
    const beer = departments.find((d) => d.id === 2)!
    expect(beer.description).toBe('Craft and imported beers')
    expect(beer.default_profit_margin).toBe(30)
    expect(beer.default_tax_rate).toBe(7.5)

    // Verify the table row shows updated values
    const table = screen.getByRole('table', { name: 'Departments list' })
    expect(within(table).getByText('Craft and imported beers')).toBeInTheDocument()
    expect(within(table).getByText('30%')).toBeInTheDocument()
    // Tax code label shown for matching rate
    expect(within(table).getByText('QST (7.5%)')).toBeInTheDocument()
  })

  it('shows saved values when re-selecting a department after save', async () => {
    render(<DepartmentPanel />)

    // Select Wine and change it
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Fine Wine' }
    })
    fireEvent.change(screen.getByLabelText('Edit Department Description'), {
      target: { value: 'Premium selections' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Profit Margin'), {
      target: { value: '35' }
    })
    // Select VAT (10%) from the dropdown
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '10' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Department saved')).toBeInTheDocument()
    })

    // Verify edit form immediately shows the saved values (refreshed from backend)
    expect(screen.getByLabelText('Edit Department Name')).toHaveValue('Fine Wine')
    expect(screen.getByLabelText('Edit Department Description')).toHaveValue('Premium selections')
    expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(35)
    expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('10')

    // Select Beer to deselect Wine
    const beerRow = screen.getByText('Beer')
    fireEvent.click(beerRow.closest('tr')!)

    // Re-select the renamed department — values must come from the reloaded store
    const fineWineRow = screen.getByText('Fine Wine')
    fireEvent.click(fineWineRow.closest('tr')!)

    // Edit fields should show the saved values (not leftover form state)
    expect(screen.getByLabelText('Edit Department Name')).toHaveValue('Fine Wine')
    expect(screen.getByLabelText('Edit Department Description')).toHaveValue('Premium selections')
    expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(35)
    expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('10')
  })

  it('multiple sequential saves all persist correctly', async () => {
    render(<DepartmentPanel />)

    const table = (): HTMLElement => screen.getByRole('table', { name: 'Departments list' })

    // --- First save: rename Wine → Vino ---
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)
    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Vino' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Department saved')).toBeInTheDocument())
    expect(within(table()).getByText('Vino')).toBeInTheDocument()
    expect(within(table()).queryByText('Wine')).not.toBeInTheDocument()

    // --- Second save: rename Vino → Fine Wine ---
    // Vino row should already be selected (same dept id)
    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Fine Wine' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Department saved')).toBeInTheDocument())
    expect(within(table()).getByText('Fine Wine')).toBeInTheDocument()
    expect(within(table()).queryByText('Vino')).not.toBeInTheDocument()

    // --- Third save: update Beer description ---
    const beerRow = within(table()).getByText('Beer')
    fireEvent.click(beerRow.closest('tr')!)
    fireEvent.change(screen.getByLabelText('Edit Department Description'), {
      target: { value: 'Best beers' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Department saved')).toBeInTheDocument())
    expect(within(table()).getByText('Best beers')).toBeInTheDocument()

    // Verify in-memory store state after all saves
    expect(departments.find((d) => d.id === 1)?.name).toBe('Fine Wine')
    expect(departments.find((d) => d.id === 2)?.description).toBe('Best beers')
  })

  it('getDepartments reload returns updated data after save', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'New Name' }
    })
    fireEvent.change(screen.getByLabelText('Edit Department Description'), {
      target: { value: 'New Desc' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Profit Margin'), {
      target: { value: '50' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '9.5' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Department saved')).toBeInTheDocument()
    })

    // Verify updateDepartment called with exact payload
    expect(api.updateDepartment).toHaveBeenCalledWith({
      id: 1,
      name: 'New Name',
      description: 'New Desc',
      default_profit_margin: 50,
      default_tax_rate: 9.5
    })

    // Verify the in-memory store matches what getDepartments would return
    const dept = departments.find((d) => d.id === 1)!
    expect(dept.name).toBe('New Name')
    expect(dept.description).toBe('New Desc')
    expect(dept.default_profit_margin).toBe(50)
    expect(dept.default_tax_rate).toBe(9.5)

    // Verify the TABLE reflects ALL saved field changes
    const table = screen.getByRole('table', { name: 'Departments list' })
    expect(within(table).getByText('New Name')).toBeInTheDocument()
    expect(within(table).getByText('New Desc')).toBeInTheDocument()
    expect(within(table).getByText('50%')).toBeInTheDocument()
    expect(within(table).getByText('PST (9.5%)')).toBeInTheDocument()
    // Old values should be gone
    expect(within(table).queryByText('Wine')).not.toBeInTheDocument()
    expect(within(table).queryByText('Red and white wines')).not.toBeInTheDocument()
  })

  it('edit form fields refresh from backend data after save', async () => {
    render(<DepartmentPanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    // Change all edit fields
    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Updated Wine' }
    })
    fireEvent.change(screen.getByLabelText('Edit Department Description'), {
      target: { value: 'Updated desc' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Profit Margin'), {
      target: { value: '42' }
    })
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '7.5' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Department saved')).toBeInTheDocument()
    })

    // After save, the edit form should show the values from the reloaded data
    // (handleSave refreshes form state from runAction's returned items)
    expect(screen.getByLabelText('Edit Department Name')).toHaveValue('Updated Wine')
    expect(screen.getByLabelText('Edit Department Description')).toHaveValue('Updated desc')
    expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(42)
    expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('7.5')
  })

  it('reflects created department in the table', async () => {
    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText('Department created')).toBeInTheDocument()
    })

    // New department should appear in the table
    const table = screen.getByRole('table', { name: 'Departments list' })
    expect(within(table).getByText('Spirits')).toBeInTheDocument()
  })

  it('removes deleted department from the table', async () => {
    render(<DepartmentPanel />)

    // Select Wine
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Department deleted')).toBeInTheDocument()
    })

    // Wine should no longer be in the table
    const table = screen.getByRole('table', { name: 'Departments list' })
    expect(within(table).queryByText('Wine')).not.toBeInTheDocument()
    // Beer should still be there
    expect(within(table).getByText('Beer')).toBeInTheDocument()
  })

  it('renders tax code dropdown with options from backend', async () => {
    render(<DepartmentPanel />)

    // Select a department to show the edit form
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    const select = screen.getByLabelText('Edit Default Tax Rate') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')

    // Should have None + 4 tax code options
    await waitFor(() => {
      expect(select.options).toHaveLength(5)
    })

    // Check option labels
    const labels = Array.from(select.options).map((o) => o.text)
    expect(labels).toContain('None')
    expect(labels).toContain('HST (8.25%)')
    expect(labels).toContain('PST (9.5%)')
    expect(labels).toContain('QST (7.5%)')
    expect(labels).toContain('VAT (10%)')
  })

  it('selecting "None" in tax dropdown sets tax rate to 0', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    // Wine has tax rate 8.25 (HST)
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    // Select "None"
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateDepartment).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, default_tax_rate: 0 })
      )
    })
  })
})
