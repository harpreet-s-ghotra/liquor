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
        vendor_number: null,
        vendor_name: null,
        bottles_per_case: 12,
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
            vendor_number: item.vendor_number,
            vendor_name: item.vendor_name,
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
      getVendors: async () => [],
      getActiveSpecialPricing: async () => [],
      saveInventoryItem: async (payload) => {
        const nextId =
          payload.item_number ??
          inventoryStore.reduce((max, current) => Math.max(max, current.item_number), 0) + 1
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
          vendor_number: null,
          vendor_name: null,
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
  await page.locator('.product-pad-btn').first().waitFor({ state: 'visible', timeout: 10000 })
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

    await page.getByLabel('Cost').fill('9.99')
    await page.getByLabel('Price Charged').fill('15.99')
    await page.getByLabel('In Stock').fill('8')

    // Tax code dropdown (scoped inside Items tabpanel)
    const taxSel = itemsPanel.getByLabel('Tax Codes')
    const taxOpts = await taxSel.locator('option').allTextContents()
    const rate13 = taxOpts.find((t) => t.includes('13'))
    if (rate13) await taxSel.selectOption({ label: rate13 })

    // Navigate to Additional SKUs tab (default is now Case & Quantity)
    await page.getByRole('tab', { name: 'Additional SKUs' }).focus()
    await page.getByLabel('Additional SKU Input').fill(`${sku}-ALT-1`)
    await page.getByRole('button', { name: 'Add Additional SKU' }).click()

    // Switch to Special Pricing tab and add a rule
    await page.getByRole('tab', { name: 'Special Pricing' }).focus()
    await page.getByRole('button', { name: 'Add Rule' }).click()
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
})
