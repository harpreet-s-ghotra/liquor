import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Inventory Modal Improvements — E2E coverage for:
 *   • the draggable resize handle between General Info and inner tabs
 *   • special-pricing rules without the removed `duration_days` field
 */

const attachMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    type StoredRule = { quantity: number; price: number }

    const product: Record<string, unknown> = {
      item_number: 1,
      sku: 'SKU-PROMO',
      item_name: 'Promo Bottle',
      category_id: null,
      category_name: null,
      cost: 8,
      retail_price: 15,
      in_stock: 50,
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
      item_type: 'Wine',
      size: '750ml',
      case_cost: null,
      brand_name: null,
      proof: null,
      alcohol_pct: null,
      vintage: null,
      ttb_id: null,
      display_name: null,
      additional_skus: [] as string[],
      special_pricing: [
        { quantity: 2, price: 25 },
        { quantity: 6, price: 70 }
      ] as StoredRule[],
      tax_rates: [0.13],
      sales_history: []
    }

    const lastSavePayload: { value: Record<string, unknown> | null } = { value: null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__lastInventorySave = lastSavePayload

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getMerchantConfig: async () => ({
        id: 1,
        finix_api_username: 'US-test',
        finix_api_password: 'test',
        merchant_id: 'MU-test',
        merchant_name: 'Test Store',
        activated_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }),
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: {
          id: 1,
          finix_api_username: 'US-test',
          finix_api_password: 'test',
          merchant_id: 'MU-test',
          merchant_name: 'Test Store',
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
      getProducts: async () => [
        {
          id: 1,
          sku: 'SKU-PROMO',
          name: 'Promo Bottle',
          category: 'Wine',
          price: 15,
          quantity: 50,
          tax_rate: 0.13
        }
      ],
      searchInventoryProducts: async () => [product],
      getInventoryProductDetail: async () => product,
      getInventoryTaxCodes: async () => [
        { code: 'RATE_0', rate: 0 },
        { code: 'RATE_0_13', rate: 0.13 }
      ],
      getItemTypes: async () => [
        {
          id: 1,
          name: 'Wine',
          description: null,
          default_profit_margin: 0.35,
          default_tax_rate: 0.13
        }
      ],
      getTaxCodes: async () => [],
      getDistributors: async () => [],
      getActiveSpecialPricing: async () => [
        { product_id: 1, quantity: 2, price: 25 },
        { product_id: 1, quantity: 6, price: 70 }
      ],
      saveInventoryItem: async (payload: Record<string, unknown>) => {
        lastSavePayload.value = payload
        product.special_pricing = (payload.special_pricing as StoredRule[]) ?? []
        return product
      }
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

const openInventoryAndLoad = async (page: Page): Promise<void> => {
  await page.goto('/')
  await loginWithPin(page)
  await page.getByRole('button', { name: 'F2 Inventory' }).click()
  await expect(page.getByRole('dialog', { name: 'Inventory Management' })).toBeVisible()
  // Load the fixture product so the full form renders.
  await page.getByLabel('Search Inventory').fill('SKU-PROMO')
  await page.getByRole('button', { name: 'Search' }).click()
  const resultsList = page.getByRole('listbox', { name: 'Search results' })
  await resultsList.getByRole('option').first().click()
  await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue('SKU-PROMO')
}

const getSectionHeight = async (page: Page): Promise<number> => {
  return page.locator('.item-form__section').evaluate((el) => (el as HTMLElement).offsetHeight)
}

test.describe('Inventory Modal — Resizable Split', () => {
  test.beforeEach(async ({ page }) => {
    await attachMock(page)
  })

  test('renders the resize handle as a horizontal separator', async ({ page }) => {
    await openInventoryAndLoad(page)
    const handle = page.getByTestId('item-form-resize-handle')
    await expect(handle).toBeVisible()
    await expect(handle).toHaveAttribute('role', 'separator')
    await expect(handle).toHaveAttribute('aria-orientation', 'horizontal')
  })

  test('keyboard ArrowUp shrinks, then ArrowDown grows the top section', async ({ page }) => {
    await openInventoryAndLoad(page)
    const handle = page.getByTestId('item-form-resize-handle')
    await handle.focus()

    // Shrink first — clamp at top may hide initial growth margin.
    await handle.press('ArrowUp')
    await handle.press('ArrowUp')
    await handle.press('ArrowUp')
    const afterUp = await getSectionHeight(page)

    await handle.press('ArrowDown')
    await handle.press('ArrowDown')
    const afterDown = await getSectionHeight(page)
    expect(afterDown).toBeGreaterThan(afterUp)
  })

  test('persists the height to localStorage and restores it after reload', async ({ page }) => {
    await openInventoryAndLoad(page)
    const handle = page.getByTestId('item-form-resize-handle')
    await handle.focus()
    await handle.press('ArrowUp')
    await handle.press('ArrowUp')

    const stored = await page.evaluate(() =>
      window.localStorage.getItem('inventory-form-top-height')
    )
    expect(stored).not.toBeNull()
    const storedHeight = Number(stored)

    await page.reload()
    await loginWithPin(page)
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await page.getByLabel('Search Inventory').fill('SKU-PROMO')
    await page.getByRole('button', { name: 'Search' }).click()
    const resultsList = page.getByRole('listbox', { name: 'Search results' })
    await resultsList.getByRole('option').first().click()
    await expect(page.getByRole('textbox', { name: 'SKU', exact: true })).toHaveValue('SKU-PROMO')

    const stillStored = await page.evaluate(() =>
      window.localStorage.getItem('inventory-form-top-height')
    )
    expect(Number(stillStored)).toBe(storedHeight)

    const section = page.locator('.item-form__section')
    await expect(section).toHaveAttribute('style', new RegExp(`height:\\s*${storedHeight}px`))
  })

  test('double-click on the handle clears the persisted override', async ({ page }) => {
    await openInventoryAndLoad(page)
    const handle = page.getByTestId('item-form-resize-handle')
    await handle.focus()
    await handle.press('ArrowUp')
    await handle.press('ArrowUp')
    const storedBefore = await page.evaluate(() =>
      window.localStorage.getItem('inventory-form-top-height')
    )
    expect(storedBefore).not.toBeNull()

    await handle.dblclick()

    const storedAfter = await page.evaluate(() =>
      window.localStorage.getItem('inventory-form-top-height')
    )
    expect(storedAfter).toBeNull()

    const section = page.locator('.item-form__section')
    // After reset the inline height tracks the default (clamped to container).
    await expect(section).toHaveAttribute('style', /height:\s*\d+px/)
  })
})

test.describe('Inventory Modal — Special Pricing without Duration', () => {
  test.beforeEach(async ({ page }) => {
    await attachMock(page)
  })

  test('special pricing table has no Duration column', async ({ page }) => {
    await openInventoryAndLoad(page)
    await page.getByRole('tab', { name: 'Special Pricing' }).click()

    const table = page.getByRole('table', { name: 'Special Pricing Rules' })
    await expect(table).toBeVisible()
    const headers = await table.locator('thead th').allTextContents()
    expect(headers.map((h) => h.trim())).toEqual(['Quantity', 'Price', ''])
    await expect(page.getByLabel('Rule 1 Duration')).toHaveCount(0)
  })

  test('adds a new rule and saves without a duration field', async ({ page }) => {
    await openInventoryAndLoad(page)
    await page.getByRole('tab', { name: 'Special Pricing' }).click()

    await page.getByRole('button', { name: 'Add Rule' }).click()
    const lastRuleIndex = await page
      .getByRole('table', { name: 'Special Pricing Rules' })
      .locator('tbody tr')
      .count()
    await page.getByLabel(`Rule ${lastRuleIndex} Quantity`).fill('12')
    await page.getByLabel(`Rule ${lastRuleIndex} Price`).fill('12000')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Item saved')).toBeVisible()

    const payload = await page.evaluate(
      () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__lastInventorySave.value as { special_pricing: unknown[] } | null
    )
    expect(payload).not.toBeNull()
    for (const rule of payload!.special_pricing as Record<string, unknown>[]) {
      expect(Object.keys(rule).sort()).toEqual(['price', 'quantity'])
    }
    expect(payload!.special_pricing).toContainEqual({ quantity: 12, price: 120 })
  })
})
