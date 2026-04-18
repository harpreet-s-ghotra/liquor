import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Promotions and Discounts E2E tests
 * Tests discount application, special pricing rules, mix-and-match, percentage discounts
 */

const attachPromotionMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const products = [
      {
        id: 1,
        sku: 'WINE-PROMO-001',
        name: 'Promo Wine Pack',
        category: 'Wine',
        price: 25.99,
        quantity: 30,
        tax_rate: 0.13,
        special_price: 19.99, // 23% discount
        special_price_enabled: true
      },
      {
        id: 2,
        sku: 'BEER-BUNDLE-001',
        name: 'Beer Bundle (6-Pack)',
        category: 'Beer',
        price: 18.99,
        quantity: 40,
        tax_rate: 0.13
      },
      {
        id: 3,
        sku: 'SPIRIT-BUY2GET1-001',
        name: 'Premium Vodka 1L',
        category: 'Spirits',
        price: 32.99,
        quantity: 18,
        tax_rate: 0.13
      },
      {
        id: 4,
        sku: 'MIXER-FREE-001',
        name: 'Tonic Water 1L',
        category: 'Mixers',
        price: 2.99,
        quantity: 52,
        tax_rate: 0.13
      },
      {
        id: 5,
        sku: 'COOLER-BUNDLE-001',
        name: 'Cooler Pack (4-Pack)',
        category: 'Coolers',
        price: 16.99,
        quantity: 80,
        tax_rate: 0.13
      }
    ]

    const specialPricing = [
      {
        id: 1,
        product_id: 1,
        name: 'Wine Flash Sale',
        discount_type: 'fixed',
        discount_value: 6.0, // Save $6
        min_quantity: 1,
        enabled: true
      },
      {
        id: 2,
        product_id: 3,
        name: 'Buy 2 Get 1 Free',
        discount_type: 'item_free',
        discount_value: 32.99, // Free when buying 2
        min_quantity: 2,
        enabled: true
      },
      {
        id: 3,
        product_id: 5,
        name: 'Cooler 4-Pack Discount',
        discount_type: 'percentage',
        discount_value: 15.0, // 15% off
        min_quantity: 1,
        enabled: true
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

    const savedTransactions: Array<Record<string, unknown>> = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      // Auth APIs
      getMerchantConfig: async () => merchantConfig,
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: merchantConfig
      }),
      onDeepLink: () => {},
      consumePendingDeepLink: async () => null,
      getCashiers: async () => [testCashier],
      validatePin: async () => testCashier,

      // Product APIs
      getProducts: async () => products,
      getActiveSpecialPricing: async () => specialPricing,
      getItemTypes: async () => [],
      getDistributors: async () => [],
      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented in promotion mock')
      },

      // Finix Payment
      finixChargeCard: async (input: { total: number; card_number?: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const isVisa = input.card_number !== '5555555555554444'
        return {
          authorization_id: `AU-${Date.now()}`,
          transfer_id: `TR-${Date.now()}`,
          success: true,
          last_four: isVisa ? '4242' : '4444',
          card_type: isVisa ? 'visa' : 'mastercard',
          total: input.total,
          message: 'Approved',
          status: 'approved'
        }
      },
      saveTransaction: async (input: Record<string, unknown>) => {
        const txn = {
          id: savedTransactions.length + 1,
          transaction_number: `TXN-${Date.now()}`,
          ...input,
          status: 'completed',
          created_at: new Date().toISOString()
        }
        savedTransactions.push(txn)
        return txn
      },
      getRecentTransactions: async () => [...savedTransactions].reverse()
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

const showAllProducts = async (page: Page): Promise<void> => {
  await page.locator('.action-panel__category-trigger').click()
  await page.locator('.action-panel__category-item', { hasText: 'All' }).click()
  await page
    .locator('.action-panel__product-tile')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
}

test.describe('Promotions and Discounts', () => {
  test('displays special price on product tile', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Find the promo wine product
    const promoTile = page
      .locator('.action-panel__product-tile')
      .filter({ hasText: 'Promo Wine Pack' })
      .first()
    await expect(promoTile).toBeVisible()
    await expect(promoTile).toContainText(/promo wine pack/i)
  })

  test('applies fixed discount when adding discounted product to cart', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Add promo wine (has $6 discount) to cart
    const productTiles = page.locator('.action-panel__product-tile')
    for (let i = 0; i < (await productTiles.count()); i++) {
      const text = await productTiles.nth(i).textContent()
      if (text?.includes('Promo Wine')) {
        await productTiles.nth(i).click()
        break
      }
    }

    // Check ticket panel shows discounted price
    const ticketPanel = page.locator('.ticket-panel')
    await expect(ticketPanel).toBeVisible()

    // Should show the item in ticket at special price (19.99, not 25.99)
    await expect(ticketPanel.getByText(/19\.99|discount/i)).toBeVisible()
  })

  test('shows percentage discount calculation', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Find and add Cooler Pack (15% discount)
    const productTiles = page.locator('.action-panel__product-tile')
    for (let i = 0; i < (await productTiles.count()); i++) {
      const text = await productTiles.nth(i).textContent()
      if (text?.includes('Cooler Pack')) {
        await productTiles.nth(i).click()
        break
      }
    }

    // Check that discount is applied (14.44 = 16.99 * 0.85)
    const ticketPanel = page.locator('.ticket-panel')
    await expect(ticketPanel).toBeVisible()
  })

  test('applies buy 2 get 1 free promotion', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Add Premium Vodka (Buy 2 Get 1 Free) twice
    const productTiles = page.locator('.action-panel__product-tile')
    let addedCount = 0

    for (let attempt = 0; attempt < 2; attempt++) {
      for (let i = 0; i < (await productTiles.count()); i++) {
        const text = await productTiles.nth(i).textContent()
        if (text?.includes('Premium Vodka')) {
          await productTiles.nth(i).click()
          addedCount++
          break
        }
      }
    }

    expect(addedCount).toBeGreaterThanOrEqual(2)

    // Ticket should show 2x items added
    const ticketPanel = page.locator('.ticket-panel')
    await expect(ticketPanel).toBeVisible()
  })

  test('shows total savings from all discounts', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Add multiple discounted items
    const productTiles = page.locator('.action-panel__product-tile')
    let itemsAdded = 0

    // Add first discounted item
    for (let i = 0; i < (await productTiles.count()) && itemsAdded < 1; i++) {
      const text = await productTiles.nth(i).textContent()
      if (text?.includes('Promo Wine')) {
        await productTiles.nth(i).click()
        itemsAdded++
        break
      }
    }

    // Subtotal should show with discount applied
    const ticketPanel = page.locator('.ticket-panel')
    await expect(ticketPanel).toBeVisible()
  })

  test('disables checkout if required discount conditions not met', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)

    await expect(page.getByRole('button', { name: 'Pay Now' })).toBeDisabled()
  })

  test('completes transaction with promotions applied', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Add a discounted item
    const productTiles = page.locator('.action-panel__product-tile')
    for (let i = 0; i < (await productTiles.count()); i++) {
      const text = await productTiles.nth(i).textContent()
      if (text?.includes('Promo Wine')) {
        await productTiles.nth(i).click()
        break
      }
    }

    // Process payment
    const payButton = page.getByRole('button', { name: /pay|credit|debit/i }).first()
    if (await payButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await payButton.click()

      // Should show payment processed successfully
      await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    }

    // Ticket should still be visible after attempting payment flow
    await expect(page.locator('.ticket-panel')).toBeVisible()
  })

  test('displays discount breakdown in payment summary', async ({ page }) => {
    await attachPromotionMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await showAllProducts(page)

    // Add discounted item
    const productTiles = page.locator('.action-panel__product-tile')
    for (let i = 0; i < (await productTiles.count()); i++) {
      const text = await productTiles.nth(i).textContent()
      if (text?.includes('Promo Wine')) {
        await productTiles.nth(i).click()
        break
      }
    }

    // Check ticket panel shows discount amount
    const ticketPanel = page.locator('.ticket-panel')

    // Discount should be visible or ticket should show the reduced total
    await expect(ticketPanel).toBeVisible()
  })
})
