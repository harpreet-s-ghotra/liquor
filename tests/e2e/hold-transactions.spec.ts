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
    const heldTransactions: Array<Record<string, unknown>> = []
    let nextHoldNumber = 1

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
        throw new Error('Not implemented in hold-transactions mock')
      },

      finixChargeCard: async (input: { total: number; card_number?: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return {
          authorization_id: `AU-${Date.now()}`,
          transfer_id: `TR-${Date.now()}`,
          success: true,
          last_four: input.card_number?.slice(-4) ?? '4242',
          card_type: input.card_number === '5555555555554444' ? 'mastercard' : 'visa',
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
      getRecentTransactions: async () => [...savedTransactions].reverse(),

      saveHeldTransaction: async (input: Record<string, unknown>) => {
        const desc = (input.description as string | null | undefined) ?? null
        const held = {
          id: heldTransactions.length + 1,
          hold_number: nextHoldNumber++,
          cart_snapshot: JSON.stringify(input.cart),
          transaction_discount_percent: input.transactionDiscountPercent ?? 0,
          subtotal: input.subtotal,
          total: input.total,
          item_count: (input.cart as Array<{ lineQuantity: number }>).reduce(
            (s, i) => s + i.lineQuantity,
            0
          ),
          description: desc && desc.trim() ? desc.trim() : null,
          held_at: new Date().toISOString()
        }
        heldTransactions.push(held)
        return held
      },
      getHeldTransactions: async () => [...heldTransactions],
      deleteHeldTransaction: async (id: number) => {
        const idx = heldTransactions.findIndex((h) => h.id === id)
        if (idx !== -1) heldTransactions.splice(idx, 1)
      },
      clearAllHeldTransactions: async () => {
        heldTransactions.length = 0
      }
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

const selectAllCategory = async (page: Page): Promise<void> => {
  await page.locator('.action-panel__category-trigger').click()
  await page.locator('.action-panel__category-item', { hasText: 'All' }).click()
}

/** Add the first product from the "All" category to the cart */
const addProductToCart = async (page: Page): Promise<void> => {
  await selectAllCategory(page)
  await page.locator('.action-panel__product-tile').first().click()
}

/** Click Hold and submit the description prompt with the (optional) note. */
const holdCart = async (page: Page, description = ''): Promise<void> => {
  await page.getByTestId('hold-btn').click()
  const promptInput = page.getByTestId('prompt-dialog-input')
  await promptInput.waitFor({ state: 'visible' })
  if (description) await promptInput.fill(description)
  await page.getByTestId('prompt-dialog-confirm-btn').click()
  await promptInput.waitFor({ state: 'detached' })
}

test.describe('Hold Transactions', () => {
  test('Hold button is disabled when cart is empty', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const holdBtn = page.getByTestId('hold-btn')
    await expect(holdBtn).toBeDisabled()
  })

  test('TS Lookup button is always enabled', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const tsLookupBtn = page.getByTestId('ts-lookup-btn')
    await expect(tsLookupBtn).toBeEnabled()
  })

  test('Hold button becomes enabled after adding an item', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await expect(page.getByTestId('hold-btn')).toBeEnabled()
  })

  test('Hold saves cart and clears it; TS Lookup badge shows 1', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Verify item is in ticket before hold
    await expect(page.locator('.ticket-panel__line').first()).toBeVisible()

    // Click Hold
    await holdCart(page)

    // Cart should be empty after hold
    await expect(page.getByTestId('hold-btn')).toBeDisabled()

    // TS Lookup badge should show "1"
    const badge = page.getByTestId('ts-lookup-btn').locator('span')
    await expect(badge).toHaveText('1')
  })

  test('Hold description typed in the prompt surfaces on the lookup row', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await holdCart(page, "Mike's pickup")

    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByTestId('hold-description-1')).toHaveText("Mike's pickup")
  })

  test('Hold without a description hides the description chip on the lookup row', async ({
    page
  }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await holdCart(page) // blank

    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByTestId('hold-row-1')).toBeVisible()
    await expect(page.getByTestId('hold-description-1')).toHaveCount(0)
  })

  test('TS Lookup modal shows "No transactions on hold" when empty', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.getByTestId('ts-lookup-btn').click()

    await expect(page.getByTestId('hold-lookup-empty')).toBeVisible()
    await expect(page.getByText('No transactions on hold.')).toBeVisible()
  })

  test('Recalling a held transaction restores the cart and closes modal', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Hold the transaction
    await holdCart(page)

    // Open TS Lookup
    await page.getByTestId('ts-lookup-btn').click()

    // Hold #1 row should be visible
    const holdRow = page.getByTestId('hold-row-1')
    await expect(holdRow).toBeVisible()
    await expect(holdRow).toContainText('Hold #1')

    // Click it to recall
    await holdRow.click()

    // Modal should close and cart should be restored
    await expect(page.getByText('Transaction Hold Lookup')).not.toBeVisible()
    await expect(page.getByTestId('hold-btn')).toBeEnabled()

    // Badge should disappear after recall
    const badge = page.getByTestId('ts-lookup-btn').locator('span')
    await expect(badge).not.toBeVisible()
  })

  test('Recalling while cart is non-empty auto-holds current cart', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Add product A and hold it (becomes Hold #1)
    await addProductToCart(page)
    await holdCart(page)

    // Add product B (a different product) — now in cart
    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').nth(1).click()

    // TS Lookup should show badge "1" (Hold #1 is waiting)
    await expect(page.getByTestId('ts-lookup-btn').locator('span')).toHaveText('1')

    // Open TS Lookup and recall Hold #1
    await page.getByTestId('ts-lookup-btn').click()
    await page.getByTestId('hold-row-1').click()

    // Product B should now be on hold as Hold #2, badge shows "1"
    const badge = page.getByTestId('ts-lookup-btn').locator('span')
    await expect(badge).toHaveText('1')

    // Cart now has product A
    await expect(page.getByTestId('hold-btn')).toBeEnabled()
  })

  test('Multiple holds are listed in order with correct hold numbers', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Hold #1
    await addProductToCart(page)
    await holdCart(page)

    // Hold #2
    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').nth(1).click()
    await holdCart(page)

    // Open TS Lookup — should show both
    await page.getByTestId('ts-lookup-btn').click()

    await expect(page.getByTestId('hold-row-1')).toBeVisible()
    await expect(page.getByTestId('hold-row-2')).toBeVisible()
    await expect(page.getByText('Hold #1')).toBeVisible()
    await expect(page.getByText('Hold #2')).toBeVisible()
  })

  test('TS Lookup modal closes on Escape', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByText('Transaction Hold Lookup')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByText('Transaction Hold Lookup')).not.toBeVisible()
  })

  test('Recalled cart shows the original item name in the ticket', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Add a specific product and hold
    await selectAllCategory(page)
    const productName = await page
      .locator('.action-panel__product-tile')
      .first()
      .locator('span')
      .first()
      .innerText()
    await page.locator('.action-panel__product-tile').first().click()
    await holdCart(page)

    // Recall it
    await page.getByTestId('ts-lookup-btn').click()
    await page.getByTestId('hold-row-1').click()

    // The product name should appear in the ticket
    await expect(
      page.locator('.ticket-panel__line', { hasText: productName }).first()
    ).toBeVisible()
  })

  test('Hold preserves item quantity and total is restored after recall', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Set quantity to 3 before adding
    const qtyInput = page.locator('input[placeholder="Qty"]')
    await qtyInput.fill('3')

    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').first().click()

    // Capture the total before hold
    const totalBefore = await page.locator('.grand-total strong').innerText()

    // Hold
    await holdCart(page)

    // Cart should be empty, total should be $0.00
    await expect(page.locator('.grand-total strong')).toHaveText('$0.00')

    // Recall
    await page.getByTestId('ts-lookup-btn').click()
    await page.getByTestId('hold-row-1').click()

    // Total should be restored
    await expect(page.locator('.grand-total strong')).toHaveText(totalBefore)
  })

  test('Selective recall: hold A, hold B, recall B, A remains on hold', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Hold product A (Hold #1)
    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').first().click()
    await holdCart(page)

    // Hold product B (Hold #2)
    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').nth(1).click()
    await holdCart(page)

    // Badge should show 2
    await expect(page.getByTestId('ts-lookup-btn').locator('span')).toHaveText('2')

    // Open TS Lookup, recall Hold #2 only
    await page.getByTestId('ts-lookup-btn').click()
    await page.getByTestId('hold-row-2').click()

    // Badge should show 1 (Hold #1 still on hold)
    await expect(page.getByTestId('ts-lookup-btn').locator('span')).toHaveText('1')

    // Open TS Lookup again — Hold #1 should still be there
    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByTestId('hold-row-1')).toBeVisible()
    await expect(page.getByText('Hold #1')).toBeVisible()
  })

  test('Delete button removes a single held transaction', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Hold two transactions
    await addProductToCart(page)
    await holdCart(page)

    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').nth(1).click()
    await holdCart(page)

    // Badge shows 2
    await expect(page.getByTestId('ts-lookup-btn').locator('span')).toHaveText('2')

    // Open TS Lookup and delete Hold #1
    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByTestId('hold-row-1')).toBeVisible()
    await page.getByTestId('hold-delete-1').click()
    // Confirm dialog now stands between the trash icon and the actual delete.
    await page.getByTestId('confirm-dialog-confirm-btn').click()

    // Hold #1 should be gone, Hold #2 remains
    await expect(page.getByTestId('hold-row-1')).not.toBeVisible()
    await expect(page.getByTestId('hold-row-2')).toBeVisible()
  })

  test('Clear All button removes all held transactions', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Hold two transactions
    await addProductToCart(page)
    await holdCart(page)

    await selectAllCategory(page)
    await page.locator('.action-panel__product-tile').nth(1).click()
    await holdCart(page)

    // Badge shows 2
    await expect(page.getByTestId('ts-lookup-btn').locator('span')).toHaveText('2')

    // Open TS Lookup and click Clear All
    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByTestId('hold-clear-all-btn')).toBeVisible()
    await page.getByTestId('hold-clear-all-btn').click()
    await page.getByTestId('confirm-dialog-confirm-btn').click()

    // Should show empty state
    await expect(page.getByTestId('hold-lookup-empty')).toBeVisible()
    await expect(page.getByText('No transactions on hold.')).toBeVisible()
  })

  test('Clear All button is not visible when no holds exist', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    await page.getByTestId('ts-lookup-btn').click()
    await expect(page.getByTestId('hold-lookup-empty')).toBeVisible()
    await expect(page.getByTestId('hold-clear-all-btn')).not.toBeVisible()
  })

  test('Badge disappears after Clear All', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Hold one transaction
    await addProductToCart(page)
    await holdCart(page)

    await expect(page.getByTestId('ts-lookup-btn').locator('span')).toHaveText('1')

    // Open TS Lookup and Clear All
    await page.getByTestId('ts-lookup-btn').click()
    await page.getByTestId('hold-clear-all-btn').click()
    await page.getByTestId('confirm-dialog-confirm-btn').click()

    // Close modal
    await page.keyboard.press('Escape')

    // Badge should be gone
    const badge = page.getByTestId('ts-lookup-btn').locator('span')
    await expect(badge).not.toBeVisible()
  })
})
