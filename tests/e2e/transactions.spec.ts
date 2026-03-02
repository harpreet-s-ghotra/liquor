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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getProducts: async () => products,
      searchInventoryProducts: async () => [],
      getInventoryProductDetail: async () => null,
      saveInventoryItem: async () => {
        throw new Error('Not implemented in transactions mock')
      }
    }
  })
}

const parseAmount = async (selector: string, page: Page): Promise<number> => {
  const text = await page.locator(selector).textContent()
  return Number.parseFloat((text ?? '').replace('$', '').trim())
}

test.describe('Simple Transactions', () => {
  test('payment buttons become enabled after adding an item', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    const firstProduct = page.locator('.product-pad-btn').first()
    await firstProduct.click()

    await expect(page.getByRole('button', { name: 'Cash' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Credit' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Debit' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Pay' })).toBeEnabled()
  })

  test('delete removes currently selected item', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const products = page.locator('.product-pad-btn')
    const firstName = (await products.nth(0).locator('span').first().textContent())?.trim() ?? ''
    const secondName = (await products.nth(1).locator('span').first().textContent())?.trim() ?? ''

    await products.nth(0).click()
    await products.nth(1).click()

    await expect(page.locator('.ticket-line.active')).toContainText(secondName)

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.ticket-line')).toHaveCount(1)
    await expect(page.locator('.ticket-line.active')).toContainText(firstName)
  })

  test('price change updates selected cart line price only', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const products = page.locator('.product-pad-btn')
    await products.nth(0).click()

    const firstLine = page.locator('.ticket-line').first()
    const originalLineTotal = await firstLine.locator('.ticket-line-price').textContent()

    await page.getByRole('button', { name: 'Price Change' }).click()
    const priceModal = page.getByTestId('edit-modal')
    await expect(priceModal.getByText('Original Price: $19.99')).toBeVisible()
    await priceModal.getByRole('button', { name: '1', exact: true }).click()
    await priceModal.getByRole('button', { name: '2', exact: true }).click()
    await priceModal.getByRole('button', { name: '5', exact: true }).click()
    await priceModal.getByRole('button', { name: '0', exact: true }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(firstLine.locator('.ticket-line-price')).toHaveText('$12.50')
    expect(await firstLine.locator('.ticket-line-price').textContent()).not.toBe(originalLineTotal)

    await expect(products.nth(0)).toContainText('$19.99')
  })

  test('discount supports selected item and entire transaction modes', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const products = page.locator('.product-pad-btn')
    await products.nth(0).click()
    await products.nth(1).click()

    const totalBefore = await parseAmount('.grand-total strong', page)

    await page.locator('.ticket-line').first().click()
    await page.getByRole('button', { name: 'Discount', exact: true }).click()
    const itemDiscountModal = page.getByTestId('edit-modal')
    await expect(itemDiscountModal.getByText('Original Discount: 0.00%')).toBeVisible()
    await itemDiscountModal.getByRole('button', { name: '1' }).click()
    await itemDiscountModal.getByRole('button', { name: '0' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    const discountedLine = page.locator('.ticket-line').first()
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
    await expect(transactionDiscountLine.locator('.ticket-line-qty')).toHaveText('1')
    await expect(transactionDiscountLine.locator('.ticket-line-price')).toHaveText('-$1.57')

    const totalAfterTransactionDiscount = await parseAmount('.grand-total strong', page)
    expect(totalAfterTransactionDiscount).toBeLessThan(totalAfterItemDiscount)

    await transactionDiscountLine.click()
    await expect(page.getByRole('button', { name: 'Qty Change' })).toBeDisabled()

    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: /5% Discount/i })).toHaveCount(0)
  })

  test('search by SKU finds product across all categories and adds to cart', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    // Default is Favorites — COOLER-001 is not a favorite
    // Verify the cooler product is NOT visible initially
    await expect(page.locator('.product-pad-btn', { hasText: 'Vodka Soda' })).toHaveCount(0)

    // Type the full SKU into the search box
    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('COOLER-001')

    // The matching product should now be visible despite the Favorites filter
    const coolerBtn = page.locator('.product-pad-btn', { hasText: 'Vodka Soda' })
    await expect(coolerBtn).toBeVisible()

    // Click the product to add it to the cart
    await coolerBtn.click()

    // Verify it appeared in the ticket
    await expect(page.locator('.ticket-line')).toHaveCount(1)
    await expect(page.locator('.ticket-line').first()).toContainText('Vodka Soda')
    await expect(page.locator('.ticket-line-price').first()).toHaveText('$4.25')

    // Clear search and verify category filter restores
    await searchInput.fill('')
    await expect(page.locator('.product-pad-btn', { hasText: 'Vodka Soda' })).toHaveCount(0)
  })

  test('partial SKU search narrows product grid results', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('MIXER')

    // All three MIXER products should appear
    const mixerButtons = page.locator('.product-pad-btn', { hasText: /Tonic|Club Soda|Ginger/ })
    await expect(mixerButtons).toHaveCount(3)

    // Non-mixer products should not appear
    await expect(page.locator('.product-pad-btn', { hasText: 'Cabernet' })).toHaveCount(0)
  })

  test('quantity change updates selected item quantity with keypad', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const product = page.locator('.product-pad-btn').first()
    await product.click()

    const firstLine = page.locator('.ticket-line').first()
    await expect(firstLine.locator('.ticket-line-qty')).toHaveText('1')

    await page.getByRole('button', { name: 'Qty Change' }).click()
    const qtyModal = page.getByTestId('edit-modal')
    await expect(qtyModal.getByText('Original Qty: 1')).toBeVisible()
    await qtyModal.getByRole('button', { name: '5' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(firstLine.locator('.ticket-line-qty')).toHaveText('5')
    await expect(firstLine.locator('.ticket-line-price')).toHaveText('$99.95')
  })

  test('typing a SKU and pressing Enter adds the item to the cart', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('COOLER-001')
    await searchInput.press('Enter')

    // Item should appear in the ticket
    await expect(page.locator('.ticket-line')).toHaveCount(1)
    await expect(page.locator('.ticket-line').first()).toContainText('Vodka Soda')

    // Search input should be cleared after adding
    await expect(searchInput).toHaveValue('')
  })

  test('pressing Enter with a non-existent SKU does not add to cart', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('INVALID-999')
    await searchInput.press('Enter')

    // No items should be in the ticket
    await expect(page.locator('.ticket-line')).toHaveCount(0)

    // Search should remain (not cleared since no match)
    await expect(searchInput).toHaveValue('INVALID-999')
  })

  test('search input is auto-focused on page load', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    const searchInput = page.getByPlaceholder('Search item')
    await expect(searchInput).toBeFocused()
  })

  test('Enter adds item with current quantity and resets to 1', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    const qtyInput = page.getByPlaceholder('Qty')
    await qtyInput.fill('3')

    const searchInput = page.getByPlaceholder('Search item')
    await searchInput.fill('BEER-001')
    await searchInput.press('Enter')

    // Item should appear with quantity 3
    const firstLine = page.locator('.ticket-line').first()
    await expect(firstLine).toContainText('Craft IPA')
    await expect(firstLine.locator('.ticket-line-qty')).toHaveText('3')

    // Quantity input should be reset to 1
    await expect(qtyInput).toHaveValue('1')
  })
})

