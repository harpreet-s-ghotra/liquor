import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const attachPurchaseOrdersMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const now = (): string => new Date('2026-04-23T18:00:00.000Z').toISOString()

    const distributors = [
      {
        distributor_number: 1,
        distributor_name: 'Alpha Wine',
        license_id: null,
        serial_number: null,
        premises_name: null,
        premises_address: null,
        is_active: 1
      }
    ]

    const catalogProducts = [
      {
        id: 10,
        sku: 'ALPHA-001',
        name: 'Cabernet Sauvignon 750ml',
        size: '750mL',
        price: 18.99,
        quantity: 5,
        tax_rate: 0.13,
        bottles_per_case: 12,
        distributor_number: 1,
        distributor_name: 'Alpha Wine'
      },
      {
        id: 20,
        sku: 'ALPHA-002',
        name: 'Merlot Reserve',
        size: '750mL',
        price: 16.49,
        quantity: 9,
        tax_rate: 0.13,
        bottles_per_case: 6,
        distributor_number: 1,
        distributor_name: 'Alpha Wine'
      }
    ]

    const purchaseOrderDetails = {
      1: {
        id: 1,
        po_number: 'PO-2026-04-0001',
        distributor_number: 1,
        distributor_name: 'Alpha Wine',
        status: 'submitted',
        notes: 'Rush order',
        subtotal: 96,
        total: 96,
        item_count: 1,
        received_at: null,
        created_at: '2026-04-20T12:00:00.000Z',
        updated_at: '2026-04-20T12:00:00.000Z',
        items: [
          {
            id: 101,
            po_id: 1,
            product_id: 10,
            sku: 'ALPHA-001',
            product_name: 'Cabernet Sauvignon 750ml',
            unit_cost: 8,
            bottles_per_case: 12,
            quantity_ordered: 12,
            quantity_received: 6,
            line_total: 96
          }
        ]
      },
      2: {
        id: 2,
        po_number: 'PO-2026-04-0002',
        distributor_number: 1,
        distributor_name: 'Alpha Wine',
        status: 'received',
        notes: null,
        subtotal: 60,
        total: 60,
        item_count: 1,
        received_at: '2026-04-19T14:30:00.000Z',
        created_at: '2026-04-19T10:00:00.000Z',
        updated_at: '2026-04-19T14:30:00.000Z',
        items: [
          {
            id: 201,
            po_id: 2,
            product_id: 20,
            sku: 'ALPHA-002',
            product_name: 'Merlot Reserve',
            unit_cost: 5,
            bottles_per_case: 6,
            quantity_ordered: 12,
            quantity_received: 12,
            line_total: 60
          }
        ]
      }
    } satisfies Record<number, Record<string, unknown>>

    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

    const recalcDetail = (detail: Record<string, unknown>): void => {
      const items = detail.items as Array<Record<string, number | string>>
      detail.subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0)
      detail.total = detail.subtotal
      detail.item_count = items.length
      const fullyReceived = items.every(
        (item) => Number(item.quantity_received) >= Number(item.quantity_ordered)
      )
      detail.status = fullyReceived ? 'received' : 'submitted'
      detail.received_at = fullyReceived ? now() : null
      detail.updated_at = now()
    }

    const purchaseOrders = (): Array<Record<string, unknown>> =>
      Object.values(purchaseOrderDetails).map((detail) => {
        const { items: _items, ...summary } = detail
        return clone(summary)
      })

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
        catalogProducts.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: 'Wine',
          price: product.price,
          quantity: product.quantity,
          tax_rate: product.tax_rate,
          bottles_per_case: product.bottles_per_case
        })),
      getActiveSpecialPricing: async () => [],
      getItemTypes: async () => [],
      getTaxCodes: async () => [],
      getInventoryTaxCodes: async () => [],
      getDistributors: async () => distributors,
      getReorderDistributors: async () => [],
      getReorderProducts: async () => [],
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

      searchProducts: async (query: string, filters?: { distributorNumber?: number }) => {
        const normalized = query.trim().toLowerCase()
        return catalogProducts.filter((product) => {
          const distributorMatches =
            filters?.distributorNumber == null ||
            product.distributor_number === filters.distributorNumber

          if (!distributorMatches) return false
          if (!normalized) return true

          return (
            product.name.toLowerCase().includes(normalized) ||
            product.sku.toLowerCase().includes(normalized)
          )
        })
      },

      getPurchaseOrders: async () => purchaseOrders(),
      getPurchaseOrderDetail: async (id: number) => clone(purchaseOrderDetails[id] ?? null),
      createPurchaseOrder: async (input: {
        distributor_number: number
        notes?: string
        items: Array<{ product_id: number; quantity_ordered: number; unit_cost: number }>
      }) => {
        const nextId = Object.keys(purchaseOrderDetails).length + 1
        const items = input.items.map((item, index) => {
          const product = catalogProducts.find((entry) => entry.id === item.product_id)
          return {
            id: nextId * 100 + index + 1,
            po_id: nextId,
            product_id: item.product_id,
            sku: product?.sku ?? `SKU-${item.product_id}`,
            product_name: product?.name ?? `Product ${item.product_id}`,
            unit_cost: item.unit_cost,
            bottles_per_case: product?.bottles_per_case ?? 1,
            quantity_ordered: item.quantity_ordered,
            quantity_received: 0,
            line_total: Number((item.unit_cost * item.quantity_ordered).toFixed(2))
          }
        })
        const detail = {
          id: nextId,
          po_number: `PO-2026-04-000${nextId}`,
          distributor_number: input.distributor_number,
          distributor_name: 'Alpha Wine',
          status: 'draft',
          notes: input.notes ?? null,
          subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
          total: items.reduce((sum, item) => sum + item.line_total, 0),
          item_count: items.length,
          received_at: null,
          created_at: now(),
          updated_at: now(),
          items
        }
        purchaseOrderDetails[nextId as keyof typeof purchaseOrderDetails] = detail
        return clone(detail)
      },
      updatePurchaseOrder: async (input: { id: number; status: string }) => {
        const detail = purchaseOrderDetails[input.id as keyof typeof purchaseOrderDetails]
        if (!detail) return null
        detail.status = input.status
        detail.updated_at = now()
        return clone(detail)
      },
      updatePurchaseOrderItems: async (input: {
        po_id: number
        lines: Array<{
          id: number
          unit_cost?: number
          quantity_ordered?: number
          quantity_received?: number
        }>
      }) => {
        const detail = purchaseOrderDetails[input.po_id as keyof typeof purchaseOrderDetails]
        if (!detail) return null
        for (const line of input.lines) {
          const item = (detail.items as Array<Record<string, number | string>>).find(
            (entry) => Number(entry.id) === line.id
          )
          if (!item) continue
          if (line.unit_cost !== undefined) item.unit_cost = line.unit_cost
          if (line.quantity_ordered !== undefined) item.quantity_ordered = line.quantity_ordered
          if (line.quantity_received !== undefined) item.quantity_received = line.quantity_received
          item.line_total = Number(
            (Number(item.unit_cost) * Number(item.quantity_ordered)).toFixed(2)
          )
        }
        recalcDetail(detail)
        return clone(detail)
      },
      markPurchaseOrderReceived: async (poId: number) => {
        const detail = purchaseOrderDetails[poId as keyof typeof purchaseOrderDetails]
        if (!detail) return null
        for (const item of detail.items as Array<Record<string, number | string>>) {
          item.quantity_received = Number(item.quantity_ordered)
        }
        recalcDetail(detail)
        return clone(detail)
      },
      receivePurchaseOrderItem: async (input: { id: number; quantity_received: number }) => {
        const detail = Object.values(purchaseOrderDetails).find((entry) =>
          (entry.items as Array<Record<string, number | string>>).some(
            (item) => Number(item.id) === input.id
          )
        )
        if (!detail) return null
        const item = (detail.items as Array<Record<string, number | string>>).find(
          (entry) => Number(entry.id) === input.id
        )
        if (!item) return null
        item.quantity_received = input.quantity_received
        recalcDetail(detail)
        return clone(item)
      },
      addPurchaseOrderItem: async () => ({ id: 999 }),
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

