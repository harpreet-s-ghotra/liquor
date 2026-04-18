import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachSearchApiMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const products = [
      {
        id: 1,
        sku: 'WINE-001',
        name: 'Cabernet Sauvignon 750ml',
        category: 'Wine',
        price: 19.99,
        quantity: 24,
        tax_rate: 0.13,
        size: '750ml',
        distributor_name: 'Premium Wines Inc',
        bottles_per_case: 12,
        case_discount_price: null,
        display_name: null
      },
      {
        id: 2,
        sku: 'BEER-001',
        name: 'Craft IPA 6-Pack',
        category: 'Beer',
        price: 13.49,
        quantity: 40,
        tax_rate: 0.13,
        size: null,
        distributor_name: null,
        bottles_per_case: null,
        case_discount_price: null,
        display_name: null
      },
      {
        id: 3,
        sku: 'SPIRIT-001',
        name: 'Premium Vodka 1L',
        category: 'Spirits',
        price: 32.99,
        quantity: 18,
        tax_rate: 0.13,
        size: '1L',
        distributor_name: 'ABC Distributors',
        bottles_per_case: 6,
        case_discount_price: null,
        display_name: null
      }
    ]

    const itemTypes = [
      {
        id: 1,
        name: 'Wine',
        description: null,
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      },
      {
        id: 2,
        name: 'Beer',
        description: null,
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      },
      {
        id: 3,
        name: 'Spirits',
        description: null,
        default_profit_margin: 0.4,
        default_tax_rate: 0.08
      }
    ]

    const distributors = [
      {
        distributor_number: 1,
        distributor_name: 'Premium Wines Inc',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1
      },
      {
        distributor_number: 2,
        distributor_name: 'ABC Distributors',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1
      }
    ]

    const merchantConfig = {
      id: 1,
      finix_api_username: 'US-test-api-key',
      finix_api_password: 'test-finix-password',
      merchant_id: 'MU-test-merchant-id',
      merchant_name: 'Test Liquor Store',
      activated_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    }

    const testCashier = {
      id: 1,
      name: 'Test Cashier',
      role: 'admin',
      is_active: 1,
      created_at: '2025-01-01T00:00:00.000Z'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getMerchantConfig: async () => merchantConfig,
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: merchantConfig
      }),
      onDeepLink: () => {},
      consumePendingDeepLink: async () => null,
      getCashiers: async () => [testCashier],
      validatePin: async () => testCashier,

      getProducts: async () => [...products],
      getActiveSpecialPricing: async () => [],

      getItemTypes: async () => [...itemTypes],
      getDistributors: async () => [...distributors],

      searchProducts: async (
        query: string,
        filters?: { departmentId?: number; distributorNumber?: number }
      ) => {
        const q = query.trim().toLowerCase()
        return products.filter((p) => {
          const textMatch =
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            (p.category ?? '').toLowerCase().includes(q)

          // Item type filter (departmentId maps to category by convention)
          if (filters?.departmentId) {
            const itemType = itemTypes.find((it) => it.id === filters.departmentId)
            if (itemType && p.category !== itemType.name) return false
          }

          // Distributor filter
          if (filters?.distributorNumber) {
            const dist = distributors.find(
              (d) => d.distributor_number === filters.distributorNumber
            )
            if (dist && p.distributor_name !== dist.distributor_name) return false
          }

          return textMatch
        })
      },

      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented')
      },
      finixChargeCard: async (input: { total: number; card_number?: string }) => ({
        authorization_id: `AU-${Date.now()}`,
        transfer_id: `TR-${Date.now()}`,
        success: true,
        last_four: input.card_number?.slice(-4) ?? '4242',
        card_type: input.card_number === '5555555555554444' ? 'mastercard' : 'visa',
        total: input.total,
        message: 'Approved',
        status: 'approved'
      }),
      saveTransaction: async () => ({ id: 1 }),
      getRecentTransactions: async () => [],
      getReceiptConfig: async () => ({
        fontSize: 10,
        paddingY: 4,
        paddingX: 4,
        storeName: '',
        footerMessage: '',
        alwaysPrint: false
      }),
      printReceipt: async () => {}
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

test.describe('Search Modal', () => {
  test.beforeEach(async ({ page }) => {
    await attachSearchApiMock(page)
    await page.goto('/')
    await loginWithPin(page)
  })

  test('search results show size and distributor columns', async ({ page }) => {
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('dialog', { name: 'Product Search' })).toBeVisible()

    // Search for a broad term
    await page.getByPlaceholder('Search items...').fill('wine')
    await page.getByRole('button', { name: 'Go' }).click()

    // Cabernet has size '750ml' and distributor 'Premium Wines Inc'
    const resultRow = page.getByTestId('search-result-1')
    await expect(resultRow).toBeVisible()
    await expect(resultRow.locator('.search-modal__result-size')).toHaveText('750ml')
    await expect(resultRow.locator('.search-modal__result-distributor')).toHaveText(
      'Premium Wines Inc'
    )
  })

  test('search results show dash for null size and distributor', async ({ page }) => {
    await page.getByRole('button', { name: 'Search' }).click()

    // Search for beer — has null size and null distributor
    await page.getByPlaceholder('Search items...').fill('IPA')
    await page.getByRole('button', { name: 'Go' }).click()

    const resultRow = page.getByTestId('search-result-2')
    await expect(resultRow).toBeVisible()
    // Null size/distributor should show dash
    await expect(resultRow.locator('.search-modal__result-size')).toHaveText('\u2014')
    await expect(resultRow.locator('.search-modal__result-distributor')).toHaveText('\u2014')
  })

  test('filters search results by item type', async ({ page }) => {
    await page.getByRole('button', { name: 'Search' }).click()

    // Select "Spirits" from the item type dropdown
    await page.getByLabel('Filter by item type').selectOption({ label: 'Spirits' })

    // Search broadly
    await page.getByPlaceholder('Search items...').fill('premium')
    await page.getByRole('button', { name: 'Go' }).click()

    // Only Premium Vodka (Spirits) should appear, not Premium Wines Inc wine
    await expect(page.getByTestId('search-result-3')).toBeVisible()
    await expect(page.getByTestId('search-result-1')).toHaveCount(0)
  })

  test('filters search results by distributor', async ({ page }) => {
    await page.getByRole('button', { name: 'Search' }).click()

    // Select "ABC Distributors" from the distributor dropdown
    await page.getByLabel('Filter by distributor').selectOption({ label: 'ABC Distributors' })

    // Search broadly
    await page.getByPlaceholder('Search items...').fill('premium')
    await page.getByRole('button', { name: 'Go' }).click()

    // Only Premium Vodka (from ABC Distributors) should appear
    await expect(page.getByTestId('search-result-3')).toBeVisible()
    await expect(page.getByTestId('search-result-1')).toHaveCount(0)
  })
})
