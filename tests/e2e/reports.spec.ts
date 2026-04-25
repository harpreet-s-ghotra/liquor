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

    const mockSummary = {
      gross_sales: 500,
      tax_collected: 40,
      net_sales: 460,
      refund_count: 1,
      refund_amount: 25,
      transaction_count: 10,
      avg_transaction: 50,
      sales_by_payment: [
        { payment_method: 'cash', transaction_count: 6, total_amount: 300 },
        { payment_method: 'credit', transaction_count: 4, total_amount: 200 }
      ],
      sales_by_card_brand: [],
      sales_by_day: [
        {
          date: '2024-06-10',
          transaction_count: 5,
          gross_sales: 250,
          tax_collected: 20,
          net_sales: 230
        }
      ]
    }

    const mockProductReport = {
      items: [
        {
          product_id: 1,
          product_name: 'Test Wine',
          item_type: 'Wine',
          sku: 'SKU1',
          quantity_sold: 20,
          revenue: 400,
          cost_total: 200,
          profit: 200,
          margin_pct: 50
        }
      ]
    }

    const mockTaxReport = {
      tax_rows: [{ tax_code_name: '8%', tax_rate: 8, taxable_sales: 500, tax_collected: 40 }]
    }

    let localHistoryStats = {
      count: 120,
      earliest: '2024-01-15T00:00:00.000Z',
      latest: '2024-06-11T00:00:00.000Z'
    }

    let backfillStatus = {
      state: 'idle',
      days: 0,
      applied: 0,
      skipped: 0,
      errors: 0,
      startedAt: null,
      finishedAt: null,
      lastError: null
    }

    const backfillListeners = new Set<(status: typeof backfillStatus) => void>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getMerchantConfig: async () => merchantConfig,
      getLocalHistoryStats: async () => localHistoryStats,
      getBackfillStatus: async () => backfillStatus,
      triggerBackfill: async (days: number) => {
        backfillStatus = {
          state: 'done',
          days,
          applied: 42,
          skipped: 5,
          errors: 0,
          startedAt: '2025-01-01T00:00:00.000Z',
          finishedAt: new Date().toISOString(),
          lastError: null
        }
        localHistoryStats = {
          count: 162,
          earliest: '2023-05-01T00:00:00.000Z',
          latest: '2024-06-11T00:00:00.000Z'
        }
        backfillListeners.forEach((listener) => listener(backfillStatus))
        return { started: true, days }
      },
      onBackfillStatusChanged: (callback: (status: typeof backfillStatus) => void) => {
        backfillListeners.add(callback)
        return () => backfillListeners.delete(callback)
      },
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
      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented')
      },

      saveTransaction: async () => ({ id: 1, transaction_number: 'TXN-1' }),
      getRecentTransactions: async () => [],
      getDistributors: async () => [],
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
      listSessions: async () => ({
        sessions: [activeSession],
        total_count: 1
      }),
      closeSession: async () => ({
        ...activeSession,
        status: 'closed',
        ended_at: new Date().toISOString(),
        closed_by_cashier_id: 1,
        closed_by_cashier_name: 'Test Cashier'
      }),
      getSessionReport: async () => ({}),
      printClockOutReport: async () => {},

      // Reports API
      getReportSalesSummary: async () => mockSummary,
      getReportProductSales: async () => mockProductReport,
      getReportCategorySales: async () => ({ categories: [] }),
      getReportTaxSummary: async () => mockTaxReport,
      getReportComparison: async () => ({
        period_a: mockSummary,
        period_b: mockSummary,
        deltas: []
      }),
      getReportCashierSales: async () => ({ cashiers: [] }),
      getReportHourlySales: async () => ({ hours: [] }),
      exportReport: async () => '/tmp/report.pdf'
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

test.describe('Sales Reports', () => {
  test.beforeEach(async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await loginWithPin(page)
  })

  test('opens Reports modal via F5 shortcut bar button', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Sales Summary' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Product Analysis' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Tax Report' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Comparisons' })).toBeVisible()
  })

  test('displays summary cards with data', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await expect(page.locator('text=Gross Sales')).toBeVisible()
    await expect(page.locator('text=Net Sales')).toBeVisible()
    await expect(page.locator('text=Tax Collected')).toBeVisible()
    await expect(page.getByText('Transactions', { exact: true })).toBeVisible()
  })

  test('switches to Product Analysis tab', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await page.locator('text=Product Analysis').click()
    await expect(page.locator('text=Top Products by Revenue')).toBeVisible()
    await expect(page.locator('text=Test Wine')).toBeVisible()
  })

  test('switches to Tax Report tab', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await page.getByRole('tab', { name: 'Tax Report' }).click()
    await expect(page.locator('th:has-text("Tax Code")')).toBeVisible()
    await expect(page.locator('th:has-text("Rate")')).toBeVisible()
  })

  test('switches to Comparisons tab and shows granularity toggle', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await page.getByRole('tab', { name: 'Comparisons' }).click()
    await expect(page.locator('.reports-modal__range-label:has-text("Group By")')).toBeVisible()
    await expect(page.getByLabel('Group by month')).toBeVisible()
    await expect(page.getByLabel('Group by week')).toBeVisible()
  })

  test('shows export buttons on summary tab', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await expect(page.getByLabel('Period')).toBeVisible()
    await expect(page.getByLabel('Export')).toBeVisible()
    await expect(page.locator('button:has-text("Download PDF")')).toBeVisible()
    await expect(page.locator('button:has-text("Download CSV")')).toBeVisible()
  })

  test('starts a manual sales history pull from the reports modal', async ({ page }) => {
    await page.locator('.bottom-bar__key-btn:has-text("Reports")').click()
    await expect(page.locator('text=Sales Reports')).toBeVisible()
    await expect(page.getByTestId('reports-history-panel')).toBeVisible()

    await page.getByLabel('Days of sales history to pull').fill('45')
    await page.getByRole('button', { name: 'Pull Sales History' }).click()

    await expect(page.locator('text=Last pull complete')).toBeVisible()
    await expect(page.locator('text=162 local transactions')).toBeVisible()
  })
})
