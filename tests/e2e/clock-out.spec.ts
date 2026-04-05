import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachPosApiMock = async (page: Page): Promise<void> => {
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

    const merchantConfig = {
      id: 1,
      payment_processing_api_key: 'test-api-key',
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

    const activeSession = {
      id: 1,
      opened_by_cashier_id: 1,
      opened_by_cashier_name: 'Test Cashier',
      closed_by_cashier_id: null,
      closed_by_cashier_name: null,
      started_at: '2026-03-28T09:00:00.000Z',
      ended_at: null,
      status: 'active'
    }

    const closedSession = {
      id: 2,
      opened_by_cashier_id: 1,
      opened_by_cashier_name: 'Test Cashier',
      closed_by_cashier_id: 1,
      closed_by_cashier_name: 'Test Cashier',
      started_at: '2026-03-27T09:00:00.000Z',
      ended_at: '2026-03-27T21:00:00.000Z',
      status: 'closed'
    }

    const sampleReport = {
      session: closedSession,
      sales_by_item_type: [
        { item_type_name: 'Spirits', transaction_count: 10, total_amount: 329.9 },
        { item_type_name: 'Wine', transaction_count: 5, total_amount: 99.95 }
      ],
      sales_by_payment_method: [
        { payment_method: 'cash', transaction_count: 8, total_amount: 200.0 },
        { payment_method: 'credit', transaction_count: 5, total_amount: 150.85 },
        { payment_method: 'debit', transaction_count: 2, total_amount: 79.0 }
      ],
      total_sales_count: 15,
      gross_sales: 429.85,
      total_tax_collected: 55.88,
      net_sales: 373.97,
      total_refund_count: 1,
      total_refund_amount: 19.99,
      average_transaction_value: 28.66,
      expected_cash_at_close: 180.01,
      cash_total: 200.0,
      credit_total: 150.85,
      debit_total: 79.0
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      // Auth APIs
      getMerchantConfig: async () => merchantConfig,
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: merchantConfig
      }),
      onDeepLink: () => {},
      getCashiers: async () => [testCashier],
      validatePin: async () => testCashier,

      // Product APIs
      getProducts: async () => products,
      getActiveSpecialPricing: async () => [],
      getItemTypes: async () => [],
      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented')
      },

      // Transaction mocks
      saveTransaction: async () => ({ id: 1, transaction_number: 'TXN-1' }),
      getRecentTransactions: async () => [],
      getDistributors: async () => [],
      getHeldTransactions: async () => [],
      saveHeldTransaction: async () => ({ id: 1, hold_number: 1 }),
      deleteHeldTransaction: async () => {},
      clearAllHeldTransactions: async () => {},

      // Receipt mocks
      getReceiptConfig: async () => ({
        fontSize: 10,
        paddingY: 4,
        paddingX: 4,
        storeName: '',
        footerMessage: '',
        alwaysPrint: false
      }),
      printReceipt: async () => {},

      // Session APIs
      getActiveSession: async () => activeSession,
      createSession: async () => activeSession,
      listSessions: async () => ({
        sessions: [activeSession, closedSession],
        total_count: 2
      }),
      closeSession: async () => ({
        ...activeSession,
        status: 'closed',
        ended_at: new Date().toISOString(),
        closed_by_cashier_id: 1,
        closed_by_cashier_name: 'Test Cashier'
      }),
      getSessionReport: async () => sampleReport,
      printClockOutReport: async () => {}
    }
  })
}

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