test.describe('Purchase Orders', () => {
  test.beforeEach(async ({ page }) => {
    await attachPurchaseOrdersMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await page.getByRole('button', { name: 'F2 Inventory' }).click()
    await page.getByRole('tab', { name: 'Purchase Orders' }).click()
    await page.locator('.po-panel').waitFor({ state: 'visible' })
  })

  test('marks a submitted purchase order fully received', async ({ page }) => {
    await page.getByText('PO-2026-04-0001').click()
    await page.getByRole('button', { name: 'Mark Fully Received' }).click()
    await page.getByRole('button', { name: 'Mark Received' }).click()

    await expect(page.locator('.po-panel__badge')).toContainText('received')
    await expect(page.getByText('12 / 12')).toBeVisible()
  })

  test('editing a received purchase order can reduce received units back to submitted', async ({
    page
  }) => {
    await page.getByText('PO-2026-04-0002').click()
    await page.getByRole('button', { name: 'Edit' }).click()

    const receivedInput = page.getByLabel('Quantity received for Merlot Reserve')
    await receivedInput.fill('6')
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(
      page.getByText('This will reduce on-hand stock by 6 units. Continue?')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Save Changes' }).last().click()

    await expect(page.locator('.po-panel__badge')).toContainText('submitted')
    await expect(page.getByLabel('Units received for Merlot Reserve')).toHaveValue('6')
  })

  test('new orders derive unit cost from case cost and preserve totals', async ({ page }) => {
    await page.getByRole('button', { name: 'New Order' }).click()
    await page.locator('.po-panel__create-select').selectOption('1')

    const searchInput = page.getByLabel('Search products to add')
    await searchInput.fill('Cabernet')
    await page.getByRole('option', { name: /cabernet sauvignon 750ml/i }).click()

    const caseCostInput = page.getByLabel('Case cost for Cabernet Sauvignon 750ml')
    await caseCostInput.fill('120')
    await expect(page.getByLabel('Unit cost for Cabernet Sauvignon 750ml')).toHaveValue('10')

    await page.getByRole('button', { name: 'Create Order' }).click()

    await expect(page.locator('.po-panel__badge')).toContainText('draft')
    await expect(page.getByText('Total: $120.00')).toBeVisible()
  })
})
