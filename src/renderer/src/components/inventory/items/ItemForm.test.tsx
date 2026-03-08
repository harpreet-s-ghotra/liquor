import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemForm } from './ItemForm'

const baseInventoryItem = {
  item_number: 1,
  sku: 'SKU-001',
  item_name: 'Inventory Item',
  dept_id: '11',
  category_id: null,
  category_name: null,
  cost: 10,
  retail_price: 15,
  in_stock: 6,
  tax_1: 0.13,
  tax_2: 0,
  vendor_number: null,
  vendor_name: null,
  bottles_per_case: 12,
  case_discount_price: null,
  barcode: null,
  description: null,
  special_pricing_enabled: 0,
  special_price: null,
  is_active: 1
}

const baseDetail = {
  ...baseInventoryItem,
  tax_rates: [0, 0.13],
  additional_skus: ['SKU-001-ALT'],
  special_pricing: [],
  sales_history: [
    {
      transaction_id: 10,
      transaction_number: 'TXN-001',
      created_at: '2026-02-28T10:00:00.000Z',
      quantity: 2,
      unit_price: 15,
      total_price: 30,
      payment_method: 'credit',
      stax_transaction_id: 'stax-uuid-123',
      card_last_four: '1111',
      card_type: 'visa'
    }
  ]
}

