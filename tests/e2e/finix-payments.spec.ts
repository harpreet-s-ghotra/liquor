import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Finix Phase A payment E2E tests.
 *
 * Credit/debit actions use the Finix sandbox card flow exposed through
 * `window.api.finixChargeCard`. In dev/E2E there is no manual card form in the
 * UI because the payment modal uses preset sandbox cards.
 */

const attachFinixMock = async (
  page: Page,
  options?: { decline?: boolean; timeout?: boolean; latencyMs?: number }
): Promise<void> => {
  const decline = options?.decline ?? false
  const timeoutMode = options?.timeout ?? false
  const latencyMs = options?.latencyMs ?? 300

  await page.addInitScript(
    ({ decline: doDecline, timeout: doTimeout, latencyMs: lat }) => {
      const products = [
        {
          id: 1,
          sku: 'WINE-001',
          name: 'Cabernet Sauvignon 750ml',
          category: 'Wine',
          price: 19.99,
          quantity: 24,
          tax_rate: 0.13
        },
        {
          id: 2,
          sku: 'BEER-001',
          name: 'Craft IPA 6-Pack',
          category: 'Beer',
          price: 13.49,
          quantity: 40,
          tax_rate: 0.13
        },
        {
          id: 3,
          sku: 'SPIRIT-001',
          name: 'Premium Vodka 1L',
          category: 'Spirits',
          price: 32.99,
          quantity: 18,
          tax_rate: 0.13
        }
      ]

      const savedTransactions: Array<Record<string, unknown>> = []

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
        hasAnyProduct: async () => true,
        getProducts: async () => products,
        getActiveSpecialPricing: async () => [],
        getItemTypes: async () => [],
        getDistributors: async () => [],
        getTaxCodes: async () => [],
        getInventoryTaxCodes: async () => [],
        searchInventoryProducts: async () => [],
        getInventoryProductDetail: async () => null,
        saveInventoryItem: async () => {
          throw new Error('Not implemented in Finix payment mock')
        },
        finixChargeCard: async (input: { total: number; card_number?: string }) => {
          await new Promise((resolve) => setTimeout(resolve, lat))

          if (doTimeout) {
            return {
              authorization_id: 'AU-timeout',
              transfer_id: 'TR-timeout',
              success: false,
              last_four: '',
              card_type: 'unknown',
              total: input.total,
              message: 'No response from the card reader',
              status: 'timeout'
            }
          }

          if (doDecline) {
            return {
              authorization_id: '',
              transfer_id: '',
              success: false,
              last_four: '',
              card_type: 'unknown',
              total: input.total,
              message: 'Card declined',
              status: 'declined'
            }
          }

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
    },
    { decline, timeout: timeoutMode, latencyMs }
  )
}

const addProductToCart = async (page: Page): Promise<void> => {
  await page.locator('.action-panel__category-trigger').click()
  await page.locator('.action-panel__category-item', { hasText: 'All' }).click()
  await expect(page.locator('.action-panel__product-tile').first()).toBeVisible()
  const firstProduct = page.locator('.action-panel__product-tile').first()
  await firstProduct.click()
}

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

test.describe('Finix Card Payments', () => {
  test('Credit payment processes successfully', async ({ page }) => {
    await attachFinixMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    await expect(page.getByTestId('payment-processing')).toBeVisible()
    await expect(page.getByTestId('payment-processing')).toContainText('Processing payment...')

    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('4242')

    await page.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })

  test('Debit payment processes successfully', async ({ page }) => {
    await attachFinixMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Debit' }).click()

    await expect(page.getByTestId('payment-processing')).toBeVisible()
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('Debit')
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('4242')

    await page.getByTestId('payment-ok-btn').click()
  })

  test('Decline shows error', async ({ page }) => {
    await attachFinixMock(page, { decline: true })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    await expect(page.getByTestId('card-error')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('card-error')).toContainText('Card declined')
    await expect(page.getByTestId('payment-complete')).toHaveCount(0)
  })

  test('Timeout shows error', async ({ page }) => {
    await attachFinixMock(page, { timeout: true })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    await expect(page.getByTestId('card-error')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('card-error')).toContainText('No response from the card reader')
  })

  test('Dismiss clears error and allows retry', async ({ page }) => {
    await attachFinixMock(page, { decline: true })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('card-error')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('card-retry-btn').click()
    await expect(page.getByTestId('card-error')).toHaveCount(0)

    await page.getByTestId('payment-modal').getByRole('button', { name: 'Credit' }).click()
  })

  test('Cancel is disabled while payment is processing', async ({ page }) => {
    await attachFinixMock(page, { latencyMs: 5000 })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('payment-processing')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  test('Split payment: cash tender plus card', async ({ page }) => {
    await attachFinixMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    await modal.getByRole('button', { name: '$10', exact: true }).click()
    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('$10.00 Cash')

    await modal.getByRole('button', { name: 'Credit' }).click()

    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('4242')
  })

  test('No manual card entry form is rendered', async ({ page }) => {
    await attachFinixMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    await expect(page.locator('[data-testid="card-entry-form"]')).toHaveCount(0)
    await expect(page.locator('[aria-label="Card Number"]')).toHaveCount(0)
    await expect(page.locator('[aria-label="Card CVV"]')).toHaveCount(0)
  })

  test('Payment complete returns card details via OK button', async ({ page }) => {
    await attachFinixMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('Credit')
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('****4242')

    await page.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })
})