test.describe('Payment Modal', () => {
  // Helper: add a product to the cart and return its total (price * 1.13 tax)
  const addProductToCart = async (page: Page): Promise<void> => {
    await page.getByRole('button', { name: 'All' }).click()
    const firstProduct = page.locator('.product-pad-btn').first()
    await firstProduct.click()
  }

  test('Pay button opens the payment modal', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay' }).click()

    const modal = page.getByTestId('payment-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Payment' })).toBeVisible()
    await expect(modal.getByText('Transaction Total')).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Cash (Exact)' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Credit' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Debit' })).toBeVisible()
    await expect(modal.getByText('No payments yet')).toBeVisible()
  })

  test('Pay button does nothing when cart is empty', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    // Pay button should be disabled when cart is empty
    await expect(page.getByRole('button', { name: 'Pay' })).toBeDisabled()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
  })

  test('Cash (Exact) completes payment and clears transaction', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    const totalText = await page.locator('.grand-total strong').textContent()

    await page.getByRole('button', { name: 'Pay' }).click()
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
    await expect(page.locator('.ticket-line')).toHaveCount(0)

    // Search input should be re-focused
    await expect(page.getByPlaceholder('Search item')).toBeFocused()
  })

  test('Credit card shows processing then completes', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay' }).click()
    const modal = page.getByTestId('payment-modal')

    await modal.getByRole('button', { name: 'Credit' }).click()

    // Should show processing state
    await expect(modal.getByTestId('payment-processing')).toBeVisible()
    await expect(modal.getByText('Processing card payment...')).toBeVisible()

    // Cancel should be disabled during processing
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    // After processing, complete screen with OK button
    await expect(modal.getByTestId('payment-complete')).toBeVisible({ timeout: 5000 })
    await modal.getByTestId('payment-ok-btn').click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)
    await expect(page.locator('.ticket-line')).toHaveCount(0)
  })

  test('Debit card payment works like credit', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay' }).click()
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
    await page.goto('/')
    await addProductToCart(page)

    // Cabernet Sauvignon: $19.99 * 1.13 = $22.59
    await page.getByRole('button', { name: 'Pay' }).click()
    const modal = page.getByTestId('payment-modal')

    // Add $10 tender
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    const paidList = modal.getByTestId('paid-so-far-list')
    await expect(paidList).toContainText('$10.00 Cash')
    await expect(modal.getByTestId('payment-remaining')).toBeVisible()

    // Add another $10
    await modal.getByRole('button', { name: '$10', exact: true }).click()
    await expect(paidList.locator('.paid-entry')).toHaveCount(2)

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
    await page.goto('/')
    await addProductToCart(page)

    // Cabernet Sauvignon total = $22.59
    await page.getByRole('button', { name: 'Pay' }).click()
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
    await expect(page.locator('.ticket-line')).toHaveCount(0)
  })

  test('Cancel closes modal without clearing transaction', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should be closed
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)

    // Cart should still have the item
    await expect(page.locator('.ticket-line')).toHaveCount(1)

    // Search should be refocused
    await expect(page.getByPlaceholder('Search item')).toBeFocused()
  })

  test('all seven tender denomination buttons are rendered', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    await page.getByRole('button', { name: 'Pay' }).click()
    const modal = page.getByTestId('payment-modal')

    for (const denom of ['$1', '$2', '$5', '$10', '$20', '$50', '$100']) {
      await expect(modal.getByRole('button', { name: denom, exact: true })).toBeVisible()
    }
  })

  test('Cash/Credit/Debit buttons in action panel open payment modal', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    // Test Cash button opens modal
    await page.getByRole('button', { name: 'Cash' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('payment-modal')).toHaveCount(0)

    // Test Credit button opens modal
    await page.getByRole('button', { name: 'Credit' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Test Debit button opens modal (it calls onCredit in ActionPanel)
    await page.getByRole('button', { name: 'Debit' }).click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
  })

  test('focus returns to search bar after adding item via product grid', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const product = page.locator('.product-pad-btn').first()
    await product.click()

    // After adding item, search input should be focused
    await expect(page.getByPlaceholder('Search item')).toBeFocused()
  })

  test('scanning a new item while payment-complete dismisses modal and adds item', async ({
    page
  }) => {
    await attachPosApiMock(page)
    await page.goto('/')
    await addProductToCart(page)

    // Complete a cash payment
    await page.getByRole('button', { name: 'Pay' }).click()
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
    await expect(page.locator('.ticket-line')).toHaveCount(1)
    await expect(page.locator('.ticket-line').first()).toContainText('Craft IPA')
  })
})
