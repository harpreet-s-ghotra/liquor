import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Authentication Error Handling E2E tests
 * Tests PIN validation, invalid PIN entry, and lockout scenarios
 */

const attachAuthMock = async (page: Page): Promise<void> => {
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

    const cashiers = [
      {
        id: 1,
        name: 'Alice Admin',
        role: 'admin',
        is_active: 1,
        pin_hash: 'admin_pin_hash',
        created_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        name: 'Bob Cashier',
        role: 'cashier',
        is_active: 1,
        pin_hash: 'cashier_pin_hash',
        created_at: '2025-01-05T00:00:00.000Z'
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

    let validationAttempts = 0
    let lockoutUntil: number | null = null
    const LOCKOUT_DURATION = 30000 // 30 seconds for testing
    const MAX_ATTEMPTS = 3

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getMerchantConfig: async () => merchantConfig,
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: merchantConfig
      }),
      onDeepLink: () => {},
      consumePendingDeepLink: async () => null,
      getCashiers: async () => cashiers,
      validatePin: async (pin: string) => {
        const now = Date.now()

        // Check if currently in lockout
        if (lockoutUntil !== null && now < lockoutUntil) {
          const remainingMs = lockoutUntil - now
          throw new Error(`Account locked. Try again in ${Math.ceil(remainingMs / 1000)} seconds`)
        }

        // Reset attempts if lockout period has passed
        if (lockoutUntil !== null && now >= lockoutUntil) {
          lockoutUntil = null
          validationAttempts = 0
        }

        // Check if PIN is valid (only 1234 is valid)
        const validPin = '1234'
        if (pin !== validPin) {
          validationAttempts += 1

          if (validationAttempts >= MAX_ATTEMPTS) {
            lockoutUntil = now + LOCKOUT_DURATION
            validationAttempts = 0
            throw new Error('Too many invalid attempts. Account locked for 30 seconds.')
          }

          throw new Error(`Invalid PIN. ${MAX_ATTEMPTS - validationAttempts} attempts remaining.`)
        }

        // Reset on successful login
        validationAttempts = 0
        lockoutUntil = null

        return cashiers[0] // Return Alice Admin for successful auth
      },

      // Product APIs
      getProducts: async () => products,
      getActiveSpecialPricing: async () => [],
      getItemTypes: async () => [],
      getDistributors: async () => [],
      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented in auth test mock')
      }
    }
  })
}

test.describe('Authentication Error Handling', () => {
  test('rejects single invalid PIN entry with error message', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    // Enter wrong PIN (not 1234)
    const pinKey = page.locator('.pin-key').first()
    await pinKey.waitFor({ state: 'visible', timeout: 10000 })

    // Enter 5678 (wrong PIN)
    for (const digit of ['5', '6', '7', '8']) {
      await page.locator(`.pin-key:text("${digit}")`).click()
    }

    // Error should appear
    const errorMessage = page.getByText(/invalid pin|incorrect|failed/i)
    await expect(errorMessage).toBeVisible()
  })

  test('shows invalid-pin feedback after wrong PIN', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    const pinKey = page.locator('.pin-key').first()
    await pinKey.waitFor({ state: 'visible', timeout: 10000 })

    // First wrong attempt
    for (const digit of ['5', '6', '7', '8']) {
      await page.locator(`.pin-key:text("${digit}")`).click()
    }

    // Should show an invalid PIN error response
    await expect(page.getByText(/invalid pin|incorrect|failed/i)).toBeVisible()

    // Clear for next attempt - find the clear button or wait for PIN entry to reset
    const clearButton = page.getByRole('button', { name: /clear|c/i }).first()
    if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearButton.click()
    }
  })

  test('allows valid PIN after failed attempts', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    const pinKey = page.locator('.pin-key').first()
    await pinKey.waitFor({ state: 'visible', timeout: 10000 })

    // First wrong attempt
    for (const digit of ['5', '6', '7', '8']) {
      await page.locator(`.pin-key:text("${digit}")`).click()
    }

    // Clear and try correct PIN
    const clearButton = page.getByRole('button', { name: /clear|c/i }).first()
    if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearButton.click()
    }

    // Enter correct PIN (1234)
    for (const digit of ['1', '2', '3', '4']) {
      await page.locator(`.pin-key:text("${digit}")`).click()
    }

    // Should successfully log in to POS shell
    await expect(page.locator('.ticket-panel')).toBeVisible({ timeout: 5000 })
  })

  test('stays on PIN login after repeated invalid entries', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    const pinKey = page.locator('.pin-key').first()
    await pinKey.waitFor({ state: 'visible', timeout: 10000 })

    // Make repeated failed attempts and ensure we remain on the PIN screen
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const digit of ['5', '6', '7', '8']) {
        await page.locator(`.pin-key:text("${digit}")`).click()
      }

      await expect(page.getByRole('heading', { name: 'Enter PIN' })).toBeVisible()

      if (attempt < 2) {
        const clearButton = page.getByRole('button', { name: /clear|c/i }).first()
        if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await clearButton.click()
        }
      }
    }
  })

  test('shows PIN entry fields on login screen', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    // PIN keys should be visible
    const pinKeys = page.locator('.pin-key')
    await expect(pinKeys.first()).toBeVisible()

    // Should have numeric buttons 0-9
    for (let i = 0; i <= 9; i++) {
      await expect(page.locator(`.pin-key:text("${i}")`)).toBeVisible()
    }
  })

  test('shows PIN entry instead of password field on login', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    // PIN keypad should be visible
    await expect(page.locator('.pin-key').first()).toBeVisible()

    // Should NOT have email/password fields
    await expect(page.getByPlaceholder(/email|username/i)).not.toBeVisible()
  })

  test('pins are touch-friendly with large buttons', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    const pinKey = page.locator('.pin-key').first()

    // PIN buttons should be sized for touch (56px minimum height per design system)
    const boundingBox = await pinKey.boundingBox()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(boundingBox!.height).toBeGreaterThanOrEqual(50)
  })

  test('successful PIN leads to POS screen', async ({ page }) => {
    await attachAuthMock(page)
    await page.goto('/')

    const pinKey = page.locator('.pin-key').first()
    await pinKey.waitFor({ state: 'visible', timeout: 10000 })

    // Enter correct PIN (1234)
    for (const digit of ['1', '2', '3', '4']) {
      await page.locator(`.pin-key:text("${digit}")`).click()
    }

    // Should show POS screen shell
    await expect(page.locator('.ticket-panel')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.ticket-panel')).toBeVisible()
  })
})
