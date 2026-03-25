import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Stax terminal payment E2E tests.
 *
 * The card entry form is gone — credit/debit buttons now send the charge
 * straight to the physical card terminal via `chargeTerminal`. In E2E tests
 * we mock `window.api.chargeTerminal` to simulate the terminal response.
 */

/**
 * Attach a POS API mock that includes chargeTerminal (simulated terminal).
 * When chargeTerminal is present, clicking Credit/Debit sends the charge
 * to the terminal and shows "Waiting for card machine..." spinner.
 */
const attachTerminalMock = async (
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
        stax_api_key: 'test-api-key',
        merchant_id: 'test-merchant-id',
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
        // Auth APIs
        getMerchantConfig: async () => merchantConfig,
        getCashiers: async () => [testCashier],
        validatePin: async () => testCashier,

        // Product APIs
        getProducts: async () => products,
        getActiveSpecialPricing: async () => [],
        getDepartments: async () => [],
        getVendors: async () => [],
        getTaxCodes: async () => [],
        getInventoryTaxCodes: async () => [],
        searchInventoryProducts: async () => [],
        getInventoryProductDetail: async () => null,
        saveInventoryItem: async () => {
          throw new Error('Not implemented in terminal mock')
        },

        // Terminal registers
        getTerminalRegisters: async () => [
          {
            id: 'reg-001',
            nickname: 'Front Counter',
            serial: 'SN-12345',
            type: 'dejavoo',
            model: 'QD4',
            is_default: true,
            register_num: 1
          }
        ],

        // Dev-mode card mock (used when IS_DEV=true — mirrors terminal behavior)
        chargeWithCard: async (input: { total: number; card_type?: string }) => {
          await new Promise((resolve) => setTimeout(resolve, lat))
          if (doTimeout) {
            return {
              transaction_id: 'txn-timeout',
              success: false,
              last_four: '',
              card_type: 'unknown',
              total: input.total,
              message: 'Terminal timed out — no response from card reader',
              status: 'timeout'
            }
          }
          if (doDecline) {
            return {
              transaction_id: '',
              success: false,
              last_four: '',
              card_type: 'unknown',
              total: input.total,
              message: 'Card declined by terminal',
              status: 'declined'
            }
          }
          const isVisa = (input.card_type ?? 'visa') !== 'mastercard'
          return {
            transaction_id: `txn-${Date.now()}`,
            success: true,
            last_four: isVisa ? '4242' : '3222',
            card_type: isVisa ? 'visa' : 'mastercard',
            total: input.total,
            message: 'Approved',
            status: 'approved'
          }
        },

        // Simulated terminal charge — represents physical card machine interaction
        chargeTerminal: async (input: { total: number; payment_type: string }) => {
          // Simulate terminal processing time
          await new Promise((resolve) => setTimeout(resolve, lat))

          if (doTimeout) {
            return {
              transaction_id: 'txn-timeout',
              success: false,
              last_four: '',
              card_type: 'unknown',
              total: input.total,
              message: 'Terminal timed out — no response from card reader',
              status: 'timeout'
            }
          }

          if (doDecline) {
            return {
              transaction_id: '',
              success: false,
              last_four: '',
              card_type: 'unknown',
              total: input.total,
              message: 'Card declined by terminal',
              status: 'declined'
            }
          }

          // Success: simulate a Visa tap
          const cardType = input.payment_type === 'debit' ? 'mastercard' : 'visa'
          const lastFour = input.payment_type === 'debit' ? '3222' : '4242'

          return {
            transaction_id: `txn-${Date.now()}`,
            success: true,
            last_four: lastFour,
            card_type: cardType,
            total: input.total,
            message: 'Approved',
            status: 'approved'
          }
        },

        // Simulated transaction save
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
  const firstProduct = page.locator('.action-panel__product-tile').first()
  await firstProduct.click()
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

/** Navigate to the app and log in */
const gotoAndLogin = async (page: Page): Promise<void> => {
  await page.goto('/')
  await loginWithPin(page)
}

test.describe('Terminal Card Payments', () => {
  test('Credit payment via terminal processes successfully', async ({ page }) => {
    await attachTerminalMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Click Credit on ActionPanel — sends charge to terminal
    await page.getByRole('button', { name: 'Credit' }).click()

    // Should show processing state (DEV mode shows "Processing test card...")
    await expect(page.getByTestId('payment-processing')).toBeVisible()
    await expect(page.getByTestId('payment-processing')).toContainText('Processing test card...')

    // Terminal approves → payment complete
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('4242')

    // Finish
    await page.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })

  test('Debit payment via terminal processes successfully', async ({ page }) => {
    await attachTerminalMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Click Debit on ActionPanel
    await page.getByRole('button', { name: 'Debit' }).click()

    await expect(page.getByTestId('payment-processing')).toBeVisible()
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('Debit')
    await expect(paidList).toContainText('mastercard')
    await expect(paidList).toContainText('3222')

    await page.getByTestId('payment-ok-btn').click()
  })

  test('Terminal decline shows error', async ({ page }) => {
    await attachTerminalMock(page, { decline: true })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    // Should show decline error
    await expect(page.getByTestId('card-error')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('card-error')).toContainText('Card declined')
    await expect(page.getByTestId('payment-complete')).toHaveCount(0)
  })

  test('Terminal timeout shows error', async ({ page }) => {
    await attachTerminalMock(page, { timeout: true })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    await expect(page.getByTestId('card-error')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('card-error')).toContainText('No response from the card reader')
  })

  test('Dismiss button clears error and allows retry', async ({ page }) => {
    await attachTerminalMock(page, { decline: true })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('card-error')).toBeVisible({ timeout: 5000 })

    // Click Dismiss
    await page.getByTestId('card-retry-btn').click()
    await expect(page.getByTestId('card-error')).toHaveCount(0)

    // Payment method buttons should still be enabled
    const modal = page.getByTestId('payment-modal')
    await expect(modal.getByRole('button', { name: 'Credit' })).toBeEnabled()
    await expect(modal.getByRole('button', { name: 'Debit' })).toBeEnabled()
  })

  test('Cancel is disabled while terminal is processing', async ({ page }) => {
    await attachTerminalMock(page, { latencyMs: 5000 })
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('payment-processing')).toBeVisible()

    // Cancel button should be disabled during processing
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  test('Split payment: cash tender + terminal card', async ({ page }) => {
    await attachTerminalMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    // Pay partial with $10 cash
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('$10.00 Cash')

    // Pay remaining with Credit via terminal
    await modal.getByRole('button', { name: 'Credit' }).click()

    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('4242')
  })

  test('No card entry form exists — terminal handles card details', async ({ page }) => {
    await attachTerminalMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()

    // There should be no card entry form — the terminal handles card input
    await expect(page.locator('[data-testid="card-entry-form"]')).toHaveCount(0)
    await expect(page.locator('[aria-label="Card Number"]')).toHaveCount(0)
    await expect(page.locator('[aria-label="Card CVV"]')).toHaveCount(0)
  })

  test('Payment complete returns card details via OK button', async ({ page }) => {
    await attachTerminalMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    // Verify paid-so-far shows correct card details
    const paidList = page.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('Credit')
    await expect(paidList).toContainText('visa')
    await expect(paidList).toContainText('****4242')

    await page.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })
})
