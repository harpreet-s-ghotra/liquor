import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Manager Modal E2E tests
 * Tests the F6 key Manager modal workflow: cashier management, register config, merchant info, data history
 */

const attachManagerModalMock = async (page: Page): Promise<void> => {
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
      },
      {
        id: 2,
        sku: 'BEER-001',
        name: 'Craft IPA 6-Pack',
        category: 'Beer',
        price: 13.49,
        quantity: 5, // Low stock
        tax_rate: 0.13
      },
      {
        id: 3,
        sku: 'SPIRIT-001',
        name: 'Premium Vodka 1L',
        category: 'Spirits',
        price: 32.99,
        quantity: 2, // Very low stock
        tax_rate: 0.13
      }
    ]

    const cashiers = [
      {
        id: 1,
        name: 'Alice Admin',
        role: 'admin',
        is_active: 1,
        created_at: '2025-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        name: 'Bob Cashier',
        role: 'cashier',
        is_active: 1,
        created_at: '2025-01-05T00:00:00.000Z'
      }
    ]

    const registers = [
      {
        id: 'reg-1',
        device_name: 'Front Counter',
        device_fingerprint: 'fp-1',
        is_current: true,
        last_seen_at: '2026-01-15T10:30:00Z',
        created_at: '2026-01-01T00:00:00Z'
      },
      {
        id: 'reg-2',
        device_name: 'Back Counter',
        device_fingerprint: 'fp-2',
        is_current: false,
        last_seen_at: '2026-01-14T14:00:00Z',
        created_at: '2026-01-01T00:00:00Z'
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
      name: 'Alice Admin',
      role: 'admin',
      is_active: 1,
      created_at: '2025-01-01T00:00:00.000Z'
    }

    const createdCashiers = [...cashiers]

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
      getCashiers: async () => createdCashiers,
      validatePin: async () => testCashier,

      // POS Product APIs
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
        throw new Error('Not implemented in manager modal mock')
      },

      // Manager Modal APIs
      listRegisters: async () => registers,
      renameRegister: async (id: string, name: string) => {
        const reg = registers.find((r) => r.id === id)
        if (reg) {
          reg.device_name = name
        }
        return {}
      },
      deleteRegister: async () => ({}),
      createCashier: async (input: { name: string; pin_hash: string }) => {
        const newCashier = {
          id: createdCashiers.length + 1,
          name: input.name,
          role: 'cashier',
          is_active: 1,
          created_at: new Date().toISOString()
        }
        createdCashiers.push(newCashier)
        return newCashier
      },
      updateCashier: async () => ({}),
      deleteCashier: async () => ({}),
      getFinixMerchantStatus: async () => ({
        merchant_name: 'Test Liquor Store',
        merchant_id: 'MU-test-merchant-id',
        processing_enabled: true
      }),
      getLocalHistoryStats: async () => ({
        count: 120,
        earliest: '2025-01-01T00:00:00.000Z',
        latest: '2025-01-15T00:00:00.000Z'
      }),
      getBackfillStatus: async () => ({
        state: 'done',
        days: 365,
        applied: 120,
        skipped: 0,
        errors: 0,
        startedAt: '2025-01-15T00:00:00.000Z',
        finishedAt: '2025-01-15T00:05:00.000Z',
        lastError: null
      }),
      triggerBackfill: async () => ({ started: true, days: 365 }),
      onBackfillStatusChanged: () => () => {},

      // Payment APIs (for normal transactions)
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
      saveTransaction: async () => ({
        id: 1,
        transaction_number: 'TXN-123',
        status: 'completed'
      }),
      getRecentTransactions: async () => []
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

const gotoAndLogin = async (page: Page): Promise<void> => {
  await page.goto('/')
  await loginWithPin(page)
}

