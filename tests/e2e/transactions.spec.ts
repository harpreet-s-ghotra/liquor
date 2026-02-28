import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const parseAmount = async (selector: string, page: Page): Promise<number> => {
  const text = await page.locator(selector).textContent()
  return Number.parseFloat((text ?? '').replace('$', '').trim())
}

test.describe('Simple Transactions', () => {
  test('payment buttons become enabled after adding an item', async ({ page }) => {
    await page.goto('/')

    const firstProduct = page.locator('.product-pad-btn').first()
    await firstProduct.click()

    await expect(page.getByRole('button', { name: 'Cash' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Credit' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Cards' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Pay' })).toBeEnabled()
  })

  test('delete removes currently selected item', async ({ page }) => {
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
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const products = page.locator('.product-pad-btn')
    await products.nth(0).click()

    const firstLine = page.locator('.ticket-line').first()
    const originalLineTotal = await firstLine.locator('.ticket-line-price').textContent()

    await page.getByRole('button', { name: 'Price Change' }).click()
    const priceModal = page.getByTestId('edit-modal')
    await expect(priceModal.getByText('Original Price: $19.99')).toBeVisible()
    await priceModal.getByRole('button', { name: '1' }).click()
    await priceModal.getByRole('button', { name: '2' }).click()
    await priceModal.getByRole('button', { name: '5' }).click()
    await priceModal.getByRole('button', { name: '0' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(firstLine.locator('.ticket-line-price')).toHaveText('$12.50')
    expect(await firstLine.locator('.ticket-line-price').textContent()).not.toBe(originalLineTotal)

    await expect(products.nth(0)).toContainText('$19.99')
  })

  test('discount supports selected item and entire transaction modes', async ({ page }) => {
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
    await expect(page.locator('.totals-box').getByText('Saved')).toBeVisible()

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

  test('quantity change updates selected item quantity with keypad', async ({ page }) => {
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
})
