import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ItemForm, type ItemFormHandle } from './ItemForm'
import type { InventoryProduct } from '@renderer/types/pos'

const baseInventoryItem: InventoryProduct = {
  item_number: 1,
  sku: 'SKU-001',
  item_name: 'Inventory Item',
  category_id: null,
  category_name: null,
  cost: 10,
  retail_price: 15,
  in_stock: 6,
  tax_1: 0.13,
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
  item_type: null,
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

const baseDetail = {
  ...baseInventoryItem,
  tax_rates: [0.13],
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
      finix_authorization_id: 'AU-stax-uuid-123',
      card_last_four: '1111',
      card_type: 'visa'
    }
  ]
}

/** Wrapper that exposes all imperative handle methods as buttons */
function ItemFormWithButtons(): React.JSX.Element {
  const ref = useRef<ItemFormHandle>(null)
  return (
    <>
      <button onClick={() => ref.current?.handleNewItem()}>New Item</button>
      <button onClick={() => ref.current?.handleSave()}>Save Item</button>
      <button onClick={() => ref.current?.handleDiscard()}>Discard</button>
      <button onClick={() => ref.current?.handleDelete()}>Delete Item</button>
      <button onClick={() => ref.current?.selectItem(baseInventoryItem)}>Load Item</button>
      <ItemForm ref={ref} />
    </>
  )
}

/** Set the Item Type select to a given value */
const setItemType = (value: string): void => {
  fireEvent.change(screen.getByLabelText('Item Type'), { target: { value } })
}

/** Set the Tax Codes select to a given rate value string */
const setTaxRate = (value: string): void => {
  fireEvent.change(screen.getByLabelText('Tax Codes'), { target: { value } })
}

