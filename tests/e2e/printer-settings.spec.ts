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
      getHeldTransactions: async () => [],
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented')
      },

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

      saveTransaction: async () => ({ id: 1, transaction_number: 'TXN-1' }),
      getRecentTransactions: async () => [],
      saveHeldTransaction: async () => ({ id: 1, hold_number: 1 }),
      deleteHeldTransaction: async () => {},
      clearAllHeldTransactions: async () => {},

      // Printer-specific mocks
      listReceiptPrinters: async () => ['USB Printer', 'Network Printer', 'Thermal Printer'],
      getReceiptPrinterConfig: async () => ({ printerName: 'USB Printer' }),
      saveReceiptPrinterConfig: async () => {},
      saveReceiptConfig: async () => {},
      getPrinterStatus: async (printerName?: string) => ({
        connected: printerName === 'USB Printer' || printerName === 'Network Printer',
        printerName: printerName || 'USB Printer'
      }),
      getCashDrawerConfig: async () => ({ type: 'usb', address: '' }),
      saveCashDrawerConfig: async () => {},
      openCashDrawer: async () => {},

      // Reports mocks (needed for F5 shortcut bar)
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
      getReportComparison: async () => ({ period_a: {}, period_b: {}, deltas: [] }),
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

test.describe('Printer Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await loginWithPin(page)
  })

  test('opens printer settings modal from header settings button', async ({ page }) => {
    // Click settings gear icon
    await page.getByTestId('settings-button').click()
    await expect(page.getByTestId('settings-dropdown')).toBeVisible()

    // Click Printer Settings from dropdown
    await page.getByTestId('printer-settings-btn').click()

    // Modal should be visible with title
    await expect(page.getByRole('heading', { name: 'Printer Settings' })).toBeVisible()
    await expect(page.getByText('Receipt Printer')).toBeVisible()
  })

  test('displays available printers in dropdown', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Wait for modal to open
    await expect(page.getByRole('heading', { name: 'Printer Settings' })).toBeVisible()

    // Select printer dropdown should show available options
    const printerSelect = page.locator('.printer-settings-modal__select').first()

    // Check all printer options are available in the select
    await expect(printerSelect.locator('option[value="USB Printer"]')).toHaveCount(1)
    await expect(printerSelect.locator('option[value="Network Printer"]')).toHaveCount(1)
    await expect(printerSelect.locator('option[value="Thermal Printer"]')).toHaveCount(1)
  })

  test('updates printer status when printer is selected', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Modal should show printer status
    await expect(page.getByText('Printer Status')).toBeVisible()

    // Select a printer from dropdown
    const printerSelect = page.locator('.printer-settings-modal__select').first()
    await printerSelect.selectOption('USB Printer')

    // Status should show "Connected" since USB Printer is connected in mock
    await expect(page.locator('text=Connected')).toBeVisible()
  })

  test('allows editing store name and footer message', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Find and fill store name input
    const storeNameInput = page.locator('.printer-settings-modal__text-input').nth(0)
    await storeNameInput.fill('My Liquor Store')
    await expect(storeNameInput).toHaveValue('My Liquor Store')

    // Find and fill footer message input
    const footerInput = page.locator('.printer-settings-modal__text-input').nth(1)
    await footerInput.fill('Thank you for shopping!')
    await expect(footerInput).toHaveValue('Thank you for shopping!')
  })

  test('allows adjusting font size with increment/decrement buttons', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Find font size stepper (looks for "pt" text to identify the value span)
    const fontSizeValue = page.locator('.printer-settings-modal__stepper-value').first()
    await expect(fontSizeValue).toHaveText('10 pt')

    // Click the + button to increase font size
    const fontStepper = page.locator('.printer-settings-modal__stepper').first()
    const incrementBtn = fontStepper.locator('button').nth(1)
    await incrementBtn.click()

    // Font size should increase to 11
    await expect(fontSizeValue).toHaveText('11 pt')

    // Click + again
    await incrementBtn.click()
    await expect(fontSizeValue).toHaveText('12 pt')

    // Click the - button to decrease
    const decrementBtn = fontStepper.locator('button').nth(0)
    await decrementBtn.click()
    await expect(fontSizeValue).toHaveText('11 pt')
  })

  test('allows adjusting receipt margins (padding)', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Find padding controls for top/bottom (Y-axis) and left/right (X-axis)
    const paddingRows = page.locator('.printer-settings-modal__padding-row')

    // First padding row is Y (top/bottom)
    const yPaddingValue = paddingRows.nth(0).locator('.printer-settings-modal__stepper-value')
    await expect(yPaddingValue).toHaveText('4 pt')

    // Increment Y padding
    const yIncrementBtn = paddingRows.nth(0).locator('button').nth(1)
    await yIncrementBtn.click()
    await expect(yPaddingValue).toHaveText('6 pt')

    // Second padding row is X (left/right)
    const xPaddingValue = paddingRows.nth(1).locator('.printer-settings-modal__stepper-value')
    await expect(xPaddingValue).toHaveText('4 pt')

    // Increment X padding
    const xIncrementBtn = paddingRows.nth(1).locator('button').nth(1)
    await xIncrementBtn.click()
    await expect(xPaddingValue).toHaveText('6 pt')
  })

  test('toggles "Always Print" checkbox', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Find the always print checkbox
    const alwaysPrintCheckbox = page.getByTestId('always-print-checkbox')
    await expect(alwaysPrintCheckbox).not.toBeChecked()

    // Click to check
    await alwaysPrintCheckbox.click()
    await expect(alwaysPrintCheckbox).toBeChecked()

    // Click to uncheck
    await alwaysPrintCheckbox.click()
    await expect(alwaysPrintCheckbox).not.toBeChecked()
  })

  test('saves receipt configuration', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Select a printer
    const printerSelect = page.locator('.printer-settings-modal__select').first()
    await printerSelect.selectOption('Network Printer')

    // Update store name
    const storeNameInput = page.locator('.printer-settings-modal__text-input').nth(0)
    await storeNameInput.fill('Updated Store Name')

    // Update footer message
    const footerInput = page.locator('.printer-settings-modal__text-input').nth(1)
    await footerInput.fill('Updated Footer')

    // Click Save Settings button
    await page.locator('button:has-text("Save Settings")').click()

    // Success modal should appear
    await expect(page.getByRole('heading', { name: 'Printer Settings Saved' })).toBeVisible()
    await expect(
      page.getByText('Receipt printer and layout settings were saved successfully.')
    ).toBeVisible()
  })

  test('print sample button disabled state changes based on printer selection', async ({
    page
  }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // With a default printer selected, check button state
    const printSampleBtn = page.locator('button:has-text("Print Sample")')
    const printerSelect = page.locator('.printer-settings-modal__select').first()

    // Select an empty printer (fallback to first option which is blank)
    await printerSelect.selectOption('')

    // After deselecting, button should be disabled
    await expect(printSampleBtn).toBeDisabled()
  })

  test('print sample button is enabled when printer is connected', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Select a connected printer
    const printerSelect = page.locator('.printer-settings-modal__select').first()
    await printerSelect.selectOption('USB Printer')

    // Wait for status to update
    await page.waitForTimeout(500)

    // Print Sample button should now be enabled
    const printSampleBtn = page.locator('button:has-text("Print Sample")')
    await expect(printSampleBtn).not.toBeDisabled()
  })

  test('allows selecting different sample receipt types', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Select a printer first
    const printerSelect = page.locator('.printer-settings-modal__select').first()
    await printerSelect.selectOption('USB Printer')

    // Find the sample type selector (second select in the modal)
    const sampleSelect = page.locator('.printer-settings-modal__select').nth(1)

    // Should have different sample options available
    await expect(sampleSelect.locator('option[value="basic"]')).toHaveCount(1)
    await expect(sampleSelect.locator('option[value="with-promo"]')).toHaveCount(1)
    await expect(sampleSelect.locator('option[value="many-items"]')).toHaveCount(1)
    await expect(sampleSelect.locator('option[value="with-message"]')).toHaveCount(1)

    // Can select different options
    await sampleSelect.selectOption('with-promo')
    await expect(sampleSelect).toHaveValue('with-promo')
  })

  test('resets all settings to defaults', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Make some changes
    const storeNameInput = page.locator('.printer-settings-modal__text-input').nth(0)
    await storeNameInput.fill('Test Store')

    // Increment font size
    const fontStepper = page.locator('.printer-settings-modal__stepper').first()
    const incrementBtn = fontStepper.locator('button').nth(1)
    await incrementBtn.click()

    // Check always print
    await page.getByTestId('always-print-checkbox').click()

    // Click Reset to Defaults
    await page.locator('button:has-text("Reset to Defaults")').click()

    // Values should reset
    await expect(storeNameInput).toHaveValue('')
    await expect(
      page
        .locator('.printer-settings-modal__stepper')
        .first()
        .locator('.printer-settings-modal__stepper-value')
    ).toHaveText('10 pt')
    await expect(page.getByTestId('always-print-checkbox')).not.toBeChecked()
  })

  test('closes modal with dismiss button', async ({ page }) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('printer-settings-btn').click()

    // Modal should be visible
    await expect(page.getByRole('heading', { name: 'Printer Settings' })).toBeVisible()

    // Click Dismiss button
    await page.locator('button:has-text("Dismiss")').click()

    // Modal should be closed
    await expect(page.getByRole('heading', { name: 'Printer Settings' })).not.toBeVisible()
  })
})
