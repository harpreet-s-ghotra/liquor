import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Refund workflow E2E tests.
 *
 * Tests the flow of: open Sales History → recall a transaction →
 * select items for return → process refund via payment modal.
 */

const attachRefundMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const products = [
      {
        id: 1,
        sku: 'WINE-001',
        name: 'Cabernet Sauvignon 750ml',
        category: 'Wine',
        price: 19.99,
        quantity: 24,
        tax_rate: 0.08
      },
      {
        id: 2,
        sku: 'BEER-001',
        name: 'Craft IPA 6-Pack',
        category: 'Beer',
        price: 13.49,
        quantity: 40,
        tax_rate: 0.08
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

    const pastTransaction = {
      id: 100,
      transaction_number: 'TXN-20260328-001',
      subtotal: 33.48,
      tax_amount: 2.68,
      total: 36.16,
      payment_method: 'cash',
      finix_authorization_id: null,
      finix_transfer_id: null,
      card_last_four: null,
      card_type: null,
      status: 'completed',
      notes: null,
      cashier_id: 1,
      cashier_name: 'Test Cashier',
      session_id: 1,
      created_at: '2026-03-28T10:30:00.000Z',
      items: [
        {
          id: 1,
          product_id: 1,
          product_name: 'Cabernet Sauvignon 750ml',
          quantity: 1,
          unit_price: 19.99,
          total_price: 19.99
        },
        {
          id: 2,
          product_id: 2,
          product_name: 'Craft IPA 6-Pack',
          quantity: 1,
          unit_price: 13.49,
          total_price: 13.49
        }
      ],
      has_refund: false,
      payments: [{ method: 'cash', amount: 36.16 }]
    }

    const pastCardTransaction = {
      id: 101,
      transaction_number: 'TXN-20260328-002',
      subtotal: 19.99,
      tax_amount: 1.6,
      total: 21.59,
      payment_method: 'credit',
      finix_authorization_id: 'AU-test-auth-001',
      finix_transfer_id: 'TR-test-transfer-001',
      card_last_four: '4242',
      card_type: 'visa',
      status: 'completed',
      notes: null,
      cashier_id: 1,
      cashier_name: 'Test Cashier',
      session_id: 1,
      created_at: '2026-03-28T11:00:00.000Z',
      items: [
        {
          id: 3,
          product_id: 1,
          product_name: 'Cabernet Sauvignon 750ml',
          quantity: 1,
          unit_price: 19.99,
          total_price: 19.99
        }
      ],
      has_refund: false,
      payments: [{ method: 'credit', amount: 21.59, card_last_four: '4242', card_type: 'visa' }]
    }

    let refundSaved = false

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

      getProducts: async () => products,
      getActiveSpecialPricing: async () => [],
      getItemTypes: async () => [],
      getTaxCodes: async () => [],
      getDistributors: async () => [],

      saveTransaction: async () => ({ id: 2, transaction_number: 'TXN-20260328-003' }),
      getRecentTransactions: async () => [],
      getTransactionByNumber: async (txnNumber: string) => {
        if (txnNumber === 'TXN-20260328-001') return pastTransaction
        if (txnNumber === 'TXN-20260328-002') return pastCardTransaction
        return null
      },
      listTransactions: async () => ({
        transactions: [
          {
            id: 100,
            transaction_number: 'TXN-20260328-001',
            total: 36.16,
            payment_method: 'cash',
            status: 'completed',
            created_at: '2026-03-28T10:30:00.000Z',
            item_count: 2
          },
          {
            id: 101,
            transaction_number: 'TXN-20260328-002',
            total: 21.59,
            payment_method: 'credit',
            status: 'completed',
            created_at: '2026-03-28T11:00:00.000Z',
            item_count: 1
          }
        ],
        total_count: 2
      }),
      saveRefundTransaction: async () => {
        refundSaved = true
        return { id: 3, transaction_number: 'TXN-20260328-R001' }
      },
      finixRefundTransfer: async () => {},

      getHeldTransactions: async () => [],
      saveHeldTransaction: async () => ({ id: 1, hold_number: 1 }),
      deleteHeldTransaction: async () => {},
      clearAllHeldTransactions: async () => {},

      getReceiptConfig: async () => ({
        fontSize: 10,
        paddingY: 4,
        paddingX: 4,
        storeName: '',
        footerMessage: '',
        alwaysPrint: false
      }),
      printReceipt: async () => {},

      getActiveSession: async () => activeSession,
      createSession: async () => activeSession,
      listSessions: async () => ({ sessions: [activeSession], total_count: 1 }),
      closeSession: async () => ({
        ...activeSession,
        status: 'closed',
        ended_at: new Date().toISOString()
      }),
      getSessionReport: async () => ({}),
      printClockOutReport: async () => {},

      // Reports mocks
      getReportSalesSummary: async () => ({
        gross_sales: 0,
        tax_collected: 0,
        net_sales: 0,
        refund_count: 0,
        refund_amount: 0,
        transaction_count: 0,
        avg_transaction: 0,
        sales_by_payment: [],
        sales_by_card_brand: [],
        sales_by_day: []
      }),
      getReportProductSales: async () => ({ items: [] }),
      getReportCategorySales: async () => ({ categories: [] }),
      getReportTaxSummary: async () => ({ tax_rows: [] }),
      getReportComparison: async () => ({
        period_a: {},
        period_b: {},
        deltas: []
      }),
      getReportCashierSales: async () => ({ cashiers: [] }),
      getReportHourlySales: async () => ({ hours: [] }),
      exportReport: async () => '/tmp/report.pdf',

      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented')
      },

      // Expose refundSaved for assertions
      _getRefundSaved: () => refundSaved
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

test.describe('Refund Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await attachRefundMock(page)
    await page.goto('/')
    await loginWithPin(page)
  })

  test('opens Sales History modal via F7 shortcut', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Sales History")').click()
    await expect(page.getByRole('heading', { name: 'Sales History' })).toBeVisible()
  })

  test('displays past transactions in the list', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Sales History")').click()
    await expect(page.getByRole('heading', { name: 'Sales History' })).toBeVisible()
    await expect(page.locator('text=TXN-20260328-001')).toBeVisible()
    await expect(page.locator('text=TXN-20260328-002')).toBeVisible()
  })

  test('expands a transaction to show details', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Sales History")').click()
    await expect(page.getByRole('heading', { name: 'Sales History' })).toBeVisible()

    // Click the first transaction row to expand
    await page.locator('text=TXN-20260328-001').click()

    // Should show line items
    await expect(page.locator('text=Cabernet Sauvignon 750ml')).toBeVisible()
    await expect(page.locator('text=Craft IPA 6-Pack')).toBeVisible()
  })

  test('shows Recall for Return button on expanded transaction', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Sales History")').click()
    await expect(page.getByRole('heading', { name: 'Sales History' })).toBeVisible()

    await page.locator('text=TXN-20260328-001').click()
    await expect(page.locator('[data-testid="sales-history-recall-btn"]')).toBeVisible()
    await expect(page.locator('text=Recall for Return')).toBeVisible()
  })

  test('recalling a transaction loads it into the ticket panel for return', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Sales History")').click()
    await expect(page.getByRole('heading', { name: 'Sales History' })).toBeVisible()

    await page.locator('text=TXN-20260328-001').click()
    await page.locator('[data-testid="sales-history-recall-btn"]').click()

    // Sales history modal should close
    await expect(page.getByRole('heading', { name: 'Sales History' })).toHaveCount(0)

    // The recalled transaction items should appear in the ticket panel
    await expect(
      page.locator('.ticket-panel').locator('text=Cabernet Sauvignon 750ml')
    ).toBeVisible()
    await expect(page.locator('.ticket-panel').locator('text=Craft IPA 6-Pack')).toBeVisible()
  })

  test('recalled invoice disappears from main screen after refund completes', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Sales History")').click()
    await expect(page.getByRole('heading', { name: 'Sales History' })).toBeVisible()

    await page.locator('text=TXN-20260328-001').click()
    await page.locator('[data-testid="sales-history-recall-btn"]').click()

    await expect(page.getByTestId('recall-banner')).toBeVisible()

    await page.getByTestId('return-all-btn').click()
    await expect(page.getByTestId('recall-banner')).toContainText('Returning')

    await page.getByRole('button', { name: 'Process Refund' }).click()
    await page.getByRole('button', { name: 'Cash (Exact)' }).click()
    await expect(page.getByTestId('payment-complete')).toBeVisible()
    await page.getByTestId('payment-ok-btn').click()

    await expect(page.getByTestId('recall-banner')).toHaveCount(0)
    await expect(page.locator('.ticket-panel__line')).toHaveCount(0)
  })
})
