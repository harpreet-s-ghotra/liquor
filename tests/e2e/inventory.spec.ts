import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachInventoryApiMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const inventoryStore = [
      {
        item_number: 1,
        sku: 'SKU-001',
        item_name: 'Inventory Item',
        dept_id: '11',
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
        dept_id: '11',
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
        stax_api_key: 'test-api-key',
        merchant_id: 'test-merchant-id',
        merchant_name: 'Test Liquor Store',
        activated_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }),
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
            dept_id: item.dept_id,
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
      getInventoryDepartments: async () => ['11', '02'],
      getInventoryTaxCodes: async () => [
        { code: 'RATE_0', rate: 0 },
        { code: 'RATE_0_13', rate: 0.13 }
      ],
      getDepartments: async () => [
        { id: 11, name: 'Dept 11' },
        { id: 2, name: 'Dept 02' }
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
          dept_id: payload.dept_id,
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
          bottles_per_case: 12,
          barcode: null,
          description: null,
          special_pricing_enabled: payload.special_pricing.length > 0 ? 1 : 0,
          special_price:
            payload.special_pricing.length > 0 ? payload.special_pricing[0].price : null,
          is_active: 1,
          additional_skus: payload.additional_skus,
          special_pricing: payload.special_pricing ?? [],
          sales_history: []
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
  await page
    .locator('.action-panel__product-tile')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
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
    await page.getByLabel('Name').fill(name)
    // Department dropdown (standard select)
    // Scope inside Items tabpanel to avoid matching Radix tab panels
    const itemsPanel = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel.getByLabel('Department').selectOption({ label: 'Dept 11' })

    await page.getByLabel('Per Bottle Cost').fill('9.99')
    await page.getByLabel('Price Charged').fill('15.99')
    await page.getByLabel('In Stock').fill('8')

    // Tax code dropdown (scoped inside Items tabpanel)
    const taxSel = itemsPanel.getByLabel('Tax Codes')
    const taxOpts = await taxSel.locator('option').allTextContents()
    const rate13 = taxOpts.find((t) => t.includes('13'))
    if (rate13) await taxSel.selectOption({ label: rate13 })

    // Navigate to Additional SKUs tab (default is now Case & Quantity)
    const skusTab = page.getByRole('tab', { name: 'Additional SKUs' })
    await skusTab.focus()
    await expect(skusTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
    await page.getByLabel('Additional SKU Input').fill(`${sku}-ALT-1`)
    await page.getByRole('button', { name: 'Add Additional SKU' }).evaluate((el) => (el as HTMLElement).click())

    // Switch to Special Pricing tab and add a rule
    const pricingTab = page.getByRole('tab', { name: 'Special Pricing' })
    await pricingTab.focus()
    await expect(pricingTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
    await page.getByRole('button', { name: 'Add Rule' }).evaluate((el) => (el as HTMLElement).click())
    await page.getByLabel('Rule 1 Quantity').fill('2')
    await page.getByLabel('Rule 1 Price').fill('1399')
    await page.getByLabel('Rule 1 Duration').fill('20')

    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Item saved')).toBeVisible()

    // Search for the saved item — it auto-loads into form
    await page.getByLabel('Search Inventory').fill(sku)
    await page.getByRole('button', { name: 'Search' }).click()

    // Verify the item was loaded into the form
    await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue(sku)
  })

  test('rejects additional SKU that duplicates another product primary SKU', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    // Fill required fields for a new item
    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('SKU-NEW')
    await page.getByLabel('Name').fill('New Item')
    const itemsPanel = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel.getByLabel('Department').selectOption({ label: 'Dept 11' })
    await page.getByLabel('Per Bottle Cost').fill('5.00')
    await page.getByLabel('Price Charged').fill('10.00')
    await page.getByLabel('In Stock').fill('5')

    // Add an additional SKU that matches an existing product's primary SKU
    const skusTab2 = page.getByRole('tab', { name: 'Additional SKUs' })
    await skusTab2.focus()
    await expect(skusTab2).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
    await page.getByLabel('Additional SKU Input').fill('SKU-001')
    await page.getByRole('button', { name: 'Add Additional SKU' }).evaluate((el) => (el as HTMLElement).click())

    await page.getByRole('button', { name: 'Save' }).click()

    // Should show an error about the duplicate SKU
    await expect(
      page.getByText('Additional SKU "SKU-001" is already the primary SKU of "Inventory Item"')
    ).toBeVisible()
  })

  test('rejects additional SKU that duplicates another product alt SKU', async ({ page }) => {
    await attachInventoryApiMock(page)
    await gotoAndLogin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()

    // Fill required fields for a new item
    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill('SKU-NEW-2')
    await page.getByLabel('Name').fill('Another New Item')
    const itemsPanel = page.getByRole('tabpanel', { name: 'Items' })
    await itemsPanel.getByLabel('Department').selectOption({ label: 'Dept 11' })
    await page.getByLabel('Per Bottle Cost').fill('6.00')
    await page.getByLabel('Price Charged').fill('11.00')
    await page.getByLabel('In Stock').fill('3')

    // Add an additional SKU that matches another product's alt SKU
    const skusTab3 = page.getByRole('tab', { name: 'Additional SKUs' })
    await skusTab3.focus()
    await expect(skusTab3).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
    await page.getByLabel('Additional SKU Input').fill('SKU-001-ALT')
    await page.getByRole('button', { name: 'Add Additional SKU' }).evaluate((el) => (el as HTMLElement).click())

    await page.getByRole('button', { name: 'Save' }).click()

    // Should show an error about the duplicate alt SKU
    await expect(
      page.getByText('Additional SKU "SKU-001-ALT" is already used by "Inventory Item"')
    ).toBeVisible()
  })
})
