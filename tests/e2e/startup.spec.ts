import { expect, test } from '@playwright/test'

const attachPosApiMock = async (page): Promise<void> => {
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
        throw new Error('Not implemented in startup mock')
      }
    }
  })
}

test.describe('Startup', () => {
  test('startup panels are visible and favorites is default', async ({ page }) => {
    await attachPosApiMock(page)
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
    await attachPosApiMock(page)
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Cash' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Credit' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Debit' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Pay' })).toBeDisabled()
  })

  test('latest added item is selected, and clicking another item selects it', async ({ page }) => {
    await attachPosApiMock(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'All' }).click()
    const products = page.locator('.product-pad-btn')
    await expect(products).toHaveCount(15)

    const firstName = (await products.nth(0).locator('span').first().textContent())?.trim() ?? ''
    const secondName = (await products.nth(1).locator('span').first().textContent())?.trim() ?? ''

    await products.nth(0).click()
    await expect(page.locator('.ticket-line.active')).toContainText(firstName)

    await products.nth(1).click()
    await expect(page.locator('.ticket-line.active')).toContainText(secondName)

    const activeLine = page.locator('.ticket-line.active')
    await expect(activeLine).toContainText(secondName)

    await page.locator('.ticket-line').first().click()
    await expect(page.locator('.ticket-line.active')).toContainText(firstName)
  })

  test('cart section is scrollable and auto-scrolls to latest added item', async ({ page }) => {
    await attachPosApiMock(page)
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

    await expect(page.locator('.ticket-line.active')).toContainText(lastName)

    const scrolled = await page.getByTestId('ticket-lines').evaluate((element) => {
      return element.scrollTop > 0
    })
    expect(scrolled).toBe(true)
  })
})