test.describe('Clock Out', () => {
  test('F3 opens the clock out modal with session list', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F3')

    await expect(page.getByText('Sessions')).toBeVisible()
    await expect(page.getByTestId('session-list')).toBeVisible({ timeout: 10000 })

    // Session list shows both active and closed sessions
    const sessionList = page.getByTestId('session-list')
    await expect(sessionList.getByText('Active')).toBeVisible({ timeout: 10000 })
    await expect(sessionList.getByText('Closed')).toBeVisible()
  })

  test('clicking Clock In/Out button opens the modal', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.locator('.bottom-bar__key-btn', { hasText: 'Clock In/Out' }).click()

    await expect(page.getByText('Sessions')).toBeVisible()
    await expect(page.getByTestId('session-list')).toBeVisible()
  })

  test('Clock Out button shows PIN entry', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F3')
    await expect(page.getByTestId('session-list')).toBeVisible()

    await page.getByTestId('clock-out-btn').click()

    await expect(page.getByText('Confirm Clock Out')).toBeVisible()
    await expect(page.getByTestId('pin-entry')).toBeVisible()
    await expect(page.getByText('Enter your PIN or an admin PIN to clock out')).toBeVisible()
  })

  test('full clock-out flow: PIN entry -> report', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Open modal
    await page.keyboard.press('F3')
    await expect(page.getByTestId('session-list')).toBeVisible()

    // Click Clock Out
    await page.getByTestId('clock-out-btn').click()
    await expect(page.getByTestId('pin-entry')).toBeVisible()

    // Enter PIN via pin pad buttons
    for (const digit of ['1', '2', '3', '4']) {
      await page.locator(`.clock-out-modal__pin-key:text("${digit}")`).click()
    }

    // Should auto-submit and show report
    await expect(page.getByText('End of Day Report')).toBeVisible()
    await expect(page.getByTestId('clock-out-report')).toBeVisible()

    // Report shows department sales
    await expect(page.getByText('Spirits')).toBeVisible()
    await expect(page.getByText('Wine')).toBeVisible()

    // Report shows payment breakdown
    await expect(page.getByText('Cash Reconciliation')).toBeVisible()

    // Print and close buttons visible
    await expect(page.getByRole('button', { name: 'Print Report' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible()
  })

  test('Print Report button works', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Navigate to report view
    await page.keyboard.press('F3')
    await page.getByTestId('clock-out-btn').click()

    for (const digit of ['1', '2', '3', '4']) {
      await page.locator(`.clock-out-modal__pin-key:text("${digit}")`).click()
    }

    await expect(page.getByText('End of Day Report')).toBeVisible()

    // Click Print Report
    await page.getByRole('button', { name: 'Print Report' }).click()

    // Button should briefly show "Printing..." then revert
    await expect(page.getByRole('button', { name: 'Print Report' })).toBeVisible()
  })

  test('View Report on closed session shows read-only report', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F3')
    await expect(page.getByTestId('session-list')).toBeVisible()

    // Click View Report on the closed session
    await page.getByTestId('view-report-btn-2').click()

    await expect(page.getByText('End of Day Report')).toBeVisible()
    await expect(page.getByTestId('clock-out-report')).toBeVisible()
  })

  test('Close button returns to POS screen', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F3')
    await expect(page.getByTestId('session-list')).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()

    // Modal should be gone, POS screen visible
    await expect(page.getByTestId('session-list')).not.toBeVisible()
    await expect(page.locator('.action-panel__product-tile').first()).toBeVisible()
  })

  test('PIN Cancel returns to session list', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.keyboard.press('F3')
    await page.getByTestId('clock-out-btn').click()
    await expect(page.getByTestId('pin-entry')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Sessions')).toBeVisible()
    await expect(page.getByTestId('pin-entry')).not.toBeVisible()
  })

  test('re-opening modal after clock-out shows active session', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Clock out
    await page.keyboard.press('F3')
    await page.getByTestId('clock-out-btn').click()

    for (const digit of ['1', '2', '3', '4']) {
      await page.locator(`.clock-out-modal__pin-key:text("${digit}")`).click()
    }

    await expect(page.getByText('End of Day Report')).toBeVisible()

    // Close the modal and re-open
    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(page.getByTestId('session-list')).not.toBeVisible()

    await page.keyboard.press('F3')
    await expect(page.getByTestId('session-list')).toBeVisible({ timeout: 10000 })

    // Should still show an active session (auto-created after clock-out)
    const sessionList = page.getByTestId('session-list')
    await expect(sessionList.getByText('Active')).toBeVisible({ timeout: 10000 })
  })
})
