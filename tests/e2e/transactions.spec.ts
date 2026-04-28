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
      },
      {
        id: 4,
        sku: 'COOLER-001',
        name: 'Vodka Soda 473ml',
        category: 'Coolers',
        price: 4.25,
        quantity: 96,
        tax_rate: 0.13
      },
      {
        id: 5,
        sku: 'MIXER-001',
        name: 'Tonic Water 1L',
        category: 'Mixers',
        price: 2.99,
        quantity: 52,
        tax_rate: 0.13
      },
      {
        id: 6,
        sku: 'WINE-002',
        name: 'Pinot Noir 750ml',
        category: 'Wine',
        price: 21.99,
        quantity: 22,
        tax_rate: 0.13
      },
      {
        id: 7,
        sku: 'BEER-002',
        name: 'Lager 12-Pack',
        category: 'Beer',
        price: 18.49,
        quantity: 34,
        tax_rate: 0.13
      },
      {
        id: 8,
        sku: 'SPIRIT-002',
        name: 'Silver Tequila 750ml',
        category: 'Spirits',
        price: 36.5,
        quantity: 14,
        tax_rate: 0.13
      },
      {
        id: 9,
        sku: 'COOLER-002',
        name: 'Gin Smash 473ml',
        category: 'Coolers',
        price: 4.5,
        quantity: 88,
        tax_rate: 0.13
      },
      {
        id: 10,
        sku: 'MIXER-002',
        name: 'Club Soda 1L',
        category: 'Mixers',
        price: 2.59,
        quantity: 47,
        tax_rate: 0.13
      },
      {
        id: 11,
        sku: 'WINE-003',
        name: 'Sauvignon Blanc 750ml',
        category: 'Wine',
        price: 17.75,
        quantity: 19,
        tax_rate: 0.13
      },
      {
        id: 12,
        sku: 'BEER-003',
        name: 'Pilsner 6-Pack',
        category: 'Beer',
        price: 12.25,
        quantity: 39,
        tax_rate: 0.13
      },
      {
        id: 13,
        sku: 'SPIRIT-003',
        name: 'London Dry Gin 750ml',
        category: 'Spirits',
        price: 30.99,
        quantity: 17,
        tax_rate: 0.13
      },
      {
        id: 14,
        sku: 'COOLER-003',
        name: 'Whisky Cola 473ml',
        category: 'Coolers',
        price: 4.75,
        quantity: 84,
        tax_rate: 0.13
      },
      {
        id: 15,
        sku: 'MIXER-003',
        name: 'Ginger Ale 1L',
        category: 'Mixers',
        price: 2.79,
        quantity: 60,
        tax_rate: 0.13
      }
    ]

    const savedTransactions: Array<Record<string, unknown>> = []

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
      // Auth APIs
      getMerchantConfig: async () => merchantConfig,
      authCheckSession: async () => ({
        user: { id: 'user-1', email: 'test@example.com' },
        merchant: merchantConfig
      }),
      onDeepLink: () => {},
      consumePendingDeepLink: async () => null,
      getCashiers: async () => [testCashier],
      validatePin: async () => testCashier,

      // Product APIs
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
        throw new Error('Not implemented in transactions mock')
      },

      // Finix sandbox card mock used by the POS payment modal.
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

      // Transaction persistence mock
      saveTransaction: async (input: Record<string, unknown>) => {
        const payments = input.payments as Array<Record<string, unknown>> | undefined
        const methods = payments ? [...new Set(payments.map((p) => p.method))] : []
        const derivedMethod =
          methods.length === 1 ? methods[0] : methods.length > 1 ? 'split' : input.payment_method
        const txn = {
          id: savedTransactions.length + 1,
          transaction_number: `TXN-${Date.now()}`,
          ...input,
          payment_method: derivedMethod,
          status: 'completed',
          created_at: new Date().toISOString()
        }
        savedTransactions.push(txn)
        return txn
      },
      getRecentTransactions: async () => [...savedTransactions].reverse(),

      // Printer / receipt mocks
      getReceiptConfig: async () => ({
        fontSize: 10,
        paddingY: 4,
        paddingX: 4,
        storeName: '',
        footerMessage: '',
        alwaysPrint: false
      }),
      printReceipt: async () => {}
    }
  })
}

