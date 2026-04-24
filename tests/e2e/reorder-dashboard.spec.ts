import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachReorderDashboardMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const distributors = [
      { distributor_number: 1, distributor_name: 'Alpha Wine', product_count: 2 },
      { distributor_number: 2, distributor_name: 'Beta Spirits', product_count: 1 }
    ]

    const reorderProducts = [
      {
        id: 1,
        sku: 'ALPHA-001',
        name: 'Cabernet Sauvignon 750ml',
        item_type: 'Wine',
        in_stock: 2,
        reorder_point: 10,
        distributor_number: 1,
        distributor_name: 'Alpha Wine',
        cost: 11.5,
        bottles_per_case: 12,
        price: 18.99,
        velocity_per_day: 0.63,
        days_of_supply: 3.2,
        projected_stock: -16.9
      },
      {
        id: 2,
        sku: 'ALPHA-002',
        name: 'Sparkling Brut',
        item_type: 'Sparkling',
        in_stock: 8,
        reorder_point: 12,
        distributor_number: 1,
        distributor_name: 'Alpha Wine',
        cost: 9,
        bottles_per_case: 6,
        price: 20.49,
        velocity_per_day: 0.2,
        days_of_supply: 40,
        projected_stock: 2
      }
    ]

    const purchaseOrders: Array<Record<string, unknown>> = []

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

      getProducts: async () =>
        reorderProducts.map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.item_type ?? 'General',
          price: item.price,
          quantity: item.in_stock,
          tax_rate: 0.13,
          bottles_per_case: item.bottles_per_case
        })),
      getActiveSpecialPricing: async () => [],
      getItemTypes: async () => [],
      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],

      getDistributors: async () =>
        distributors.map((dist) => ({
          distributor_number: dist.distributor_number,
          distributor_name: dist.distributor_name,
          license_id: null,
          serial_number: null,
          premises_name: null,
          premises_address: null,
          is_active: 1
        })),

      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => ({ item_number: 1 }),

      getReorderDistributors: async () => distributors,
      getReorderProducts: async (query: {
        distributor: number | 'unassigned'
        unit_threshold: number
        window_days: number
      }) => ({
        rows: reorderProducts.filter(
          (item) =>
            item.distributor_number === query.distributor &&
            item.projected_stock < query.unit_threshold
        ),
        velocityOffline: false
      }),
      setProductDiscontinued: async () => {},

      listRegisters: async () => [],
      renameRegister: async () => ({}),
      deleteRegister: async () => ({}),
      createCashier: async () => ({}),
      updateCashier: async () => ({}),
      deleteCashier: async () => ({}),
      getFinixMerchantStatus: async () => ({
        merchant_name: 'Test Liquor Store',
        merchant_id: 'MU-test-merchant-id',
        processing_enabled: true
      }),

      getPurchaseOrders: async () => purchaseOrders,
      getPurchaseOrderDetail: async () => null,
      createPurchaseOrder: async (input: Record<string, unknown>) => {
        const created = {
          id: 1,
          po_number: 'PO-2026-04-9999',
          distributor_number: input.distributor_number,
          distributor_name: 'Alpha Wine',
          status: 'draft',
          notes: input.notes ?? null,
          subtotal: 0,
          total: 0,
          item_count: Array.isArray(input.items) ? input.items.length : 0,
          received_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: []
        }
        purchaseOrders.push(created)
        return created
      },
      updatePurchaseOrder: async () => ({ status: 'submitted' }),
      receivePurchaseOrderItem: async () => ({ id: 1, quantity_received: 1 }),
      addPurchaseOrderItem: async () => ({ id: 1 }),
      removePurchaseOrderItem: async () => undefined,
      deletePurchaseOrder: async () => undefined
    }
  })
}

const loginWithPin = async (page: Page): Promise<void> => {
  const readyState = await Promise.race([
    page
      .locator('.ticket-panel')
      .waitFor({ state: 'visible', timeout: 12000 })
      .then(() => 'pos'),
    page
      .locator('.pin-key')
      .first()
      .waitFor({ state: 'visible', timeout: 12000 })
      .then(() => 'pin')
  ])

  if (readyState === 'pos') return

  for (const digit of ['1', '2', '3', '4']) {
    await page.locator(`.pin-key:text("${digit}")`).click()
  }

  await page.locator('.ticket-panel').waitFor({ state: 'visible', timeout: 10000 })
}

test.describe('Reorder -> Purchase Order Flow', () => {
  test('create order switches to Purchase Orders with distributor preselected', async ({
    page
  }) => {
    await attachReorderDashboardMock(page)
    await page.goto('/')
    await loginWithPin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await page.getByRole('tab', { name: 'Reorder' }).click()
    await page.locator('.reorder-dashboard').waitFor({ state: 'visible' })

    await page.getByRole('button', { name: 'Create Order' }).click()

    await expect(page.getByRole('tab', { name: 'Purchase Orders' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByText('New Purchase Order')).toBeVisible()
    await expect(page.locator('.po-panel__create-select')).toHaveValue('1')
  })

  test('prefilled cost comes from product and is editable', async ({ page }) => {
    await attachReorderDashboardMock(page)
    await page.goto('/')
    await loginWithPin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await page.getByRole('tab', { name: 'Reorder' }).click()
    await page.locator('.reorder-dashboard').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Create Order' }).click()

    const costInput = page.getByLabel('Unit cost for Cabernet Sauvignon 750ml')
    await expect(costInput).toHaveValue('11.5')

    await costInput.fill('13.25')
    await expect(costInput).toHaveValue('13.25')
  })

  test('purchase create view shows headers and case-based item math', async ({ page }) => {
    await attachReorderDashboardMock(page)
    await page.goto('/')
    await loginWithPin(page)

    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await page.getByRole('tab', { name: 'Reorder' }).click()
    await page.locator('.reorder-dashboard').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Create Order' }).click()

    await expect(page.locator('.po-panel__create-items-header').getByText('Cases')).toBeVisible()
    await expect(page.locator('.po-panel__create-items-header').getByText('Items')).toBeVisible()
    const casesInput = page.getByLabel('Cases for Cabernet Sauvignon 750ml')
    await expect(casesInput).toHaveValue('3')

    await casesInput.fill('2')
    await expect(page.locator('.po-panel__create-item-units').first()).toHaveText('24')
  })
})
