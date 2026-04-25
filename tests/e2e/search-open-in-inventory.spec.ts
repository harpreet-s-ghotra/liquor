import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachApiMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const products = [
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

    const inventoryItems = [
      {
        item_number: 1,
        sku: 'WINE-001',
        item_name: 'Cabernet Sauvignon 750ml',
        category_id: null,
        category_name: 'Wine',
        cost: 12.0,
        retail_price: 19.99,
        in_stock: 24,
        tax_1: 0.13,
        tax_2: 0,
        distributor_number: null,
        distributor_name: null,
        bottles_per_case: 12,
        case_discount_price: null,
        size: '355ML',
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
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

      getProducts: async () => [...products],

      searchProducts: async (query: string) => {
        const q = query.trim().toLowerCase()
        return products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        )
      },

      searchInventoryProducts: async (query: string) => {
        const q = query.trim().toLowerCase()
        return inventoryItems
          .filter(
            (it) => it.sku.toLowerCase().includes(q) || it.item_name.toLowerCase().includes(q)
          )
          .map(({ additional_skus: _a, special_pricing: _sp, sales_history: _sh, ...rest }) => rest)
      },

      getInventoryProductDetail: async (itemNumber: number) =>
        inventoryItems.find((it) => it.item_number === itemNumber) ?? null,

      getDepartments: async () => [],
      getInventoryDepartments: async () => [],
      getItemTypes: async () => [],
      getInventoryTaxCodes: async () => [],
      getTaxCodes: async () => [],
      getDistributors: async () => [],
      listSizesInUse: async () => ['355ML', '750ML'],
      getActiveSpecialPricing: async () => [],
      saveInventoryItem: async () => inventoryItems[0],
      deleteInventoryItem: async () => {},
      saveTransaction: async () => ({ id: 1 })
    }
  })
}

const loginWithPin = async (page: Page): Promise<void> => {
  const pinKey = page.locator('.pin-key').first()
  await pinKey.waitFor({ state: 'visible', timeout: 10000 })
  for (const digit of ['1', '2', '3', '4']) {
    await page.locator(`.pin-key:text("${digit}")`).click()
  }
  await page.locator('.ticket-panel').waitFor({ state: 'visible', timeout: 10000 })
}

test.describe('Search modal — Open in Inventory', () => {
  test('opens the inventory modal with the correct item loaded', async ({ page }) => {
    await attachApiMock(page)
    await page.goto('/')
    await loginWithPin(page)

    // Open the search modal via the Search button
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible()
    await expect(page.getByText('Product Search')).toBeVisible()

    // Search for an item
    await page.getByPlaceholder('Search items...').fill('Cabernet')
    await page.getByRole('button', { name: 'Go' }).click()

    // Select the result
    await expect(page.getByTestId('search-result-1')).toBeVisible()
    await page.getByTestId('search-result-1').click()

    // Click "Open in Inventory"
    await page.getByRole('button', { name: 'Open in Inventory' }).click()

    // The search modal should close and the inventory modal should open
    await expect(page.getByRole('dialog', { name: 'Search' })).not.toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Inventory Management' })).toBeVisible()

    // The item's SKU and name should be loaded in the form
    await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue('WINE-001')
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Cabernet Sauvignon 750ml'
    )
    await expect(page.getByRole('combobox', { name: 'Size', exact: true })).toHaveValue('355ML')

    // The header breadcrumb should reflect the selected item
    await expect(page.getByText('Edit Record: WINE-001')).toBeVisible()
  })
})
