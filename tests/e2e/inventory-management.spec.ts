import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Full mock that covers POS products + inventory CRUD (item types, tax codes, distributors, items).
 * Each store is an in-memory array so the test can create-then-verify round-trips.
 */
const attachFullApiMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    /* ── In-memory stores ── */
    const itemTypes: Array<{
      id: number
      name: string
      description: string | null
      default_profit_margin: number
      default_tax_rate: number
    }> = []
    const taxCodes: Array<{ id: number; code: string; rate: number }> = []
    const distributors: Array<{
      distributor_number: number
      distributor_name: string
      license_id: string | null
      serial_number: string | null
      premises_name: string | null
      premises_address: string | null
      is_active: number
    }> = []
    const salesReps: Array<{
      sales_rep_id: number
      distributor_number: number
      rep_name: string
      phone: string | null
      email: string | null
      is_active: number
    }> = []
    const inventoryItems: Array<Record<string, unknown>> = []
    const products: Array<{
      id: number
      sku: string
      name: string
      category: string
      price: number
      quantity: number
      tax_rate: number
    }> = [
      {
        id: 1,
        sku: 'WINE-001',
        name: 'Cabernet Sauvignon 750ml',
        category: 'Wine',
        price: 19.99,
        quantity: 24,
        tax_rate: 0.13
      }
    ]

    let nextItemTypeId = 1
    let nextTaxId = 1
    let nextDistributorId = 1
    let nextSalesRepId = 1
    let nextItemId = 2

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      // Auth APIs
      getMerchantConfig: async () => ({
        id: 1,
        finix_api_username: 'US-test-api-key',
        finix_api_password: 'test-finix-password',
        merchant_id: 'MU-test-merchant-id',
        merchant_name: 'Test Liquor Store',
        activated_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }),
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: {
          id: 1,
          finix_api_username: 'US-test-api-key',
          finix_api_password: 'test-finix-password',
          merchant_id: 'MU-test-merchant-id',
          merchant_name: 'Test Liquor Store',
          activated_at: '2025-01-01T00:00:00.000Z',
          updated_at: '2025-01-01T00:00:00.000Z'
        }
      }),
      onDeepLink: () => {},
      consumePendingDeepLink: async () => null,
      getCashiers: async () => [
        { id: 1, name: 'Test Cashier', role: 'admin', is_active: 1, created_at: '2025-01-01' }
      ],
      validatePin: async () => ({
        id: 1,
        name: 'Test Cashier',
        role: 'admin',
        is_active: 1,
        created_at: '2025-01-01'
      }),

      /* ── Products (POS screen) ── */
      getProducts: async () => [...products],

      /* ── Inventory item search / detail / save ── */
      searchInventoryProducts: async (query: string) => {
        const q = query.trim().toLowerCase()
        return inventoryItems
          .filter(
            (it) =>
              !q ||
              String(it.sku).toLowerCase().includes(q) ||
              String(it.item_name).toLowerCase().includes(q)
          )
          .map((it) => ({ ...it }))
      },
      getInventoryProductDetail: async (itemNumber: number) =>
        inventoryItems.find((it) => it.item_number === itemNumber) ?? null,

      getInventoryTaxCodes: async () => taxCodes.map((tc) => ({ code: tc.code, rate: tc.rate })),

      saveInventoryItem: async (payload: Record<string, unknown>) => {
        const id =
          (payload.item_number as number | undefined) ??
          inventoryItems.reduce(
            (max, c) => Math.max(max, c.item_number as number),
            nextItemId - 1
          ) + 1
        const taxRates = payload.tax_rates as number[]
        const item = {
          item_number: id,
          sku: payload.sku,
          item_name: payload.item_name,
          category_id: null,
          category_name: null,
          cost: payload.cost,
          retail_price: payload.retail_price,
          in_stock: payload.in_stock,
          tax_1: taxRates[0] ?? 0,
          tax_2: taxRates[1] ?? 0,
          tax_rates: taxRates,
          distributor_number: null,
          distributor_name: null,
          bottles_per_case: payload.bottles_per_case ?? 12,
          case_discount_price: payload.case_discount_price ?? null,
          barcode: null,
          description: null,
          special_pricing_enabled: 0,
          special_price: null,
          is_active: 1,
          additional_skus: payload.additional_skus ?? [],
          special_pricing: payload.special_pricing ?? [],
          sales_history: []
        }
        const idx = inventoryItems.findIndex((it) => it.item_number === id)
        if (idx >= 0) inventoryItems[idx] = item
        else inventoryItems.push(item)

        // Also push into the POS products list so POS screen sees it after reload
        const newProduct = {
          id: id,
          sku: String(payload.sku),
          name: String(payload.item_name),
          category: payload.item_type ?? 'General',
          price: payload.retail_price as number,
          quantity: payload.in_stock as number,
          tax_rate: taxRates[0] ?? 0
        }
        const pIdx = products.findIndex((p) => p.id === id)
        if (pIdx >= 0) products[pIdx] = newProduct
        else products.push(newProduct)

        nextItemId = Math.max(nextItemId, id + 1)
        return item
      },

      /* ── Item Types CRUD ── */
      getItemTypes: async () => itemTypes.map((it) => ({ ...it })),
      createItemType: async (input: {
        name: string
        description?: string | null
        default_profit_margin?: number
        default_tax_rate?: number
      }) => {
        const itemType = {
          id: nextItemTypeId++,
          name: input.name,
          description: input.description ?? null,
          default_profit_margin: input.default_profit_margin ?? 0,
          default_tax_rate: input.default_tax_rate ?? 0
        }
        itemTypes.push(itemType)
        return { ...itemType }
      },
      updateItemType: async (input: {
        id: number
        name: string
        description?: string | null
        default_profit_margin?: number
        default_tax_rate?: number
      }) => {
        const itemType = itemTypes.find((it) => it.id === input.id)
        if (itemType) {
          itemType.name = input.name
          itemType.description = input.description ?? null
          itemType.default_profit_margin = input.default_profit_margin ?? 0
          itemType.default_tax_rate = input.default_tax_rate ?? 0
        }
        return itemType ? { ...itemType } : undefined
      },
      deleteItemType: async (id: number) => {
        const idx = itemTypes.findIndex((it) => it.id === id)
        if (idx >= 0) itemTypes.splice(idx, 1)
      },

      /* ── Tax Codes CRUD ── */
      getTaxCodes: async () => taxCodes.map((tc) => ({ ...tc })),
      createTaxCode: async (input: { code: string; rate: number }) => {
        const tc = { id: nextTaxId++, code: input.code, rate: input.rate }
        taxCodes.push(tc)
        return tc
      },
      updateTaxCode: async (input: { id: number; code: string; rate: number }) => {
        const tc = taxCodes.find((t) => t.id === input.id)
        if (tc) {
          tc.code = input.code
          tc.rate = input.rate
        }
        return tc
      },
      deleteTaxCode: async (id: number) => {
        const idx = taxCodes.findIndex((t) => t.id === id)
        if (idx >= 0) taxCodes.splice(idx, 1)
      },

      /* ── Distributors CRUD ── */
      getDistributors: async () => distributors.map((d) => ({ ...d })),
      createDistributor: async (input: { distributor_name: string }) => {
        const d = {
          distributor_number: nextDistributorId++,
          distributor_name: input.distributor_name,
          license_id: null,
          serial_number: null,
          premises_name: null,
          premises_address: null,
          is_active: 1
        }
        distributors.push(d)
        return d
      },
      updateDistributor: async (input: {
        distributor_number: number
        distributor_name: string
        license_id?: string
        serial_number?: string
        premises_name?: string
        premises_address?: string
      }) => {
        const d = distributors.find((dn) => dn.distributor_number === input.distributor_number)
        if (d) {
          d.distributor_name = input.distributor_name
          d.license_id = input.license_id ?? null
          d.serial_number = input.serial_number ?? null
          d.premises_name = input.premises_name ?? null
          d.premises_address = input.premises_address ?? null
        }
        return d
      },
      deleteDistributor: async (distributorNumber: number) => {
        const idx = distributors.findIndex((d) => d.distributor_number === distributorNumber)
        if (idx >= 0) distributors.splice(idx, 1)
      },

      /* ── Sales Reps CRUD ── */
      getSalesRepsByDistributor: async (distNum: number) =>
        salesReps.filter((r) => r.distributor_number === distNum).map((r) => ({ ...r })),
      createSalesRep: async (input: {
        distributor_number: number
        rep_name: string
        phone?: string
        email?: string
      }) => {
        const rep = {
          sales_rep_id: nextSalesRepId++,
          distributor_number: input.distributor_number,
          rep_name: input.rep_name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          is_active: 1
        }
        salesReps.push(rep)
        return rep
      },
      updateSalesRep: async (input: {
        sales_rep_id: number
        rep_name: string
        phone?: string
        email?: string
      }) => {
        const rep = salesReps.find((r) => r.sales_rep_id === input.sales_rep_id)
        if (rep) {
          rep.rep_name = input.rep_name
          rep.phone = input.phone ?? null
          rep.email = input.email ?? null
        }
        return rep
      },
      deleteSalesRep: async (salesRepId: number) => {
        const idx = salesReps.findIndex((r) => r.sales_rep_id === salesRepId)
        if (idx >= 0) salesReps.splice(idx, 1)
      }
    }
  })
}