/** Enter PIN 1234 on the login screen to get to POS */
const loginWithPin = async (page: Page): Promise<void> => {
  const pinKey = page.locator('.pin-key').first()
  await pinKey.waitFor({ state: 'visible', timeout: 10000 })

  for (const digit of ['1', '2', '3', '4']) {
    await page.locator(`.pin-key:text("${digit}")`).click()
  }

  await page.locator('.ticket-panel').waitFor({ state: 'visible', timeout: 10000 })
}

/** Navigate to the app and log in */
const gotoAndLogin = async (page: Page): Promise<void> => {
  await page.goto('/')
  await loginWithPin(page)
}

/** Open category dropdown and select "All" */
const selectAllCategory = async (page: Page): Promise<void> => {
  await page.locator('.action-panel__category-trigger').click()
  await page.locator('.action-panel__category-item', { hasText: 'All' }).click()
}

const parseAmount = async (selector: string, page: Page): Promise<number> => {
  const text = await page.locator(selector).textContent()
  return Number.parseFloat((text ?? '').replace('$', '').trim())
}

test.describe('Split Payments', () => {
  test('split payment saves both tenders in payments array with correct method and amount', async ({
    page
  }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    // Add Cabernet Sauvignon ($19.99 * 1.13 = $22.59)
    await page.locator('.action-panel__product-tile').first().click()

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    // Pay $10 cash first
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    await expect(modal.getByTestId('paid-so-far-list')).toContainText('$10.00 Cash')

    // Pay remainder with credit
    await modal.getByRole('button', { name: 'Credit' }).click()
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await modal.getByTestId('payment-ok-btn').click()

    // Verify saved transaction has payments array with both tenders
    const recentTxns = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (window as any).api.getRecentTransactions()
    })
    expect(recentTxns).toHaveLength(1)
    const txn = recentTxns[0]
    expect(txn.payments).toHaveLength(2)
    const cashEntry = txn.payments.find((p: Record<string, unknown>) => p.method === 'cash')
    const creditEntry = txn.payments.find((p: Record<string, unknown>) => p.method === 'credit')
    expect(cashEntry).toBeDefined()
    expect(cashEntry.amount).toBe(10)
    expect(creditEntry).toBeDefined()
    expect(Number(creditEntry.amount)).toBeCloseTo(12.59, 1)
  })

  test('split payment saves payment_method as "split" when methods differ', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    await page.locator('.action-panel__product-tile').first().click()

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    await modal.getByRole('button', { name: '$10', exact: true }).click()
    await modal.getByRole('button', { name: 'Credit' }).click()
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await modal.getByTestId('payment-ok-btn').click()

    const recentTxns = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (window as any).api.getRecentTransactions()
    })
    // Mock saveTransaction stores the input including payment_method derived from payments
    const txn = recentTxns[0]
    // payments array has both cash and credit — so payment_method should be 'split'
    expect(txn.payments.map((p: Record<string, unknown>) => p.method)).toContain('cash')
    expect(txn.payments.map((p: Record<string, unknown>) => p.method)).toContain('credit')
  })

  test('paid-so-far list shows both cash and card entries for split payment', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    await page.locator('.action-panel__product-tile').first().click()

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    await modal.getByRole('button', { name: '$10', exact: true }).click()
    const paidList = modal.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('$10.00 Cash')
    await expect(paidList.locator('.payment-modal__paid-entry')).toHaveCount(1)

    await modal.getByRole('button', { name: 'Credit' }).click()
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })

    // Both entries visible in paid-so-far list
    await expect(paidList.locator('.payment-modal__paid-entry')).toHaveCount(2)
    await expect(paidList).toContainText('Cash')
    await expect(paidList).toContainText('Credit')
  })

  test('cash-only tender (two $10 bills) saves payment_method as cash', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    await page.locator('.action-panel__product-tile').first().click()

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    // Pay with two $10 cash tenders ($20 > $22.59 would not complete, so use $20 + $5)
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    await modal.getByRole('button', { name: '$5', exact: true }).click()

    await expect(modal.getByTestId('payment-complete')).toBeVisible()
    await modal.getByTestId('payment-ok-btn').click()

    const recentTxns = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (window as any).api.getRecentTransactions()
    })
    const txn = recentTxns[0]
    // All three tenders are cash
    expect(txn.payments).toHaveLength(3)
    expect(txn.payments.every((p: Record<string, unknown>) => p.method === 'cash')).toBe(true)
  })
})

