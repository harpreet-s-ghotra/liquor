import { expect, test } from '@playwright/test'

test.describe('Startup', () => {
  test('startup panels are visible and favorites is default', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('.ticket-panel')).toBeVisible()
    await expect(page.locator('.action-panel')).toBeVisible()
    await expect(page.locator('.shortcut-bar')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Favorites' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favorites' })).toHaveClass(/active/)

    const productPadItems = page.locator('.product-pad-btn')
    await expect(productPadItems.first()).toBeVisible()
    await expect(productPadItems).toHaveCount(3)
  })

  test('payment buttons are disabled on startup', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Cash' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Credit' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Cards' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Pay' })).toBeDisabled()
  })

  test('latest added item is selected, and clicking another item selects it', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'All' }).click()
    const products = page.locator('.product-pad-btn')
    await expect(products).toHaveCount(15)

    const firstName = (await products.nth(0).locator('span').first().textContent())?.trim() ?? ''
    const secondName = (await products.nth(1).locator('span').first().textContent())?.trim() ?? ''

    await products.nth(0).click()
    await expect(page.getByText(`Selected: ${firstName}`)).toBeVisible()

    await products.nth(1).click()
    await expect(page.getByText(`Selected: ${secondName}`)).toBeVisible()

    const activeLine = page.locator('.ticket-line.active')
    await expect(activeLine).toContainText(secondName)

    await page.locator('.ticket-line').first().click()
    await expect(page.getByText(`Selected: ${firstName}`)).toBeVisible()
  })

  test('cart section is scrollable and auto-scrolls to latest added item', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'All' }).click()

    const products = page.locator('.product-pad-btn')
    const totalProducts = await products.count()
    expect(totalProducts).toBeGreaterThanOrEqual(12)

    let lastName = ''
    for (let index = 0; index < Math.min(totalProducts, 12); index += 1) {
      const currentName =
        (await products.nth(index).locator('span').first().textContent())?.trim() ?? ''
      lastName = currentName
      await products.nth(index).click()
    }

    const ticketOverflow = await page.getByTestId('ticket-lines').evaluate((element) => {
      return getComputedStyle(element).overflowY
    })
    expect(['auto', 'scroll']).toContain(ticketOverflow)

    await expect(page.getByText(`Selected: ${lastName}`)).toBeVisible()
    await expect(page.locator('.ticket-line.active')).toContainText(lastName)

    const scrolled = await page.getByTestId('ticket-lines').evaluate((element) => {
      return element.scrollTop > 0
    })
    expect(scrolled).toBe(true)
  })
})