/** Enter PIN 1234 on the login screen to get to POS */
const loginWithPin = async (page: Page): Promise<void> => {
  const pinKey = page.locator('.pin-key').first()
  await pinKey.waitFor({ state: 'visible', timeout: 10000 })
  for (const digit of ['1', '2', '3', '4']) {
    await page.locator(`.pin-key:text("${digit}")`).click()
  }
  await page
    .locator('.action-panel__product-tile')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
}

const gotoAndLogin = async (page: Page): Promise<void> => {
  await page.goto('/')
  await loginWithPin(page)
}

/**
 * Activate a tab within the inventory modal via focus.
 * Radix Tabs with automatic activation mode switches tabs when a trigger is focused.
 * Native Playwright .click() hangs on CDP for elements inside this modal.
 */
const clickTab = async (page: Page, name: string): Promise<void> => {
  const tab = page.getByRole('tab', { name })
  await tab.focus()
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
}

/**
 * Fill an input inside the modal using evaluate + native value setter.
 * Works with React controlled inputs. Clears first for edit scenarios.
 */
const fillInput = async (locator: Locator, value: string): Promise<void> => {
  await locator.evaluate((el, val) => {
    const input = el as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** Set a native <select> value inside the modal via DOM manipulation (avoids CDP hang). */
const selectValue = async (locator: Locator, value: string): Promise<void> => {
  await locator.evaluate((el, val) => {
    const select = el as HTMLSelectElement
    select.value = val
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

/** Click an element inside the modal using dispatchEvent (avoids CDP hang). */
const clickEl = async (locator: Locator): Promise<void> => {
  await locator.dispatchEvent('click')
}

test.describe('Inventory Management – Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await attachFullApiMock(page)
    await gotoAndLogin(page)
  })

  test('creates item type, tax code, distributor, saves item, then verifies on POS screen', async ({
    page
  }) => {
    test.setTimeout(60_000)
    /* ── Step 1: Open Inventory Modal ── */
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    const dialog = page.getByRole('dialog', { name: 'Inventory Management' })
    await expect(dialog).toBeVisible()

    /* ── Step 2: Create an Item Type ── */
    await clickTab(page, 'Item Types')
    await fillInput(page.getByRole('textbox', { name: 'Item Type Name' }), 'Wine')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Item type created')).toBeVisible()
    const itemTypeTable = page.getByRole('table', { name: 'Item types list' })
    await expect(itemTypeTable.getByText('Wine')).toBeVisible()

    /* ── Step 3: Create a Tax Code ── */
    await clickTab(page, 'Tax Codes')
    await fillInput(page.getByRole('textbox', { name: 'Tax Code Name' }), 'HST')
    await fillInput(page.getByRole('textbox', { name: 'Tax Rate' }), '13')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Tax code created')).toBeVisible()
    const taxTable = page.getByRole('table', { name: 'Tax codes list' })
    await expect(taxTable.getByText('HST')).toBeVisible()
    await expect(taxTable.getByText('13%')).toBeVisible()

    /* ── Step 4: Create a Distributor ── */
    await clickTab(page, 'Distributors')
    await fillInput(page.getByRole('textbox', { name: 'Distributor Name' }), 'Premium Wines Inc')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Distributor created')).toBeVisible()
    const distTable = page.getByRole('table', { name: 'Distributors list' })
    await expect(distTable.getByText('Premium Wines Inc')).toBeVisible()

    /* ── Step 5: Switch to Items tab and save a new item ── */
    await clickTab(page, 'Items')

    const sku = `E2E-${Date.now()}`
    const itemName = `Test Merlot 750ml`

    await fillInput(page.getByRole('textbox', { name: 'SKU', exact: true }), sku)
    await fillInput(page.getByRole('textbox', { name: 'Name', exact: true }), itemName)

    // Item type dropdown (scoped inside Items tabpanel)
    const itemsPanel = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel.getByLabel('Item Type').selectOption({ label: 'Wine' })

    await fillInput(page.getByLabel('Per Bottle Cost'), '12.50')
    await fillInput(page.getByLabel('Price Charged'), '24.99')
    await fillInput(page.getByLabel('In Stock'), '30')

    // Tax code dropdown (scoped inside Items tabpanel)
    const taxSelect = itemsPanel.getByLabel('Tax Codes')
    const taxOptions = await taxSelect.locator('option').allTextContents()
    const hstOption = taxOptions.find((t) => t.includes('HST'))
    if (hstOption) await taxSelect.selectOption({ label: hstOption })

    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Item saved')).toBeVisible()

    /* ── Step 6: Close inventory modal ── */
    await clickEl(page.getByRole('button', { name: 'Close' }))
    await expect(dialog).not.toBeVisible()

    /* ── Step 7: Verify item appears on POS screen ── */
    await page.locator('.action-panel__category-trigger').click()
    await page.locator('.action-panel__category-item', { hasText: 'All' }).click()
    await expect(page.getByText(itemName)).toBeVisible()

    /* ── Step 8: Search for the item ── */
    await page.getByPlaceholder('Search item').fill(sku)
    await expect(page.getByText(itemName)).toBeVisible()
  })

  test('edits and deletes an item type', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await clickTab(page, 'Item Types')

    // Create
    await fillInput(page.getByRole('textbox', { name: 'Item Type Name' }), 'Beer')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Item type created')).toBeVisible()

    const itemTypeTable = page.getByRole('table', { name: 'Item types list' })
    await expect(itemTypeTable.getByText('Beer')).toBeVisible()

    // Select the item type by clicking its row
    await clickEl(itemTypeTable.locator('tr', { hasText: 'Beer' }))

    // Edit the name in the bottom edit section
    await fillInput(page.getByRole('textbox', { name: 'Edit Item Type Name' }), 'Craft Beer')
    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Item type saved')).toBeVisible()
    await expect(itemTypeTable.getByText('Craft Beer')).toBeVisible()

    // Delete
    await clickEl(page.getByRole('button', { name: 'Delete' }))
    await clickEl(page.getByRole('button', { name: 'Yes, Delete' }))
    await expect(page.getByText('Item type deleted')).toBeVisible()
    await expect(page.getByText('No item types yet. Add one above to get started.')).toBeVisible()
  })

  test('saves item type with description, margin, and tax rate', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    // First create a tax code so the dropdown has options
    await clickTab(page, 'Tax Codes')
    await fillInput(page.getByRole('textbox', { name: 'Tax Code Name' }), 'HST')
    await fillInput(page.getByRole('textbox', { name: 'Tax Rate' }), '13')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Tax code created')).toBeVisible()

    // Now go to Item Types
    await clickTab(page, 'Item Types')

    // Create an item type first
    await fillInput(page.getByRole('textbox', { name: 'Item Type Name' }), 'Spirits')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Item type created')).toBeVisible()

    const itemTypeTable = page.getByRole('table', { name: 'Item types list' })
    await expect(itemTypeTable.getByText('Spirits')).toBeVisible()

    // Select the item type to open the edit form
    await clickEl(itemTypeTable.locator('tr', { hasText: 'Spirits' }))

    // Fill all edit fields
    await fillInput(page.getByRole('textbox', { name: 'Edit Item Type Name' }), 'Premium Spirits')
    await fillInput(page.getByLabel('Edit Item Type Description'), 'Whiskey, vodka, and rum')
    await fillInput(page.getByLabel('Edit Default Profit Margin'), '40')
    // Select HST (13%) from the dropdown
    await selectValue(page.getByLabel('Edit Default Tax Rate'), '13')

    // Save
    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Item type saved')).toBeVisible()

    // Verify the table reflects all saved changes
    await expect(itemTypeTable.getByText('Premium Spirits')).toBeVisible()
    await expect(itemTypeTable.getByText('Whiskey, vodka, and rum')).toBeVisible()
    await expect(itemTypeTable.getByText('40%')).toBeVisible()
    await expect(itemTypeTable.getByText('13%')).toBeVisible()
  })

  test('validates required fields on CRUD panels', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    // Item type: empty name
    await clickTab(page, 'Item Types')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Name is required')).toBeVisible()

    // Tax Code: empty fields
    await clickTab(page, 'Tax Codes')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Code is required')).toBeVisible()
    await expect(page.getByText('Rate is required')).toBeVisible()

    // Distributor: empty name
    await clickTab(page, 'Distributors')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Distributor name is required')).toBeVisible()
  })

  test('edits and deletes a tax code', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await clickTab(page, 'Tax Codes')

    // Create
    await fillInput(page.getByRole('textbox', { name: 'Tax Code Name' }), 'GST')
    await fillInput(page.getByRole('textbox', { name: 'Tax Rate' }), '5')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Tax code created')).toBeVisible()

    const taxTable = page.getByRole('table', { name: 'Tax codes list' })

    // Select the tax code by clicking its row
    await clickEl(taxTable.locator('tr', { hasText: 'GST' }))

    // Edit in the bottom panel
    await fillInput(page.getByRole('textbox', { name: 'Edit Tax Code Name' }), 'PST')
    await fillInput(page.getByRole('textbox', { name: 'Edit Tax Rate' }), '8')
    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Tax code updated')).toBeVisible()
    await expect(taxTable.getByText('PST')).toBeVisible()

    // Delete via bottom panel
    await clickEl(page.getByRole('button', { name: 'Delete' }))
    await clickEl(page.getByRole('button', { name: 'Yes, Delete' }))
    await expect(page.getByText('Tax code deleted')).toBeVisible()
    await expect(page.getByText('No tax codes yet')).toBeVisible()
  })

  test('edits and deletes a distributor', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await clickTab(page, 'Distributors')

    // Create
    await fillInput(page.getByRole('textbox', { name: 'Distributor Name' }), 'ABC Dist')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Distributor created')).toBeVisible()

    const distTable = page.getByRole('table', { name: 'Distributors list' })

    // Select distributor by clicking its row
    await clickEl(distTable.locator('tr', { hasText: 'ABC Dist' }))

    // Edit in the bottom panel
    await fillInput(
      page.getByRole('textbox', { name: 'Edit Distributor Name' }),
      'XYZ Distributors'
    )
    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Distributor saved')).toBeVisible()
    await expect(distTable.getByText('XYZ Distributors')).toBeVisible()

    // Delete via bottom panel
    await clickEl(page.getByRole('button', { name: 'Delete' }))
    await clickEl(page.getByRole('button', { name: 'Yes, Delete' }))
    await expect(page.getByText('Distributor deleted')).toBeVisible()
    await expect(page.getByText('No distributors yet')).toBeVisible()
  })

  test('items tab defaults to Case & Quantity sub-tab', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    const dialog = page.getByRole('dialog', { name: 'Inventory Management' })
    await expect(dialog).toBeVisible()

    // Items tab is already the default
    await clickTab(page, 'Items')

    // Case & Quantity sub-tab should be active by default
    const caseTab = page.getByRole('tab', { name: 'Case & Quantity' })
    await expect(caseTab).toHaveAttribute('aria-selected', 'true')

    // Bottles Per Case input should be visible
    await expect(page.getByLabel('Bottles Per Case')).toBeVisible()

    // Percent mode toggle should be active by default
    await expect(page.getByLabel('Switch to percent mode')).toHaveAttribute('aria-checked', 'true')
  })

  test('case discount supports percent and dollar toggle', async ({ page }) => {
    test.setTimeout(60_000)
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await clickTab(page, 'Items')

    // Initially in percent mode
    await expect(page.getByLabel('Case Discount Percent')).toBeVisible()

    // Switch to dollar mode
    await clickEl(page.getByLabel('Switch to dollar mode'))
    await expect(page.getByLabel('Case Discount Price')).toBeVisible()
    expect(await page.getByLabel('Switch to dollar mode').getAttribute('aria-checked')).toBe('true')

    // Switch back to percent mode
    await clickEl(page.getByLabel('Switch to percent mode'))
    await expect(page.getByLabel('Case Discount Percent')).toBeVisible()
    expect(await page.getByLabel('Switch to percent mode').getAttribute('aria-checked')).toBe(
      'true'
    )
  })

  test('editing item with tax code does not show validation error', async ({ page }) => {
    test.setTimeout(60_000)
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    const dialog = page.getByRole('dialog', { name: 'Inventory Management' })
    await expect(dialog).toBeVisible()

    /* Create a tax code first */
    await clickTab(page, 'Tax Codes')
    await fillInput(page.getByRole('textbox', { name: 'Tax Code Name' }), 'HST')
    await fillInput(page.getByRole('textbox', { name: 'Tax Rate' }), '13')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Tax code created')).toBeVisible()

    /* Create an item type */
    await clickTab(page, 'Item Types')
    await fillInput(page.getByRole('textbox', { name: 'Item Type Name' }), 'Wine')
    await clickEl(page.getByRole('button', { name: 'Add' }))
    await expect(page.getByText('Item type created')).toBeVisible()

    /* Switch to Items and create an item with a tax code */
    await clickTab(page, 'Items')
    await fillInput(page.getByRole('textbox', { name: 'SKU', exact: true }), 'TAX-TEST')
    await fillInput(page.getByRole('textbox', { name: 'Name', exact: true }), 'Tax Test Item')

    // Item type dropdown (scoped inside Items tabpanel)
    const itemsPanel2 = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel2.getByLabel('Item Type').selectOption({ label: 'Wine' })

    await fillInput(page.getByLabel('Per Bottle Cost'), '10.00')
    await fillInput(page.getByLabel('Price Charged'), '20.00')
    await fillInput(page.getByLabel('In Stock'), '10')

    // Tax code dropdown (scoped inside Items tabpanel)
    const taxSelect2 = itemsPanel2.getByLabel('Tax Codes')
    const taxOptions2 = await taxSelect2.locator('option').allTextContents()
    const hstOption2 = taxOptions2.find((t) => t.includes('HST'))
    if (hstOption2) await taxSelect2.selectOption({ label: hstOption2 })

    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Item saved')).toBeVisible()

    /* Now search for the saved item to edit it */
    await fillInput(page.getByLabel('Search Inventory'), 'TAX-TEST')
    await clickEl(page.getByRole('button', { name: 'Search' }))

    // Wait for item to load
    await expect(page.getByLabel('SKU', { exact: true })).toHaveValue('TAX-TEST', { timeout: 5000 })

    /* Save again without changes — no validation error should appear */
    await clickEl(page.getByRole('button', { name: 'Save' }))
    await expect(page.getByText('Item saved')).toBeVisible()

    // The tax code validation error should NOT appear
    await expect(
      page.getByText('At least one tax code must be selected from backend values')
    ).not.toBeVisible()
  })
})