describe('ItemForm', () => {
  /** Find the dropdown container by its aria-label (picks the div, not the label) */
  const getDeptDropdown = (): HTMLElement => {
    const matches = screen.getAllByLabelText('Department')
    return matches.find((el) => el.classList.contains('dept-dropdown')) ?? matches[0]
  }

  const getTaxDropdown = (): HTMLElement => {
    const matches = screen.getAllByLabelText('Tax Codes')
    return matches.find((el) => el.classList.contains('tax-dropdown')) ?? matches[0]
  }

  /** Open the tax dropdown and toggle rate checkboxes */
  const setTaxCodes = (rates: string[]): void => {
    const container = getTaxDropdown()
    const toggle = container.querySelector('button') as HTMLButtonElement
    if (toggle.getAttribute('aria-expanded') !== 'true') {
      fireEvent.click(toggle)
    }

    const options = within(container).getAllByRole('option')
    for (const opt of options) {
      const cb = opt.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      if (!cb) continue
      const labelText = opt.textContent || ''
      const pctMatch = labelText.match(/([\d.]+)%/)
      if (!pctMatch) continue
      const rateValue = String(Number(pctMatch[1]) / 100)
      const shouldBeChecked = rates.includes(rateValue)
      if (cb.checked !== shouldBeChecked) {
        fireEvent.click(cb)
      }
    }
  }

  /** Open the department dropdown and toggle department checkboxes */
  const setDepartments = (depts: string[]): void => {
    const container = getDeptDropdown()
    const toggle = container.querySelector('button') as HTMLButtonElement
    if (toggle.getAttribute('aria-expanded') !== 'true') {
      fireEvent.click(toggle)
    }

    const options = within(container).getAllByRole('option')
    for (const opt of options) {
      const cb = opt.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      if (!cb) continue
      const labelText = (opt.textContent || '').trim()
      const shouldBeChecked = depts.includes(labelText)
      if (cb.checked !== shouldBeChecked) {
        fireEvent.click(cb)
      }
    }
  }

  beforeEach(() => {
    const api = {
      searchInventoryProducts: vi.fn(async () => [baseInventoryItem]),
      getInventoryProductDetail: vi.fn(async () => baseDetail),
      saveInventoryItem: vi.fn(async () => baseDetail),
      getInventoryDepartments: vi.fn(async () => ['11', '02']),
      getInventoryTaxCodes: vi.fn(async () => [
        { code: 'RATE_0', rate: 0 },
        { code: 'RATE_0_13', rate: 0.13 }
      ]),
      getVendors: vi.fn(async () => [
        {
          vendor_number: 1,
          vendor_name: 'ABC Dist',
          contact_name: null,
          phone: null,
          email: null,
          is_active: 1
        }
      ])
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = api
  })

  it('renders form fields and search bar', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('SKU')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('shows required-field validation errors on empty save', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(getDeptDropdown()).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(await screen.findByText('SKU is required')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Cost is required')).toBeInTheDocument()
    expect(screen.getByText('Price is required')).toBeInTheDocument()
    expect(screen.getByText('In stock is required')).toBeInTheDocument()
    // Department and Tax Codes are optional, so no validation errors for them
    expect(screen.queryByText('At least one department is required')).not.toBeInTheDocument()
    expect(
      screen.queryByText('At least one tax code must be selected from backend values')
    ).not.toBeInTheDocument()
  })

  it('shows validation when in stock is not an integer', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(getDeptDropdown()).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-NEW' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Item' } })
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1275' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: 'abc' } })
    setTaxCodes(['0.13'])

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(await screen.findByText('In stock must be an integer')).toBeInTheDocument()
  })

  it('auto-formats price fields from cents-style numeric entry', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Cost')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '999' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1234' } })

    fireEvent.click(screen.getByRole('tab', { name: 'Special Pricing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))
    fireEvent.change(screen.getByLabelText('Rule 1 Price'), { target: { value: '501' } })

    expect(screen.getByLabelText('Cost')).toHaveValue('$9.99')
    expect(screen.getByLabelText('Price Charged')).toHaveValue('$12.34')
    expect(screen.getByLabelText('Rule 1 Price')).toHaveValue('$5.01')
  })

  it('saves a new item and shows success message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemForm />)

    await waitFor(() => {
      expect(getDeptDropdown()).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-NEW' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Item' } })
    setDepartments(['02'])
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1275' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '7' } })
    setTaxCodes(['0', '0.13'])

    // Navigate to Additional SKUs tab (default is now Case & Quantity)
    fireEvent.click(screen.getByRole('tab', { name: 'Additional SKUs' }))
    fireEvent.change(screen.getByLabelText('Additional SKU Input'), {
      target: { value: 'SKU-NEW-ALT' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Additional SKU' }))

    fireEvent.click(screen.getByRole('tab', { name: 'Special Pricing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))
    fireEvent.change(screen.getByLabelText('Rule 1 Quantity'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Rule 1 Price'), { target: { value: '1099' } })
    fireEvent.change(screen.getByLabelText('Rule 1 Duration'), { target: { value: '20' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    await waitFor(() => {
      expect(api.saveInventoryItem).toHaveBeenCalled()
    })
    expect(api.saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        cost: 8.5,
        retail_price: 12.75,
        special_pricing: [{ quantity: 2, price: 10.99, duration_days: 20 }]
      })
    )
    expect(await screen.findByText('Item saved')).toBeInTheDocument()
  })

  it('searches inventory using bottom search bar', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'SKU-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(api.searchInventoryProducts).toHaveBeenCalledWith('SKU-001')
    })

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })
  })

  it('loads searched item details and sales history', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'SKU-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })
    expect(screen.getByLabelText('Name')).toHaveValue('Inventory Item')

    fireEvent.click(screen.getByRole('tab', { name: 'Sales History' }))

    // Sales history now renders as a table with payment info
    const table = await screen.findByRole('table')
    expect(table).toBeInTheDocument()
    expect(table).toHaveTextContent('TXN-001')
    expect(table).toHaveTextContent('2')
    expect(table).toHaveTextContent('$30.00')
    expect(table).toHaveTextContent('credit')
    expect(table).toHaveTextContent('visa ****1111')
  })

  it('falls back to legacy tax fields when tax_rates is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    api.getInventoryProductDetail = vi.fn(async () => {
      const detailWithoutTaxRates: Record<string, unknown> = { ...baseDetail }
      delete detailWithoutTaxRates.tax_rates
      return detailWithoutTaxRates
    })

    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'SKU-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })

    const container = getTaxDropdown()
    const toggle = container.querySelector('button') as HTMLButtonElement
    fireEvent.click(toggle)

    const options = within(container).getAllByRole('option')
    const checkboxes = options
      .map((opt) => opt.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
      .filter(Boolean) as HTMLInputElement[]
    const checked = checkboxes.filter((cb) => cb.checked)
    expect(checked.length).toBe(2)
  })

  it('supports adding and removing additional SKU entries', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Bottles Per Case')).toBeInTheDocument()
    })

    // Navigate to Additional SKUs tab (default is now Case & Quantity)
    fireEvent.click(screen.getByRole('tab', { name: 'Additional SKUs' }))

    fireEvent.change(screen.getByLabelText('Additional SKU Input'), {
      target: { value: 'SKU-X' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Additional SKU' }))

    expect(await screen.findByText('SKU-X')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => {
      expect(screen.queryByText('SKU-X')).not.toBeInTheDocument()
    })
  })

  it('strips invalid characters from SKU and auto-uppercases', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'abc@#123-def' } })

    // Should strip @# and uppercase
    expect(screen.getByLabelText('SKU')).toHaveValue('ABC123-DEF')
  })

  it('resets form when New Item is clicked', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemForm />)

    // Search to load an existing item
    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'SKU-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })

    // Click New Item to reset
    fireEvent.click(screen.getByRole('button', { name: 'New Item' }))

    expect(screen.getByLabelText('SKU')).toHaveValue('')
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('shows no items found message when search returns empty', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.searchInventoryProducts = vi.fn(async () => [])

    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'NONE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(
      await screen.findByText('No items found. You can enter a new item above.')
    ).toBeInTheDocument()
  })

  it('searches via Enter key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'SKU-001' } })
    fireEvent.keyDown(screen.getByLabelText('Search Inventory'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.searchInventoryProducts).toHaveBeenCalledWith('SKU-001')
    })
  })

  it('removes a special pricing rule', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Special Pricing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))

    expect(screen.getByLabelText('Rule 1 Quantity')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(screen.queryByLabelText('Rule 1 Quantity')).not.toBeInTheDocument()
  })

  it('shows save error when API fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.saveInventoryItem = vi.fn(async () => {
      throw new Error('Save failed')
    })

    render(<ItemForm />)

    await waitFor(() => {
      expect(getDeptDropdown()).toBeInTheDocument()
    })

    setDepartments(['11'])
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-ERR' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Error Item' } })
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '1' } })
    setTaxCodes(['0.13'])

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(await screen.findByText('Save failed')).toBeInTheDocument()
  })

  it('defaults to Case & Quantity sub-tab', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Bottles Per Case')).toBeInTheDocument()
    })

    // Case & Quantity tab panel is visible by default
    expect(screen.getByRole('tab', { name: 'Case & Quantity' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('shows percent mode toggle by default for new items', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Bottles Per Case')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Switch to percent mode')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByLabelText('Switch to dollar mode')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByLabelText('Case Discount Percent')).toBeInTheDocument()
  })

  it('switches to dollar mode when $ toggle is clicked', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Bottles Per Case')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Switch to dollar mode'))

    expect(screen.getByLabelText('Switch to dollar mode')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByLabelText('Case Discount Price')).toBeInTheDocument()
  })

  it('loads existing item with case_discount_price in dollar mode', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    api.getInventoryProductDetail = vi.fn(async () => ({
      ...baseDetail,
      case_discount_price: 149.99
    }))

    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search Inventory')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search Inventory'), { target: { value: 'SKU-001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })

    // Should show dollar mode when loading existing case discount price
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to dollar mode')).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    })
    expect(screen.getByLabelText('Case Discount Price')).toHaveValue('$149.99')
  })

  it('saves case discount in percent mode as dollar value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemForm />)

    await waitFor(() => {
      expect(getDeptDropdown()).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-CASE' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Case Item' } })
    setDepartments(['11'])
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '7' } })
    setTaxCodes(['0.13'])

    // Enter 10% discount on a $10 x 12 = $120 full case price
    fireEvent.change(screen.getByLabelText('Case Discount Percent'), {
      target: { value: '10' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    await waitFor(() => {
      expect(api.saveInventoryItem).toHaveBeenCalled()
    })
    // Full case price: 10 * 12 = $120, 10% off → $108
    expect(api.saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        case_discount_price: 108
      })
    )
  })

  it('does not show tax validation error when no tax codes selected', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(getDeptDropdown()).toBeInTheDocument()
    })

    // Fill required fields but select no tax codes
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-NOTAX' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'No Tax Item' } })
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    // Should NOT show "tax code must be selected from backend values" error
    expect(
      screen.queryByText('At least one tax code must be selected from backend values')
    ).not.toBeInTheDocument()
  })
})