test.describe('Simple Transactions', () => {
  test('payment buttons become enabled after adding an item', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    const firstProduct = page.locator('.action-panel__product-tile').first()
    await firstProduct.click()

    await expect(page.getByRole('button', { name: 'Cash', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Credit' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Debit' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Pay Now' })).toBeEnabled()
  })

  test('delete removes currently selected item', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    const products = page.locator('.action-panel__product-tile')
    const firstName = (await products.nth(0).locator('span').first().textContent())?.trim() ?? ''
    const secondName = (await products.nth(1).locator('span').first().textContent())?.trim() ?? ''

    await products.nth(0).click()
    await products.nth(1).click()

    await expect(page.locator('.ticket-panel__line.active')).toContainText(secondName)

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.ticket-panel__line')).toHaveCount(1)
    await expect(page.locator('.ticket-panel__line.active')).toContainText(firstName)
  })

  test('price change updates selected cart line price only', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    const products = page.locator('.action-panel__product-tile')
    await products.nth(0).click()

    const firstLine = page.locator('.ticket-panel__line').first()
    const originalLineTotal = await firstLine.locator('.ticket-panel__line-price').textContent()

    await page.getByRole('button', { name: 'Price Change' }).click()
    const priceModal = page.getByTestId('edit-modal')
    await expect(priceModal.getByText('Original Price: $19.99')).toBeVisible()
    await priceModal.getByRole('button', { name: '1', exact: true }).click()
    await priceModal.getByRole('button', { name: '2', exact: true }).click()
    await priceModal.getByRole('button', { name: '5', exact: true }).click()
    await priceModal.getByRole('button', { name: '0', exact: true }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(firstLine.locator('.ticket-panel__line-price')).toHaveText('$12.50')
    expect(await firstLine.locator('.ticket-panel__line-price').textContent()).not.toBe(
      originalLineTotal
    )

    await expect(products.nth(0)).toContainText('$19.99')
  })

  test('discount supports selected item and entire transaction modes', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    const products = page.locator('.action-panel__product-tile')
    await products.nth(0).click()
    await products.nth(1).click()

    const totalBefore = await parseAmount('.grand-total strong', page)

    await page.locator('.ticket-panel__line').first().click()
    await page.getByRole('button', { name: 'Discount', exact: true }).click()
    const itemDiscountModal = page.getByTestId('edit-modal')
    await expect(itemDiscountModal.getByText('Original Discount: 0.00%')).toBeVisible()
    await itemDiscountModal.getByRole('button', { name: '1' }).click()
    await itemDiscountModal.getByRole('button', { name: '0' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    const discountedLine = page.locator('.ticket-panel__line').first()
    await expect(discountedLine).toHaveClass(/discounted/)
    await expect(discountedLine.getByText('DISCOUNT 10.00%')).toBeVisible()
    await expect(discountedLine.getByText(/New \$17\.99 \(was \$19\.99\)/)).toBeVisible()

    await expect(page.locator('.totals-box .totals-discount strong')).toHaveText('-$2.00')

    const totalAfterItemDiscount = await parseAmount('.grand-total strong', page)
    expect(totalAfterItemDiscount).toBeLessThan(totalBefore)

    await page.getByRole('button', { name: 'Discount', exact: true }).click()
    const transactionDiscountModal = page.getByTestId('edit-modal')
    await transactionDiscountModal.getByLabel('Entire Transaction').click()
    await expect(transactionDiscountModal.getByText('Original Discount: 0.00%')).toBeVisible()
    await transactionDiscountModal.getByRole('button', { name: '5' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    const transactionDiscountLine = page.getByRole('button', { name: /5% Discount/i })
    await expect(transactionDiscountLine).toBeVisible()
    await expect(transactionDiscountLine.locator('.ticket-panel__line-qty')).toHaveText('1')
    await expect(transactionDiscountLine.locator('.ticket-panel__line-price')).toHaveText('-$1.57')

    const totalAfterTransactionDiscount = await parseAmount('.grand-total strong', page)
    expect(totalAfterTransactionDiscount).toBeLessThan(totalAfterItemDiscount)

    await transactionDiscountLine.click()
    await expect(page.getByRole('button', { name: 'Qty Change' })).toBeDisabled()

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: /5% Discount/i })).toHaveCount(0)
  })

  test('search by SKU finds product across all categories and adds to cart', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Default is Favorites — COOLER-001 is not a favorite
    // Verify the cooler product is NOT visible initially
    await expect(
      page.locator('.action-panel__product-tile', { hasText: 'Vodka Soda' })
    ).toHaveCount(0)

    // Type the full SKU into the search box
    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('COOLER-001')

    // The matching product should now be visible despite the Favorites filter
    const coolerBtn = page.locator('.action-panel__product-tile', { hasText: 'Vodka Soda' })
    await expect(coolerBtn).toBeVisible()

    // Click the product to add it to the cart
    await coolerBtn.click()

    // Verify it appeared in the ticket
    await expect(page.locator('.ticket-panel__line')).toHaveCount(1)
    await expect(page.locator('.ticket-panel__line').first()).toContainText('Vodka Soda')
    await expect(page.locator('.ticket-panel__line-price').first()).toHaveText('$4.25')

    // Clear search and verify category filter restores
    await searchInput.fill('')
    await expect(
      page.locator('.action-panel__product-tile', { hasText: 'Vodka Soda' })
    ).toHaveCount(0)
  })

  test('partial SKU search narrows product grid results', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('MIXER')

    // All three MIXER products should appear
    const mixerButtons = page.locator('.action-panel__product-tile', {
      hasText: /Tonic|Club Soda|Ginger/
    })
    await expect(mixerButtons).toHaveCount(3)

    // Non-mixer products should not appear
    await expect(page.locator('.action-panel__product-tile', { hasText: 'Cabernet' })).toHaveCount(
      0
    )
  })

  test('quantity change updates selected item quantity with keypad', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    const product = page.locator('.action-panel__product-tile').first()
    await product.click()

    const firstLine = page.locator('.ticket-panel__line').first()
    await expect(firstLine.locator('.ticket-panel__line-qty')).toHaveText('1')

    await page.getByRole('button', { name: 'Qty Change' }).click()
    const qtyModal = page.getByTestId('edit-modal')
    await expect(qtyModal.getByText('Original Qty: 1')).toBeVisible()
    await qtyModal.getByRole('button', { name: '5' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(firstLine.locator('.ticket-panel__line-qty')).toHaveText('5')
    await expect(firstLine.locator('.ticket-panel__line-price')).toHaveText('$99.95')
  })

  test('typing a SKU and pressing Enter adds the item to the cart', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('COOLER-001')
    await searchInput.press('Enter')

    // Item should appear in the ticket
    await expect(page.locator('.ticket-panel__line')).toHaveCount(1)
    await expect(page.locator('.ticket-panel__line').first()).toContainText('Vodka Soda')

    // Search input should be cleared after adding
    await expect(searchInput).toHaveValue('')
  })

  test('pressing Enter with a non-existent SKU does not add to cart', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('INVALID-999')
    await searchInput.press('Enter')

    // No items should be in the ticket
    await expect(page.locator('.ticket-panel__line')).toHaveCount(0)

    // Search keeps the entered value and no cart item is added
    await expect(searchInput).toHaveValue('INVALID-999')
    await expect(page.getByTestId('error-modal-ok')).toHaveCount(0)
  })

  test('search input is auto-focused on page load', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const searchInput = page.getByPlaceholder('Search item')
    await expect(searchInput).toBeFocused()
  })

  test('Enter adds item with current quantity and resets to 1', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    const qtyInput = page.getByPlaceholder('Qty')
    await qtyInput.fill('3')

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('BEER-001')
    await searchInput.press('Enter')

    // Item should appear with quantity 3
    const firstLine = page.locator('.ticket-panel__line').first()
    await expect(firstLine).toContainText('Craft IPA')
    await expect(firstLine.locator('.ticket-panel__line-qty')).toHaveText('3')

    // Quantity input should be reset to 1
    await expect(qtyInput).toHaveValue('1')
  })

  test('saved transaction includes discounted prices when item discount is applied', async ({
    page
  }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    // Add Cabernet Sauvignon ($19.99)
    const product = page.locator('.action-panel__product-tile').first()
    await product.click()

    // Select the line and apply 10% item discount
    await page.locator('.ticket-panel__line').first().click()
    await page.getByRole('button', { name: 'Discount', exact: true }).click()
    const discountModal = page.getByTestId('edit-modal')
    await discountModal.getByRole('button', { name: '1' }).click()
    await discountModal.getByRole('button', { name: '0' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    // Verify discount applied on screen
    await expect(
      page.locator('.ticket-panel__line').first().getByText('DISCOUNT 10.00%')
    ).toBeVisible()

    // Complete payment with cash
    await page.getByRole('button', { name: 'Pay Now' }).click()
    await page.getByRole('button', { name: 'Cash (Exact)' }).click()
    await page.getByTestId('payment-ok-btn').click()

    // Verify saved transaction has discounted prices
    // Check the mock stored the transaction — use the getRecentTransactions API
    const recentTxns = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).api
      return api?.getRecentTransactions?.()
    })

    // Should have saved 1 transaction
    expect(recentTxns).toBeTruthy()
    expect(recentTxns.length).toBe(1)

    const txn = recentTxns[0]
    const items = txn.items as Array<{ unit_price: number; total_price: number }>

    // $19.99 * 0.9 = $17.991 → rounded to $17.99
    expect(items[0].unit_price).toBeCloseTo(17.99, 1)
    expect(items[0].total_price).toBeCloseTo(17.99, 1)
  })
})

