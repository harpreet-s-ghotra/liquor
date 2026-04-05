import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemTypePanel } from './ItemTypePanel'

type Dept = {
  id: number
  name: string
  description: string | null
  default_profit_margin: number
  default_tax_rate: number
}

describe('ItemTypePanel', () => {
  /** Mutable in-memory store so getItemTypes reflects create/update/delete round-trips. */
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
      getItemTypes: vi.fn(async () => {
        callLog.push('getItemTypes')
        return departments.map((d) => ({ ...d }))
      }),
      createItemType: vi.fn(
        async (input: {
          name: string
          description?: string | null
          default_profit_margin?: number
          default_tax_rate?: number
        }) => {
          callLog.push('createItemType')
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
      updateItemType: vi.fn(
        async (input: {
          id: number
          name: string
          description?: string | null
          default_profit_margin?: number
          default_tax_rate?: number
        }) => {
          callLog.push('updateItemType')
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
      deleteItemType: vi.fn(async (id: number) => {
        callLog.push('deleteItemType')
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
    ;(window as any).api = api
  })

  it('loads and displays item types with new fields', async () => {
    render(<ItemTypePanel />)

    expect(await screen.findByText('Wine')).toBeInTheDocument()
    expect(screen.getByText('Beer')).toBeInTheDocument()
    expect(screen.getByText('Red and white wines')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    // Tax rate 8.25 matches HST tax code (0.0825 * 100 = 8.25)
    const table = screen.getByRole('table', { name: 'Item types list' })
    expect(within(table).getByText('HST (8.25%)')).toBeInTheDocument()
  })

  it('prefers getItemTypes when that API is available', async () => {
    const getItemTypes = vi.fn(async () => [
      {
        id: 10,
        name: 'Imported Wine',
        description: 'Hydrated from products',
        default_profit_margin: 0,
        default_tax_rate: 0
      }
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(window as any).api,
      getItemTypes
    }

    render(<ItemTypePanel />)

    expect(await screen.findByText('Imported Wine')).toBeInTheDocument()
    expect(getItemTypes).toHaveBeenCalled()
  })

  it('shows empty state when no item types', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getItemTypes = vi.fn(async () => [])

    render(<ItemTypePanel />)

    expect(
      await screen.findByText('No item types yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('filters item types by search', async () => {
    const { rerender } = render(<ItemTypePanel searchFilter="" />)

    await screen.findByText('Wine')

    rerender(<ItemTypePanel searchFilter="wine" />)

    await waitFor(() => {
      expect(screen.getByText('Wine')).toBeInTheDocument()
      expect(screen.queryByText('Beer')).not.toBeInTheDocument()
    })
  })

  it('shows validation when creating with empty name', async () => {
    render(<ItemTypePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Item Type Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
  })

  it('creates an item type and shows success', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemTypePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Item Type Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Item Type Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.createItemType).toHaveBeenCalledWith({
        name: 'Spirits',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0
      })
    })
    expect(await screen.findByText('Item type created')).toBeInTheDocument()
  })

  it('selects an item type and shows edit form', async () => {
    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    await waitFor(() => {
      expect(screen.getByLabelText('Edit Item Type Name')).toHaveValue('Wine')
      expect(screen.getByLabelText('Edit Item Type Description')).toHaveValue('Red and white wines')
      expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(25)
      // Tax rate is a <select> with string value matching the percentage
      expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('8.25')
    })
  })

  it('saves item type edits with new fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Red Wine' }
    })
    fireEvent.change(screen.getByLabelText('Edit Item Type Description'), {
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
      expect(api.updateItemType).toHaveBeenCalledWith({
        id: 1,
        name: 'Red Wine',
        description: 'Premium reds',
        default_profit_margin: 30,
        default_tax_rate: 9.5
      })
    })
    expect(await screen.findByText('Item type saved')).toBeInTheDocument()
  })

  it('deletes a selected item type', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    await waitFor(() => {
      expect(api.deleteItemType).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Item type deleted')).toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.createItemType = vi.fn(async () => {
      throw new Error('Duplicate name')
    })

    render(<ItemTypePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Item Type Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Item Type Name'), {
      target: { value: 'Duplicate' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Duplicate name')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateItemType = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Changed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Update failed')).toBeInTheDocument()
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteItemType = vi.fn(async () => {
      throw new Error('In use')
    })

    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    expect(await screen.findByText('In use')).toBeInTheDocument()
  })

  it('validates empty edit name', async () => {
    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: '   ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Item type name is required')).toBeInTheDocument()
  })

  it('creates department via Enter key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemTypePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Item Type Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Item Type Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.keyDown(screen.getByLabelText('Item Type Name'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createItemType).toHaveBeenCalledWith({
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

    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    const input = screen.getByLabelText('Edit Item Type Name')
    fireEvent.change(input, { target: { value: 'Updated' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateItemType).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Updated' })
      )
    })
  })

  it('shows prompt to select department when none selected', async () => {
    render(<ItemTypePanel />)

    expect(
      await screen.findByText('Select an item type above to view and edit its details.')
    ).toBeInTheDocument()
  })

  it('persists saved name in the department list table', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    render(<ItemTypePanel />)

    // Select Wine
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    // Change the name
    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Red Wine' }
    })

    // Reset call log to track sequence from save onwards
    callLog.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Item type saved')).toBeInTheDocument()
    })

    // Verify the call sequence: update THEN reload
    expect(callLog[0]).toBe('updateItemType')
    expect(callLog[1]).toBe('getItemTypes')

    // Verify updateItemType was called with correct payload
    expect(api.updateItemType).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'Red Wine' })
    )

    // Verify the in-memory store was mutated (i.e. updateItemType actually changed data)
    expect(departments.find((d) => d.id === 1)?.name).toBe('Red Wine')

    // getItemTypes was called after the update to reload
    const getCallCount = api.getItemTypes.mock.calls.length
    expect(getCallCount).toBeGreaterThanOrEqual(2) // initial + post-save

    // The table should now show 'Red Wine' instead of 'Wine'
    const table = screen.getByRole('table', { name: 'Item types list' })
    expect(within(table).getByText('Red Wine')).toBeInTheDocument()
    expect(within(table).queryByText('Wine')).not.toBeInTheDocument()
  })

  it('persists updated description and margins in the table after save', async () => {
    render(<ItemTypePanel />)

    // Select Beer (has no description, margin, or tax)
    const beerRow = await screen.findByText('Beer')
    fireEvent.click(beerRow.closest('tr')!)

    // Fill in all fields
    fireEvent.change(screen.getByLabelText('Edit Item Type Description'), {
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
      expect(screen.getByText('Item type saved')).toBeInTheDocument()
    })

    // Verify call sequence starts with updateItemType then getItemTypes
    expect(callLog[0]).toBe('updateItemType')
    expect(callLog[1]).toBe('getItemTypes')

    // Verify the in-memory store state
    const beer = departments.find((d) => d.id === 2)!
    expect(beer.description).toBe('Craft and imported beers')
    expect(beer.default_profit_margin).toBe(30)
    expect(beer.default_tax_rate).toBe(7.5)

    // Verify the table row shows updated values
    const table = screen.getByRole('table', { name: 'Item types list' })
    expect(within(table).getByText('Craft and imported beers')).toBeInTheDocument()
    expect(within(table).getByText('30%')).toBeInTheDocument()
    // Tax code label shown for matching rate
    expect(within(table).getByText('QST (7.5%)')).toBeInTheDocument()
  })

  it('shows saved values when re-selecting a department after save', async () => {
    render(<ItemTypePanel />)

    // Select Wine and change it
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Fine Wine' }
    })
    fireEvent.change(screen.getByLabelText('Edit Item Type Description'), {
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
      expect(screen.getByText('Item type saved')).toBeInTheDocument()
    })

    // Verify edit form immediately shows the saved values (refreshed from backend)
    expect(screen.getByLabelText('Edit Item Type Name')).toHaveValue('Fine Wine')
    expect(screen.getByLabelText('Edit Item Type Description')).toHaveValue('Premium selections')
    expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(35)
    expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('10')

    // Select Beer to deselect Wine
    const beerRow = screen.getByText('Beer')
    fireEvent.click(beerRow.closest('tr')!)
    await waitFor(() => {
      expect(screen.getByLabelText('Edit Item Type Name')).toHaveValue('Beer')
    })

    // Re-select the renamed department — values must come from the reloaded store
    const fineWineRow = screen.getByText('Fine Wine')
    fireEvent.click(fineWineRow.closest('tr')!)

    // Edit fields should show the saved values (not leftover form state)
    await waitFor(() => {
      expect(screen.getByLabelText('Edit Item Type Name')).toHaveValue('Fine Wine')
      expect(screen.getByLabelText('Edit Item Type Description')).toHaveValue('Premium selections')
      expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(35)
      expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('10')
    })
  })

  it('multiple sequential saves all persist correctly', async () => {
    render(<ItemTypePanel />)

    const table = (): HTMLElement => screen.getByRole('table', { name: 'Item types list' })

    // --- First save: rename Wine → Vino ---
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)
    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Vino' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Item type saved')).toBeInTheDocument())
    expect(within(table()).getByText('Vino')).toBeInTheDocument()
    expect(within(table()).queryByText('Wine')).not.toBeInTheDocument()

    // --- Second save: rename Vino → Fine Wine ---
    // Vino row should already be selected (same dept id)
    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Fine Wine' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Item type saved')).toBeInTheDocument())
    expect(within(table()).getByText('Fine Wine')).toBeInTheDocument()
    expect(within(table()).queryByText('Vino')).not.toBeInTheDocument()

    // --- Third save: update Beer description ---
    const beerRow = within(table()).getByText('Beer')
    fireEvent.click(beerRow.closest('tr')!)
    fireEvent.change(screen.getByLabelText('Edit Item Type Description'), {
      target: { value: 'Best beers' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Item type saved')).toBeInTheDocument())
    expect(within(table()).getByText('Best beers')).toBeInTheDocument()

    // Verify in-memory store state after all saves
    expect(departments.find((d) => d.id === 1)?.name).toBe('Fine Wine')
    expect(departments.find((d) => d.id === 2)?.description).toBe('Best beers')
  })

  it('getItemTypes reload returns updated data after save', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'New Name' }
    })
    fireEvent.change(screen.getByLabelText('Edit Item Type Description'), {
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
      expect(screen.getByText('Item type saved')).toBeInTheDocument()
    })

    // Verify updateItemType called with exact payload
    expect(api.updateItemType).toHaveBeenCalledWith({
      id: 1,
      name: 'New Name',
      description: 'New Desc',
      default_profit_margin: 50,
      default_tax_rate: 9.5
    })

    // Verify the in-memory store matches what getItemTypes would return
    const dept = departments.find((d) => d.id === 1)!
    expect(dept.name).toBe('New Name')
    expect(dept.description).toBe('New Desc')
    expect(dept.default_profit_margin).toBe(50)
    expect(dept.default_tax_rate).toBe(9.5)

    // Verify the TABLE reflects ALL saved field changes
    const table = screen.getByRole('table', { name: 'Item types list' })
    expect(within(table).getByText('New Name')).toBeInTheDocument()
    expect(within(table).getByText('New Desc')).toBeInTheDocument()
    expect(within(table).getByText('50%')).toBeInTheDocument()
    expect(within(table).getByText('PST (9.5%)')).toBeInTheDocument()
    // Old values should be gone
    expect(within(table).queryByText('Wine')).not.toBeInTheDocument()
    expect(within(table).queryByText('Red and white wines')).not.toBeInTheDocument()
  })

  it('edit form fields refresh from backend data after save', async () => {
    render(<ItemTypePanel />)

    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    // Change all edit fields
    fireEvent.change(screen.getByLabelText('Edit Item Type Name'), {
      target: { value: 'Updated Wine' }
    })
    fireEvent.change(screen.getByLabelText('Edit Item Type Description'), {
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
      expect(screen.getByText('Item type saved')).toBeInTheDocument()
    })

    // After save, the edit form should show the values from the reloaded data
    // (handleSave refreshes form state from runAction's returned items)
    expect(screen.getByLabelText('Edit Item Type Name')).toHaveValue('Updated Wine')
    expect(screen.getByLabelText('Edit Item Type Description')).toHaveValue('Updated desc')
    expect(screen.getByLabelText('Edit Default Profit Margin')).toHaveValue(42)
    expect(screen.getByLabelText('Edit Default Tax Rate')).toHaveValue('7.5')
  })

  it('reflects created department in the table', async () => {
    render(<ItemTypePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Item Type Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Item Type Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText('Item type created')).toBeInTheDocument()
    })

    // New department should appear in the table
    const table = screen.getByRole('table', { name: 'Item types list' })
    expect(within(table).getByText('Spirits')).toBeInTheDocument()
  })

  it('removes deleted department from the table', async () => {
    render(<ItemTypePanel />)

    // Select Wine
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Item type deleted')).toBeInTheDocument()
    })

    // Wine should no longer be in the table
    const table = screen.getByRole('table', { name: 'Item types list' })
    expect(within(table).queryByText('Wine')).not.toBeInTheDocument()
    // Beer should still be there
    expect(within(table).getByText('Beer')).toBeInTheDocument()
  })

  it('renders tax code dropdown with options from backend', async () => {
    render(<ItemTypePanel />)

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

    render(<ItemTypePanel />)

    // Wine has tax rate 8.25 (HST)
    const wineRow = await screen.findByText('Wine')
    fireEvent.click(wineRow.closest('tr')!)

    // Select "None"
    fireEvent.change(screen.getByLabelText('Edit Default Tax Rate'), {
      target: { value: '' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateItemType).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, default_tax_rate: 0 })
      )
    })
  })
})