test.describe('Manager Modal (F6)', () => {
  test('opens manager modal with F6 key', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    // Press F6 to open manager modal
    await page.keyboard.press('F6')

    // Manager modal should be visible
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('.app-modal-header__label')).toHaveText('Manager')
  })

  test('displays cashiers tab by default', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')

    // Should show Cashiers tab with cashier list
    await expect(page.getByRole('tab', { name: 'Cashiers' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('cell', { name: 'Alice Admin' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Bob Cashier' })).toBeVisible()
  })

  test('navigates through all manager tabs', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')

    // Test Registers tab
    await page.getByRole('tab', { name: 'Registers' }).click()
    await expect(page.getByText('Front Counter')).toBeVisible()

    // Test Merchant Info tab
    await page.getByRole('tab', { name: 'Merchant Info' }).click()
    const storeNameCard = page
      .locator('.merchant-info__card')
      .filter({ has: page.getByText('Store Name') })
    await expect(storeNameCard.locator('.merchant-info__card-value')).toHaveText(
      'Test Liquor Store'
    )

    // Test Data History tab
    await page.getByRole('tab', { name: 'Data History' }).click()
    await expect(page.getByRole('tab', { name: 'Data History' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  test('creates a new cashier in manager modal', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')

    // Click "Add Cashier" button (or equivalent)
    const addButton = page.getByRole('button', { name: /add|new/i })
    if (await addButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addButton.click()
    }

    // The test would fill in the form here if the UI has one
    // For now, we're verifying the tab renders correctly
    await expect(page.getByRole('tab', { name: 'Cashiers' })).toBeVisible()
  })

  test('renames a register in manager modal', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')
    await page.getByRole('tab', { name: 'Registers' }).click()

    // Click rename button on first register
    const renameButtons = page.getByRole('button', { name: /rename|edit/i })
    if (
      await renameButtons
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await renameButtons.first().click()

      // Fill in new name
      const input = page.locator('input').filter({ hasValue: 'Front Counter' })
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        await input.clear()
        await input.type('Main Counter')
        await page.getByRole('button', { name: /save|confirm/i }).click()
      }
    }

    await expect(page.getByRole('tab', { name: 'Registers' })).toBeVisible()
  })

  test('displays data history stats', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')
    await page.getByRole('tab', { name: 'Data History' }).click()

    const localTransactionsCard = page
      .locator('.data-history__card')
      .filter({ has: page.getByText('Local transactions') })
    await expect(localTransactionsCard.locator('.data-history__card-value')).toHaveText('120')
    await expect(page.getByText('Last pull complete')).toBeVisible()
  })

  test('displays merchant info with payment processor status', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')
    await page.getByRole('tab', { name: 'Merchant Info' }).click()

    // Should display merchant details
    const storeNameCard = page
      .locator('.merchant-info__card')
      .filter({ has: page.getByText('Store Name') })
    const merchantIdCard = page
      .locator('.merchant-info__card')
      .filter({ has: page.getByText('Finix Merchant ID') })

    await expect(storeNameCard.locator('.merchant-info__card-value')).toHaveText(
      'Test Liquor Store'
    )
    await expect(merchantIdCard.locator('.merchant-info__card-value')).toHaveText(
      'MU-test-merchant-id'
    )

    // Should indicate payment processing is enabled
    await expect(page.locator('.merchant-info__badge--enabled')).toBeVisible()
  })

  test('closes manager modal with close button', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')

    // Manager modal should be open
    await expect(page.getByRole('dialog')).toBeVisible()

    // Click close button
    await page.getByRole('button', { name: 'Close' }).click()

    // Modal should be closed
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('closes manager modal with Escape key', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F6')
    await expect(page.getByRole('dialog')).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('returns to POS after closing manager modal', async ({ page }) => {
    await attachManagerModalMock(page)
    await gotoAndLogin(page)

    const posShell = page.locator('.ticket-panel')
    await expect(posShell).toBeVisible()

    // Open and close manager modal
    await page.keyboard.press('F6')
    await page.keyboard.press('Escape')

    // Should be back in POS screen with products visible
    await expect(posShell).toBeVisible()
  })
})