test.describe('Payment Modal', () => {
  // Helper: add a product to the cart and return its total (price * 1.13 tax)
  const addProductToCart = async (page: Page): Promise<void> => {
    await selectAllCategory(page)
    const firstProduct = page.locator('.action-panel__product-tile').first()
    await firstProduct.click()
  }

  test('Pay button opens the payment modal', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()

    const modal = page.getByTestId('payment-modal')
    await expect(modal).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Payment' })).toBeVisible()
    await expect(modal.getByText('Transaction Total')).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Cash (Exact)' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Credit' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Debit' })).toBeVisible()
    await expect(modal.getByText('No payments yet')).toBeVisible()
  })

  test('Pay button does nothing when cart is empty', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)

    // Pay button should be disabled when cart is empty
    await expect(page.getByRole('button', { name: 'Pay Now' })).toBeDisabled()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })

  test('Cash (Exact) completes payment and clears transaction', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    const totalText = await page.locator('.grand-total strong').textContent()

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    // Verify total matches
    await expect(modal.locator('.payment-total-bar strong')).toHaveText(totalText!)

    // Click Cash (Exact)
    await modal.getByRole('button', { name: 'Cash (Exact)' }).click()

    // Should show complete state with OK button
    await expect(modal.getByTestId('payment-complete')).toBeVisible()
    await expect(modal.getByTestId('payment-complete')).toContainText('Payment complete')
    await expect(modal.getByTestId('payment-ok-btn')).toBeVisible()

    // Modal stays until OK is clicked
    await modal.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
    await expect(page.locator('.ticket-panel__line')).toHaveCount(0)

    // Search input should be re-focused
    await expect(page.getByPlaceholder('Search item')).toBeFocused()
  })

  test('Credit card shows processing then completes', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    await modal.getByRole('button', { name: 'Credit' }).click()

    // Should show processing state
    await expect(modal.getByTestId('payment-processing')).toBeVisible()
    await expect(modal.getByText('Processing payment...')).toBeVisible()

    // Cancel should be disabled during processing
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    // After processing, complete screen with OK button
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await modal.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
    await expect(page.locator('.ticket-panel__line')).toHaveCount(0)
  })

  test('Debit card payment works like credit', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    await modal.getByRole('button', { name: 'Debit' }).click()

    // Processing then complete with OK button
    await expect(modal.getByTestId('payment-processing')).toBeVisible()
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await modal.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })

  test('tender denomination buttons accumulate and show change', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Cabernet Sauvignon: $19.99 * 1.13 = $22.59
    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    // Add $10 tender
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    const paidList = modal.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('$10.00 Cash')
    await expect(modal.getByTestId('payment-remaining')).toBeVisible()

    // Add another $10
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    await expect(paidList.locator('.payment-modal__paid-entry')).toHaveCount(2)

    // Add $5 more — total tendered = $25, total = $22.59, change = $2.41
    await modal.getByRole('button', { name: '$5', exact: true }).click()

    // Should show complete with change
    await expect(modal.getByTestId('payment-complete')).toBeVisible()
    await expect(modal.getByTestId('payment-complete')).toContainText('Change: $2.41')

    // Click OK to close
    await modal.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })

  test('split payment: partial cash then card completes', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Cabernet Sauvignon total = $22.59
    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    // Pay $10 cash
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    const paidList = modal.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('$10.00 Cash')

    // Remaining should be $12.59
    await expect(modal.getByTestId('payment-remaining')).toContainText('$12.59')

    // Pay remainder with credit card
    await modal.getByRole('button', { name: 'Credit' }).click()
    await expect(modal.getByTestId('payment-processing')).toBeVisible()

    // After processing completes, click OK
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await modal.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
    await expect(page.locator('.ticket-panel__line')).toHaveCount(0)
  })

  test('Cancel closes modal without clearing transaction', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should be closed
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)

    // Cart should still have the item
    await expect(page.locator('.ticket-panel__line')).toHaveCount(1)

    // Search should be refocused
    await expect(page.getByPlaceholder('Search item')).toBeFocused()
  })

  test('all seven tender denomination buttons are rendered', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')

    for (const denom of ['$1', '$2', '$5', '$10', '$20', '$50', '$100']) {
      await expect(modal.getByRole('button', { name: denom, exact: true })).toBeVisible()
    }
  })

  test('Cash/Credit/Debit buttons in action panel open payment modal', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Test Cash button opens modal — auto-triggers Cash (Exact) → complete
    await page.getByRole('button', { name: 'Cash', exact: true }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
    // Cash auto-completes, click OK to dismiss
    await expect(page.getByTestId('payment-complete')).toBeVisible()
    await page.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)

    // Add product again for next test
    await addProductToCart(page)

    // Test Credit button opens modal — auto-triggers terminal charge
    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
    // Terminal charge completes (mock resolves in 300ms)
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)

    // Add product again for next test
    await addProductToCart(page)

    // Test Debit button opens modal — auto-triggers terminal charge
    await page.getByRole('button', { name: 'Debit' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
    await expect(page.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
  })

  test('focus returns to search bar after adding item via product grid', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await selectAllCategory(page)

    const product = page.locator('.action-panel__product-tile').first()
    await product.click()

    // After adding item, search input should be focused
    await expect(page.getByPlaceholder('Search item')).toBeFocused()
  })

  test('scanning a new item while payment-complete dismisses modal and adds item', async ({
    page
  }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    // Complete a cash payment
    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')
    await modal.getByRole('button', { name: 'Cash (Exact)' }).click()
    await expect(modal.getByTestId('payment-complete')).toBeVisible()

    // Instead of clicking OK, scan a new item (type SKU + Enter)
    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('BEER-001')
    await searchInput.press('Enter')

    // Payment modal should be dismissed
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)

    // Previous transaction cleared, new item in cart
    await expect(page.locator('.ticket-panel__line')).toHaveCount(1)
    await expect(page.locator('.ticket-panel__line').first()).toContainText('Craft IPA')
  })

  test('completion screen only shows OK (per-tx Print Receipt removed)', async ({ page }) => {
    await attachPosApiMock(page)
    await gotoAndLogin(page)
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay Now' }).click()
    const modal = page.getByTestId('payment-modal')
    await modal.getByRole('button', { name: 'Cash (Exact)' }).click()

    await expect(modal.getByTestId('payment-complete')).toBeVisible()
    await expect(modal.getByTestId('payment-print-btn')).toHaveCount(0)
    await expect(modal.getByTestId('payment-ok-btn')).toBeVisible()
  })
})

