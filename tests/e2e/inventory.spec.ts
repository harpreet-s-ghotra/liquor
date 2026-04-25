import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachInventoryApiMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const inventoryStore = [
      {
        item_number: 1,
        sku: 'SKU-001',
        item_name: 'Inventory Item',
        category_id: null,
        category_name: null,
        cost: 10,
        retail_price: 15,
        in_stock: 4,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: null,
        distributor_name: null,
        bottles_per_case: 12,
        barcode: null,
        description: null,
        size: '750ML',
        special_pricing_enabled: 0,
        special_price: null,
        is_active: 1,
        additional_skus: ['SKU-001-ALT'],
        special_pricing: [],
        sales_history: []
      },
      {
        item_number: 2,
        sku: 'SKU-002',
        item_name: 'Second Item',
        category_id: null,
        category_name: null,
        cost: 8,
        retail_price: 12,
        in_stock: 10,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: null,
        distributor_name: null,
        bottles_per_case: 6,
        barcode: null,
        description: null,
        size: '1.75L',
        special_pricing_enabled: 0,
        special_price: null,
        is_active: 1,
        additional_skus: [],
        special_pricing: [],
        sales_history: []
      }
    ]

    const products = [
      {
        id: 1,
        sku: 'SKU-001',
        name: 'Inventory Item',
        category: 'Wine',
        price: 15,
        quantity: 4,
        tax_rate: 0.13
      },
      {
        id: 2,
        sku: 'SKU-002',
        name: 'Second Item',
        category: 'Wine',
        price: 12,
        quantity: 10,
        tax_rate: 0.13
      }
    ]

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

      hasAnyProduct: async () => true,

      getProducts: async () => products,
      searchInventoryProducts: async (query: string) => {
        const normalized = query.trim().toLowerCase()
        return inventoryStore
          .filter((item) => {
            if (!normalized) {
              return true
            }

            return (
              item.sku.toLowerCase().includes(normalized) ||
              item.item_name.toLowerCase().includes(normalized)
            )
          })
          .map((item) => ({
            item_number: item.item_number,
            sku: item.sku,
            item_name: item.item_name,
            category_id: item.category_id,
            category_name: item.category_name,
            cost: item.cost,
            retail_price: item.retail_price,
            in_stock: item.in_stock,
            tax_1: item.tax_1,
            tax_2: item.tax_2,
            distributor_number: item.distributor_number,
            distributor_name: item.distributor_name,
            bottles_per_case: item.bottles_per_case,
            barcode: item.barcode,
            description: item.description,
            special_pricing_enabled: item.special_pricing_enabled,
            special_price: item.special_price,
            is_active: item.is_active
          }))
      },
      getInventoryProductDetail: async (itemNumber: number) => {
        return inventoryStore.find((item) => item.item_number === itemNumber) ?? null
      },
      getInventoryTaxCodes: async () => [
        { code: 'RATE_0', rate: 0 },
        { code: 'RATE_0_13', rate: 0.13 }
      ],
      listSizesInUse: async () => ['750ML', '1.75L', '355ML'],
      getItemTypes: async () => [
        {
          id: 1,
          name: 'Wine',
          description: null,
          default_profit_margin: 0.35,
          default_tax_rate: 0.08
        },
        {
          id: 2,
          name: 'Spirits',
          description: null,
          default_profit_margin: 0.4,
          default_tax_rate: 0.08
        }
      ],
      getTaxCodes: async () => [],
      getDistributors: async () => [],
      getActiveSpecialPricing: async () => [],
      saveInventoryItem: async (payload) => {
        const nextId =
          payload.item_number ??
          inventoryStore.reduce((max, current) => Math.max(max, current.item_number), 0) + 1

        // Validate additional SKUs don't conflict with other products
        if (payload.additional_skus?.length) {
          for (const altSku of payload.additional_skus) {
            const primaryConflict = inventoryStore.find(
              (item) => item.sku === altSku && item.is_active === 1 && item.item_number !== nextId
            )
            if (primaryConflict) {
              throw new Error(
                `Additional SKU "${altSku}" is already the primary SKU of "${primaryConflict.item_name}"`
              )
            }
            const altConflict = inventoryStore.find(
              (item) =>
                item.item_number !== nextId &&
                item.is_active === 1 &&
                item.additional_skus?.includes(altSku)
            )
            if (altConflict) {
              throw new Error(
                `Additional SKU "${altSku}" is already used by "${altConflict.item_name}"`
              )
            }
          }
        }

        const existingIndex = inventoryStore.findIndex((item) => item.item_number === nextId)
        const nextItem = {
          item_number: nextId,
          sku: payload.sku,
          item_name: payload.item_name,
          category_id: null,
          category_name: null,
          cost: payload.cost,
          retail_price: payload.retail_price,
          in_stock: payload.in_stock,
          tax_1: payload.tax_rates[0] ?? 0,
          tax_2: payload.tax_rates[1] ?? 0,
          tax_rates: payload.tax_rates,
          distributor_number: null,
          distributor_name: null,
          bottles_per_case: payload.bottles_per_case ?? 12,
          case_discount_price: payload.case_discount_price ?? null,
          barcode: null,
          description: null,
          special_pricing_enabled: payload.special_pricing.length > 0 ? 1 : 0,
          special_price:
            payload.special_pricing.length > 0 ? payload.special_pricing[0].price : null,
          is_active: 1,
          additional_skus: payload.additional_skus,
          special_pricing: payload.special_pricing ?? [],
          sales_history: [],
          display_name: payload.display_name ?? null,
          proof: payload.proof ?? null,
          alcohol_pct: payload.alcohol_pct ?? null,
          vintage: payload.vintage ?? null,
          ttb_id: payload.ttb_id ?? null,
          size: payload.size ?? null,
          case_cost: null,
          nysla_discounts: null,
          brand_name: null,
          item_type: null
        }

        if (existingIndex >= 0) {
          inventoryStore[existingIndex] = nextItem
        } else {
          inventoryStore.push(nextItem)
        }

        return nextItem
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
  await page.locator('.ticket-panel').waitFor({ state: 'visible', timeout: 10000 })
}