describe('ItemForm', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const [firstArg] = args
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return
      }
    })

    const api = {
      searchInventoryProducts: vi.fn(async () => [baseInventoryItem]),
      getInventoryProductDetail: vi.fn(async () => baseDetail),
      saveInventoryItem: vi.fn(async () => baseDetail),
      getItemTypes: vi.fn(async () => [
        { id: 1, name: 'Wine', description: null, default_profit_margin: 35, default_tax_rate: 8 },
        {
          id: 2,
          name: 'Spirits',
          description: null,
          default_profit_margin: 40,
          default_tax_rate: 8
        }
      ]),
      getInventoryTaxCodes: vi.fn(async () => [
        { code: 'RATE_0', rate: 0 },
        { code: 'RATE_0_13', rate: 0.13 }
      ]),
      getDistributors: vi.fn(async () => [
        {
          distributor_number: 1,
          distributor_name: 'ABC Dist',
          license_id: null,
          serial_number: null,
          premises_name: null,
          premises_address: null,
          is_active: 1
        }
      ])
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = api
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders core form fields', () => {
    render(<ItemForm />)
    expect(screen.getByLabelText('SKU')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Per Bottle Cost')).toBeInTheDocument()
    expect(screen.getByLabelText('Price Charged')).toBeInTheDocument()
    expect(screen.getByLabelText('In Stock')).toBeInTheDocument()
    expect(screen.getByLabelText('Item Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Tax Codes')).toBeInTheDocument()
  })

  it('shows required-field validation errors on empty save', async () => {
    render(<ItemFormWithButtons />)

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(await screen.findByText('SKU is required')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Cost is required')).toBeInTheDocument()
    expect(screen.getByText('Price is required')).toBeInTheDocument()
    expect(screen.getByText('In stock is required')).toBeInTheDocument()
  })

  it('shows validation when in stock is not an integer', async () => {
    render(<ItemFormWithButtons />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-NEW' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Item' } })
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1275' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: 'abc' } })
    setTaxRate('0.13')

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(await screen.findByText('In stock must be an integer')).toBeInTheDocument()
  })

  it('auto-formats price fields from cents-style numeric entry', async () => {
    render(<ItemForm />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'TEST' } })
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '999' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1234' } })

    await userEvent.click(screen.getByRole('tab', { name: 'Special Pricing' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add Rule' }))
    fireEvent.change(screen.getByLabelText('Rule 1 Price'), { target: { value: '501' } })

    expect(screen.getByLabelText('Per Bottle Cost')).toHaveValue('$9.99')
    expect(screen.getByLabelText('Price Charged')).toHaveValue('$12.34')
    expect(screen.getByLabelText('Rule 1 Price')).toHaveValue('$5.01')
  })

  it('saves a new item and shows success message', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-NEW' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Item' } })
    setItemType('02')
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1275' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '7' } })
    setTaxRate('0.13')

    await userEvent.click(screen.getByRole('tab', { name: 'Additional SKUs' }))
    fireEvent.change(await screen.findByLabelText('Additional SKU Input'), {
      target: { value: 'SKU-NEW-ALT' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Additional SKU' }))

    await userEvent.click(screen.getByRole('tab', { name: 'Special Pricing' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add Rule' }))
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

  it('includes new metadata fields in save payload', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-WINE' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Premium Wine' } })
    setItemType('11')
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '5' } })
    setTaxRate('0.13')

    // Fill in brand (in General Info)
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Château Margaux' } })

    // Navigate to Additional Info tab and fill in metadata fields
    await userEvent.click(screen.getByRole('tab', { name: 'Additional Info' }))
    fireEvent.change(await screen.findByLabelText('Proof'), { target: { value: '86' } })
    fireEvent.change(screen.getByLabelText('ABV Percent'), { target: { value: '13.5' } })
    fireEvent.change(screen.getByLabelText('Vintage'), { target: { value: '2015' } })
    fireEvent.change(screen.getByLabelText('TTB ID'), { target: { value: 'TTB-12345-ABC' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    await waitFor(() => {
      expect(api.saveInventoryItem).toHaveBeenCalled()
    })
    expect(api.saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_name: 'Château Margaux',
        proof: 86,
        alcohol_pct: 13.5,
        vintage: '2015',
        ttb_id: 'TTB-12345-ABC'
      })
    )
  })

  it('loads item detail and populates form via selectItem', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })
    expect(screen.getByLabelText('Name')).toHaveValue('Inventory Item')
  })

  it('loads item detail and shows sales history tab', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Sales History' }))

    const table = await screen.findByRole('table')
    expect(table).toBeInTheDocument()
    expect(table).toHaveTextContent('TXN-001')
    expect(table).toHaveTextContent('2')
    expect(table).toHaveTextContent('$30.00')
    expect(table).toHaveTextContent('credit')
    expect(table).toHaveTextContent('visa ****1111')
  })

  it('loads item detail and populates metadata fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    api.getInventoryProductDetail = vi.fn(async () => ({
      ...baseDetail,
      brand_name: 'Château Margaux',
      proof: 86,
      alcohol_pct: 13.5,
      vintage: '2015',
      ttb_id: 'TTB-12345-ABC'
    }))

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })

    // Verify General Info fields are populated after loading
    await waitFor(() => {
      expect(screen.getByDisplayValue('Château Margaux')).toBeInTheDocument()
    })

    // Switch to Additional Info tab to verify those fields are populated
    await userEvent.click(screen.getByRole('tab', { name: 'Additional Info' }))
    expect(screen.getByDisplayValue('86')).toBeInTheDocument()
    expect(screen.getByDisplayValue('13.5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2015')).toBeInTheDocument()
    expect(screen.getByDisplayValue('TTB-12345-ABC')).toBeInTheDocument()
  })

  it('falls back to legacy tax fields when tax_rates is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    api.getInventoryProductDetail = vi.fn(async () => {
      const detailWithoutTaxRates: Record<string, unknown> = { ...baseDetail }
      delete detailWithoutTaxRates.tax_rates
      return detailWithoutTaxRates
    })

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })

    // tax_1 = 0.13 should be selected as single tax_rate
    await waitFor(() => {
      expect(screen.getByLabelText('Tax Codes')).toHaveValue('0.13')
    })
  })

  it('supports adding and removing additional SKU entries', async () => {
    render(<ItemForm />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'TEST' } })

    await userEvent.click(screen.getByRole('tab', { name: 'Additional SKUs' }))

    fireEvent.change(await screen.findByLabelText('Additional SKU Input'), {
      target: { value: 'SKU-X' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Additional SKU' }))

    expect(await screen.findByText('SKU-X')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => {
      expect(screen.queryByText('SKU-X')).not.toBeInTheDocument()
    })
  })

  it('strips invalid characters from SKU and auto-uppercases', () => {
    render(<ItemForm />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'abc@#123-def' } })

    expect(screen.getByLabelText('SKU')).toHaveValue('ABC123-DEF')
  })

  it('resets form when New Item is clicked after loading an item', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })

    fireEvent.click(screen.getByRole('button', { name: 'New Item' }))

    expect(screen.getByLabelText('SKU')).toHaveValue('')
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('handleDiscard restores form to last loaded state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })

    // Modify a field
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Changed Name' } })
    expect(screen.getByLabelText('Name')).toHaveValue('Changed Name')

    // Discard should restore
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Inventory Item')
  })

  it('handleDelete calls deleteInventoryItem and resets form', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    api.deleteInventoryItem = vi.fn(async () => {})

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Item' }))
    // Confirm the dialog
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    await waitFor(() => {
      expect(api.deleteInventoryItem).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('')
    })
  })

  it('shows error when deleteInventoryItem is not available', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    // deleteInventoryItem not present

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Item' }))
    // Confirm the dialog
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Delete' }))

    expect(
      await screen.findByText('Delete is not available in this environment.')
    ).toBeInTheDocument()
    // Form should NOT be reset
    expect(screen.getByLabelText('SKU')).toHaveValue('SKU-001')
    expect(api.deleteInventoryItem).toBeUndefined()
  })

  it('shows error when API fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.saveInventoryItem = vi.fn(async () => {
      throw new Error('Save failed')
    })

    render(<ItemFormWithButtons />)

    setItemType('11')
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-ERR' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Error Item' } })
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '1' } })
    setTaxRate('0.13')

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    expect(await screen.findByText('Save failed')).toBeInTheDocument()
  })

  it('defaults to Case & Quantity sub-tab', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Bottles Per Case')).toBeInTheDocument()
    })

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

    expect(screen.getByLabelText('Switch to percent mode')).toHaveAttribute('data-state', 'on')
    expect(screen.getByLabelText('Switch to dollar mode')).toHaveAttribute('data-state', 'off')
    expect(screen.getByLabelText('Case Discount Percent')).toBeInTheDocument()
  })

  it('switches to dollar mode when $ toggle is clicked', async () => {
    render(<ItemForm />)

    await waitFor(() => {
      expect(screen.getByLabelText('Bottles Per Case')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Switch to dollar mode'))

    expect(screen.getByLabelText('Switch to dollar mode')).toHaveAttribute('data-state', 'on')
    expect(screen.getByLabelText('Case Discount Price')).toBeInTheDocument()
  })

  it('loads existing item with case_discount_price as percent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    // retail_price=15, bottles_per_case=12 → fullCase=$180
    // stored case_discount_price=149.99 → pct = (1 - 149.99/180)*100 ≈ 16.6722
    api.getInventoryProductDetail = vi.fn(async () => ({
      ...baseDetail,
      case_discount_price: 149.99
    }))

    render(<ItemFormWithButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Load Item' }))

    await waitFor(() => {
      expect(api.getInventoryProductDetail).toHaveBeenCalledWith(1)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Switch to percent mode')).toHaveAttribute('data-state', 'on')
    })
    expect(screen.getByLabelText('Case Discount Percent')).toHaveValue('16.67')
  })

  it('saves case discount in percent mode as dollar value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<ItemFormWithButtons />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-CASE' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Case Item' } })
    setItemType('11')
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '7' } })
    setTaxRate('0.13')

    // Enter 10% discount on a $10 x 12 = $120 full case price → $108
    fireEvent.change(screen.getByLabelText('Case Discount Percent'), { target: { value: '10' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    await waitFor(() => {
      expect(api.saveInventoryItem).toHaveBeenCalled()
    })
    expect(api.saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        case_discount_price: 108
      })
    )
  })

  it('does not show tax validation error when no tax rate is selected', async () => {
    render(<ItemFormWithButtons />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SKU-NOTAX' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'No Tax Item' } })
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('In Stock'), { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }))

    await waitFor(() => {
      expect(
        screen.queryByText('Tax code must be selected from available values')
      ).not.toBeInTheDocument()
    })
  })

  it('removes a special pricing rule', async () => {
    render(<ItemForm />)

    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'TEST' } })

    await userEvent.click(screen.getByRole('tab', { name: 'Special Pricing' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Add Rule' }))

    expect(screen.getByLabelText('Rule 1 Quantity')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(screen.queryByLabelText('Rule 1 Quantity')).not.toBeInTheDocument()
  })

  it('displays computed profit margin', () => {
    render(<ItemForm />)

    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '1000' } }) // $10
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '2000' } }) // $20

    // profit = (20-10)/20 * 100 = 50%
    expect(screen.getByLabelText('Profit Margin')).toHaveTextContent('50.0%')
  })

  it('displays — for profit margin when fields are empty', () => {
    render(<ItemForm />)

    expect(screen.getByLabelText('Profit Margin')).toHaveTextContent('—')
  })

  it('displays computed final price with tax', async () => {
    render(<ItemForm />)

    // Wait for tax code options to load so the select value can be set
    await waitFor(() => {
      const sel = screen.getByLabelText('Tax Codes') as HTMLSelectElement
      expect(sel.options.length).toBeGreaterThan(1)
    })

    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1000' } }) // $10
    fireEvent.change(screen.getByLabelText('Tax Codes'), { target: { value: '0.13' } }) // 13%

    // final = 10 * 1.13 = $11.30
    expect(screen.getByLabelText('Final Price with Tax')).toHaveValue('$11.30')
  })

  it('auto-fills tax code when item type with default_tax_rate is selected', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getItemTypes = vi.fn(async () => [
      {
        id: 1,
        name: 'Wine',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 13
      }
    ])

    render(<ItemForm />)

    // Wait for item type options to load
    await waitFor(() => {
      const sel = screen.getByLabelText('Item Type') as HTMLSelectElement
      expect(sel.options.length).toBeGreaterThan(1)
    })

    fireEvent.change(screen.getByLabelText('Item Type'), { target: { value: 'Wine' } })

    // default_tax_rate = 13 → rate = 0.13
    await waitFor(() => {
      expect(screen.getByLabelText('Tax Codes')).toHaveValue('0.13')
    })
  })

  it('auto-calculates retail price when cost is entered with an item type that has a margin', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getItemTypes = vi.fn(async () => [
      {
        id: 1,
        name: 'Spirits',
        description: null,
        default_profit_margin: 25,
        default_tax_rate: 0
      }
    ])

    render(<ItemForm />)

    await waitFor(() => {
      const sel = screen.getByLabelText('Item Type') as HTMLSelectElement
      expect(sel.options.length).toBeGreaterThan(1)
    })

    fireEvent.change(screen.getByLabelText('Item Type'), { target: { value: 'Spirits' } })
    // Enter cost $10.00 → price = 10 / (1 - 0.25) = $13.33
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '1000' } })

    await waitFor(() => {
      expect(screen.getByLabelText('Price Charged')).toHaveValue('$13.33')
    })
  })

  it('auto-calculates retail price when item type is changed after cost is already entered', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getItemTypes = vi.fn(async () => [
      { id: 1, name: 'Beer', description: null, default_profit_margin: 0, default_tax_rate: 0 },
      {
        id: 2,
        name: 'Whiskey',
        description: null,
        default_profit_margin: 40,
        default_tax_rate: 0
      }
    ])

    render(<ItemForm />)

    await waitFor(() => {
      const sel = screen.getByLabelText('Item Type') as HTMLSelectElement
      expect(sel.options.length).toBeGreaterThan(2)
    })

    // Enter cost first
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '2000' } }) // $20

    // Change item type to one with a margin — price = 20 / (1 - 0.40) = $33.33
    fireEvent.change(screen.getByLabelText('Item Type'), { target: { value: 'Whiskey' } })

    await waitFor(() => {
      expect(screen.getByLabelText('Price Charged')).toHaveValue('$33.33')
    })
  })

  it('clears auto indicator when price is manually edited', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getItemTypes = vi.fn(async () => [
      {
        id: 1,
        name: 'Wine',
        description: null,
        default_profit_margin: 30,
        default_tax_rate: 0
      }
    ])

    render(<ItemForm />)

    await waitFor(() => {
      const sel = screen.getByLabelText('Item Type') as HTMLSelectElement
      expect(sel.options.length).toBeGreaterThan(1)
    })

    fireEvent.change(screen.getByLabelText('Item Type'), { target: { value: 'Wine' } })
    fireEvent.change(screen.getByLabelText('Per Bottle Cost'), { target: { value: '1000' } })

    // Auto label should appear
    await waitFor(() => {
      expect(screen.getByText('auto')).toBeInTheDocument()
    })

    // Manual price edit clears it
    fireEvent.change(screen.getByLabelText('Price Charged'), { target: { value: '1500' } })
    expect(screen.queryByText('auto')).not.toBeInTheDocument()
  })
})