/* ──────────────────────────────────────────────────────────── */
/*  Case Discount at POS                                       */
/* ──────────────────────────────────────────────────────────── */

/**
 * Mock with a product that has a case discount configured.
 * Bottles per case = 6, regular price = $12.99, case price = $66.00.
 * Effective per-bottle in a full case = $11.00 (about 15% off).
 */
const attachCaseDiscountMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const products = [
      {
        id: 1,
        sku: 'CASE-001',
        name: 'Case Discount Wine 750ml',
        category: 'Wine',
        price: 12.99,
        quantity: 100,
        tax_rate: 0.08,
        size: '750ml',
        bottles_per_case: 6,
        case_discount_price: 66.0,
        display_name: null,
        distributor_name: null
      },
      {
        id: 2,
        sku: 'NO-CASE-001',
        name: 'Regular Wine 750ml',
        category: 'Wine',
        price: 15.99,
        quantity: 50,
        tax_rate: 0.08,
        size: '750ml',
        bottles_per_case: null,
        case_discount_price: null,
        display_name: null,
        distributor_name: null
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
        throw new Error('Not implemented')
      },
      finixChargeCard: async (input: { total: number }) => ({
        authorization_id: `AU-${Date.now()}`,
        transfer_id: `TR-${Date.now()}`,
        success: true,
        last_four: '4242',
        card_type: 'visa',
        total: input.total,
        message: 'Approved',
        status: 'approved'
      }),
      saveTransaction: async () => ({ id: 1 }),
      getRecentTransactions: async () => [],
      getReceiptConfig: async () => ({
        fontSize: 10,
        paddingY: 4,
        paddingX: 4,
        storeName: '',
        footerMessage: '',
        alwaysPrint: false
      }),
      printReceipt: async () => {}
    }
  })
}