const gotoAndLogin = async (page: Page): Promise<void> => {
  await page.goto('/')
  await loginWithPin(page)
}

test.describe('Inventory Management', () => {
  test('opens inventory popup from F2 button', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    await expect(page.getByRole('dialog', { name: 'Inventory Management' })).toBeVisible()
    await expect(page.getByLabel('Search Inventory')).toBeVisible()
  })

  test('validates required fields before saving', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    // Click Save with all fields empty to trigger validation
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('SKU is required')).toBeVisible()
    await expect(page.getByText('Name is required')).toBeVisible()
    await expect(page.getByText('Cost is required')).toBeVisible()
    await expect(page.getByText('Price is required')).toBeVisible()
    await expect(page.getByText('In stock is required')).toBeVisible()
  })

  test('saves a new inventory item and finds it by search', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    const sku = `E2E-${Date.now()}`
    const name = `E2E ITEM ${Date.now()}`

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill(sku)
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
    // Item type dropdown (standard select)
    // Scope inside Items tabpanel to avoid matching Radix tab panels
    const itemsPanel = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel.getByLabel('Item Type').selectOption({ label: 'Wine' })

    await page.getByLabel('Per Bottle Cost').fill('9.99')
    await page.getByLabel('Price Charged').fill('15.99')
    await page.getByLabel('In Stock').fill('8')

    // Tax code dropdown (scoped inside Items tabpanel)
    const taxSel = itemsPanel.getByLabel('Tax Codes')
    const taxOpts = await taxSel.locator('option').allTextContents()
    const rate13 = taxOpts.find((t) => t.includes('13'))
    if (rate13) await taxSel.selectOption({ label: rate13 })

    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Item saved')).toBeVisible()

    // Search for the saved item — it auto-loads into form
    await page.getByLabel('Search Inventory').fill(sku)
    await page.getByRole('button', { name: 'Search' }).click()

    // Verify the item was loaded into the form
    await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue(sku)
  })

  test('renders Additional SKUs tab trigger', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await expect(page.getByRole('tab', { name: 'Additional SKUs' })).toBeVisible()
  })

  test('renders Additional Info tab trigger', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await expect(page.getByRole('tab', { name: 'Additional Info' })).toBeVisible()
  })

  test('Additional Info tab is wired to a panel', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('INFO-TABS')
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Info Tabs Item')

    const addlInfoTab = page.getByRole('tab', { name: 'Additional Info' })
    await expect(addlInfoTab).toHaveAttribute('aria-controls', /additional-info/)
  })

  test('Additional SKUs tab is wired to a panel', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    const skusTab = page.getByRole('tab', { name: 'Additional SKUs' })
    await expect(skusTab).toHaveAttribute('aria-controls', /additional-skus/)
  })

  test('display_name field appears in General Info and saves correctly', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    const sku = `DN-${Date.now()}`

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    // Display Name should be visible in the General Info section
    await expect(page.getByLabel('Display Name')).toBeVisible()

    // Fill required fields
    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill(sku)
    await page
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill('Very Long Product Name That Is Hard To Read')
    await page.getByLabel('Display Name').fill('Short Name')
    const itemsPanel = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel.getByLabel('Item Type').selectOption({ label: 'Wine' })
    await page.getByLabel('Per Bottle Cost').fill('10.00')
    await page.getByLabel('Price Charged').fill('19.99')
    await page.getByLabel('In Stock').fill('5')

    const taxSel = itemsPanel.getByLabel('Tax Codes')
    const taxOpts = await taxSel.locator('option').allTextContents()
    const rate13 = taxOpts.find((t) => t.includes('13'))
    if (rate13) await taxSel.selectOption({ label: rate13 })

    // Save
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Item saved')).toBeVisible()

    // Search for it and verify display_name loaded back
    await page.getByLabel('Search Inventory').fill(sku)
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue(sku)
    await expect(page.getByLabel('Display Name')).toHaveValue('Short Name')
  })

  test('supports keyboard selection from the inventory footer search dropdown', async ({
    page
  }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    const searchInput = page.getByRole('combobox', { name: 'Search Inventory' })
    await searchInput.fill('SKU')
    await expect(page.getByRole('option', { name: /Inventory Item/ })).toBeVisible()

    await searchInput.press('ArrowDown')
    await searchInput.press('ArrowDown')
    await searchInput.press('Enter')

    await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue('SKU-002')
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Second Item'
    )
  })

  test('positions footer search results above the search input', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    const searchInput = page.getByRole('combobox', { name: 'Search Inventory' })
    await searchInput.fill('SKU')

    const listbox = page.getByRole('listbox', { name: 'Search results' })
    await expect(listbox).toBeVisible()

    const inputBox = await searchInput.boundingBox()
    const listboxBox = await listbox.boundingBox()

    expect(inputBox).not.toBeNull()
    expect(listboxBox).not.toBeNull()
    expect((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0)).toBeLessThanOrEqual(
      (inputBox?.y ?? 0) + 1
    )
  })
})