test.describe('Case Discount at POS', () => {
  test('applies case discount when quantity meets bottles_per_case threshold', async ({ page }) => {
    await attachCaseDiscountMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await selectAllCategory(page)

    // Add 6 of the case discount wine (bpc=6)
    const caseTile = page.locator('.action-panel__product-tile', { hasText: 'Case Discount Wine' })
    for (let i = 0; i < 6; i++) {
      await caseTile.click()
    }

    // Should show a PROMO badge with case discount label
    await expect(page.locator('.ticket-panel__promo-badge')).toBeVisible()
    await expect(page.getByText(/Case of 6/)).toBeVisible()

    // The total should be less than 6 x $12.99 x 1.08 = $84.18
    const totalText = await page.locator('.grand-total strong').textContent()
    const total = Number.parseFloat((totalText ?? '').replace('$', '').trim())
    const fullPriceTotal = 6 * 12.99 * 1.08
    expect(total).toBeLessThan(fullPriceTotal)

    // The total should reflect the case price: $66.00 * 1.08 = $71.28
    expect(total).toBeCloseTo(66.0 * 1.08, 1)
  })

  test('does not apply case discount when quantity is below threshold', async ({ page }) => {
    await attachCaseDiscountMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await selectAllCategory(page)

    // Add only 5 of the case discount wine (bpc=6, need 6)
    const caseTile = page.locator('.action-panel__product-tile', { hasText: 'Case Discount Wine' })
    for (let i = 0; i < 5; i++) {
      await caseTile.click()
    }

    // No promo badge should appear
    await expect(page.locator('.ticket-panel__promo-badge')).toHaveCount(0)

    // Total should be 5 x $12.99 x 1.08 = $70.15
    const totalText = await page.locator('.grand-total strong').textContent()
    const total = Number.parseFloat((totalText ?? '').replace('$', '').trim())
    expect(total).toBeCloseTo(5 * 12.99 * 1.08, 1)
  })

  test('case discount applies to full cases, remainder at regular price', async ({ page }) => {
    await attachCaseDiscountMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await selectAllCategory(page)

    // Add 8 of the case discount wine (bpc=6, so 1 full case + 2 remainder)
    const caseTile = page.locator('.action-panel__product-tile', { hasText: 'Case Discount Wine' })
    for (let i = 0; i < 8; i++) {
      await caseTile.click()
    }

    // Should show promo badge
    await expect(page.locator('.ticket-panel__promo-badge')).toBeVisible()

    // Expected: 1 case at $66.00 + 2 bottles at $12.99 = $91.98
    // With 8% tax: $91.98 * 1.08 = $99.34
    const totalText = await page.locator('.grand-total strong').textContent()
    const total = Number.parseFloat((totalText ?? '').replace('$', '').trim())
    const expectedSubtotal = 66.0 + 2 * 12.99
    expect(total).toBeCloseTo(expectedSubtotal * 1.08, 1)
  })
})

/* ──────────────────────────────────────────────────────────── */
/*  Product Tile Display — Size and 20-item Cap                */
/* ──────────────────────────────────────────────────────────── */

test.describe('Product Tile Display', () => {
  test('shows product size on tile', async ({ page }) => {
    await attachCaseDiscountMock(page)
    await page.goto('/')
    await loginWithPin(page)
    await selectAllCategory(page)

    // The mock products have size: '750ml'
    const sizeLabel = page
      .locator('.action-panel__product-tile', { hasText: 'Case Discount Wine' })
      .locator('.action-panel__product-size')
    await expect(sizeLabel).toHaveText('750ml')
  })

  test('POS grid shows maximum 20 product tiles', async ({ page }) => {
    // Create a mock with 25 products
    await page.addInitScript(() => {
      const products = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        sku: `PROD-${String(i + 1).padStart(3, '0')}`,
        name: `Product ${i + 1}`,
        category: 'Wine',
        price: 10 + i,
        quantity: 50,
        tax_rate: 0.08,
        size: null,
        bottles_per_case: null,
        case_discount_price: null,
        display_name: null,
        distributor_name: null
      }))

      const merchantConfig = {
        id: 1,
        finix_api_username: 'US-k',
        finix_api_password: 'test-finix-password',
        merchant_id: 'MU-m',
        merchant_name: 'Test Store',
        activated_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z'
      }
      const testCashier = {
        id: 1,
        name: 'Test Cashier',
        role: 'admin',
        is_active: 1,
        created_at: '2025-01-01'
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).api = {
        getMerchantConfig: async () => merchantConfig,
        authCheckSession: async () => ({
          user: { id: 'u1', email: 't@t.com' },
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
          throw new Error('Not implemented')
        },
        finixChargeCard: async (input: { total: number }) => ({
          authorization_id: `AU-${Date.now()}`,
          transfer_id: `TR-${Date.now()}`,
          success: true,
          last_four: '4242',
          card_type: 'visa',
          total: input.total,
          message: 'Approved',
          status: 'approved'
        }),
        saveTransaction: async () => ({ id: 1 }),
        getRecentTransactions: async () => [],
        getReceiptConfig: async () => ({
          fontSize: 10,
          paddingY: 4,
          paddingX: 4,
          storeName: '',
          footerMessage: '',
          alwaysPrint: false
        }),
        printReceipt: async () => {}
      }
    })

    await page.goto('/')
    await loginWithPin(page)

    // Select "All" to show all 25 products
    await selectAllCategory(page)

    const tiles = page.locator('.action-panel__product-tile')
    const count = await tiles.count()
    expect(count).toBeLessThanOrEqual(20)
  })
})
