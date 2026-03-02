import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Full mock that covers POS products + inventory CRUD (departments, tax codes, vendors, items).
 * Each store is an in-memory array so the test can create-then-verify round-trips.
 */
const attachFullApiMock = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    /* ── In-memory stores ── */
    const departments: Array<{ id: number; name: string }> = []
    const taxCodes: Array<{ id: number; code: string; rate: number }> = []
    const vendors: Array<{
      vendor_number: number
      vendor_name: string
      contact_name: string | null
      phone: string | null
      email: string | null
      is_active: number
    }> = []
    const inventoryItems: Array<Record<string, unknown>> = []
    const products: Array<{
      id: number
      sku: string
      name: string
      category: string
      price: number
      quantity: number
      tax_rate: number
    }> = [
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

    let nextDeptId = 1
    let nextTaxId = 1
    let nextVendorId = 1
    let nextItemId = 2

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      /* ── Products (POS screen) ── */
      getProducts: async () => [...products],

      /* ── Inventory item search / detail / save ── */
      searchInventoryProducts: async (query: string) => {
        const q = query.trim().toLowerCase()
        return inventoryItems
          .filter(
            (it) =>
              !q ||
              String(it.sku).toLowerCase().includes(q) ||
              String(it.item_name).toLowerCase().includes(q)
          )
          .map((it) => ({ ...it }))
      },
      getInventoryProductDetail: async (itemNumber: number) =>
        inventoryItems.find((it) => it.item_number === itemNumber) ?? null,

      getInventoryDepartments: async () => departments.map((d) => String(d.id)),
      getInventoryTaxCodes: async () => taxCodes.map((tc) => ({ code: tc.code, rate: tc.rate })),

      saveInventoryItem: async (payload: Record<string, unknown>) => {
        const id =
          (payload.item_number as number | undefined) ??
          inventoryItems.reduce(
            (max, c) => Math.max(max, c.item_number as number),
            nextItemId - 1
          ) + 1
        const taxRates = payload.tax_rates as number[]
        const item = {
          item_number: id,
          sku: payload.sku,
          item_name: payload.item_name,
          dept_id: payload.dept_id,
          category_id: null,
          category_name: null,
          cost: payload.cost,
          retail_price: payload.retail_price,
          in_stock: payload.in_stock,
          tax_1: taxRates[0] ?? 0,
          tax_2: taxRates[1] ?? 0,
          vendor_number: null,
          vendor_name: null,
          bottles_per_case: 12,
          barcode: null,
          description: null,
          special_pricing_enabled: 0,
          special_price: null,
          is_active: 1,
          additional_skus: payload.additional_skus ?? [],
          special_pricing: payload.special_pricing ?? [],
          sales_history: []
        }
        const idx = inventoryItems.findIndex((it) => it.item_number === id)
        if (idx >= 0) inventoryItems[idx] = item
        else inventoryItems.push(item)

        // Also push into the POS products list so POS screen sees it after reload
        const newProduct = {
          id: id,
          sku: String(payload.sku),
          name: String(payload.item_name),
          category:
            departments.find((d) => String(d.id) === String(payload.dept_id))?.name ?? 'General',
          price: payload.retail_price as number,
          quantity: payload.in_stock as number,
          tax_rate: taxRates[0] ?? 0
        }
        const pIdx = products.findIndex((p) => p.id === id)
        if (pIdx >= 0) products[pIdx] = newProduct
        else products.push(newProduct)

        nextItemId = Math.max(nextItemId, id + 1)
        return item
      },

      /* ── Departments CRUD ── */
      getDepartments: async () => departments.map((d) => ({ ...d })),
      createDepartment: async (input: { name: string }) => {
        const dept = { id: nextDeptId++, name: input.name }
        departments.push(dept)
        return dept
      },
      updateDepartment: async (input: { id: number; name: string }) => {
        const dept = departments.find((d) => d.id === input.id)
        if (dept) dept.name = input.name
        return dept
      },
      deleteDepartment: async (id: number) => {
        const idx = departments.findIndex((d) => d.id === id)
        if (idx >= 0) departments.splice(idx, 1)
      },

      /* ── Tax Codes CRUD ── */
      getTaxCodes: async () => taxCodes.map((tc) => ({ ...tc })),
      createTaxCode: async (input: { code: string; rate: number }) => {
        const tc = { id: nextTaxId++, code: input.code, rate: input.rate }
        taxCodes.push(tc)
        return tc
      },
      updateTaxCode: async (input: { id: number; code: string; rate: number }) => {
        const tc = taxCodes.find((t) => t.id === input.id)
        if (tc) {
          tc.code = input.code
          tc.rate = input.rate
        }
        return tc
      },
      deleteTaxCode: async (id: number) => {
        const idx = taxCodes.findIndex((t) => t.id === id)
        if (idx >= 0) taxCodes.splice(idx, 1)
      },

      /* ── Vendors CRUD ── */
      getVendors: async () => vendors.map((v) => ({ ...v })),
      createVendor: async (input: {
        vendor_name: string
        contact_name?: string
        phone?: string
        email?: string
      }) => {
        const v = {
          vendor_number: nextVendorId++,
          vendor_name: input.vendor_name,
          contact_name: input.contact_name ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          is_active: 1
        }
        vendors.push(v)
        return v
      },
      updateVendor: async (input: {
        vendor_number: number
        vendor_name: string
        contact_name?: string
        phone?: string
        email?: string
      }) => {
        const v = vendors.find((vn) => vn.vendor_number === input.vendor_number)
        if (v) {
          v.vendor_name = input.vendor_name
          v.contact_name = input.contact_name ?? null
          v.phone = input.phone ?? null
          v.email = input.email ?? null
        }
        return v
      },
      deleteVendor: async (vendorNumber: number) => {
        const idx = vendors.findIndex((v) => v.vendor_number === vendorNumber)
        if (idx >= 0) vendors.splice(idx, 1)
      }
    }
  })
}

test.describe('Inventory Management – Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await attachFullApiMock(page)
    await page.goto('/')
  })

  test('creates department, tax code, vendor, saves item, then verifies on POS screen', async ({
    page
  }) => {
    /* ── Step 1: Open Inventory Modal ── */
    await page.getByRole('button', { name: 'F2 - Inventory' }).click()
    const dialog = page.getByRole('dialog', { name: 'Inventory Management' })
    await expect(dialog).toBeVisible()

    /* ── Step 2: Create a Department ── */
    await page.getByRole('tab', { name: 'Departments' }).click()
    await page.getByRole('textbox', { name: 'Department Name' }).fill('Wine')
    await page.getByRole('button', { name: 'Add Department' }).click()
    await expect(page.getByText('Department created')).toBeVisible()
    // Verify it appears in the table
    const deptTable = page.getByRole('table', { name: 'Departments list' })
    await expect(deptTable.getByText('Wine')).toBeVisible()

    /* ── Step 3: Create a Tax Code ── */
    await page.getByRole('tab', { name: 'Tax Codes' }).click()
    await page.getByRole('textbox', { name: 'Tax Code Name' }).fill('HST')
    await page.getByRole('textbox', { name: 'Tax Rate' }).fill('13')
    await page.getByRole('button', { name: 'Add Tax Code' }).click()
    await expect(page.getByText('Tax code created')).toBeVisible()
    const taxTable = page.getByRole('table', { name: 'Tax codes list' })
    await expect(taxTable.getByText('HST')).toBeVisible()
    await expect(taxTable.getByText('13.00%')).toBeVisible()

    /* ── Step 4: Create a Vendor ── */
    await page.getByRole('tab', { name: 'Vendors' }).click()
    await page.getByRole('textbox', { name: 'Vendor Name' }).fill('Premium Wines Inc')
    await page.getByRole('textbox', { name: 'Contact Name' }).fill('Jane Doe')
    await page.getByRole('textbox', { name: 'Phone' }).fill('555-0123')
    await page.getByRole('textbox', { name: 'Email' }).fill('jane@premiumwines.com')
    await page.getByRole('button', { name: 'Add Vendor' }).click()
    await expect(page.getByText('Vendor created')).toBeVisible()
    const vendorTable = page.getByRole('table', { name: 'Vendors list' })
    await expect(vendorTable.getByText('Premium Wines Inc')).toBeVisible()
    await expect(vendorTable.getByText('Jane Doe')).toBeVisible()

    /* ── Step 5: Switch to Items tab and save a new item ── */
    await page.getByRole('tab', { name: 'Items' }).click()

    const sku = `E2E-${Date.now()}`
    const itemName = `Test Merlot 750ml`

    await page.getByRole('textbox', { name: 'SKU', exact: true }).fill(sku)
    await page.getByLabel('Name').fill(itemName)
    // The department dropdown should now contain the department we created (id "1")
    await page.getByLabel('Department').selectOption('1')
    await page.getByLabel('Cost').fill('12.50')
    await page.getByLabel('Price Charged').fill('24.99')
    await page.getByLabel('In Stock').fill('30')

    // Select tax code from dropdown
    const taxContainer = page.getByLabel('Tax Codes')
    await taxContainer.getByRole('button').click()
    const taxOptions = taxContainer.getByRole('option')
    for (const opt of await taxOptions.all()) {
      const checkbox = opt.getByRole('checkbox')
      if (!(await checkbox.isChecked())) {
        await checkbox.check()
      }
    }
    await taxContainer.getByRole('button').click()

    await page.getByRole('button', { name: 'Save Item' }).click()
    await expect(page.getByText('Item saved')).toBeVisible()

    /* ── Step 6: Close inventory modal (triggers product reload in POS screen) ── */
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).not.toBeVisible()

    /* ── Step 7: Verify item appears on POS screen ── */
    // Switch to "All" category to see all products
    await page.getByRole('button', { name: 'All' }).click()
    await expect(page.getByText(itemName)).toBeVisible()

    /* ── Step 8: Search for the item in the POS ticket search ── */
    await page.getByPlaceholder('Search products').fill(sku)
    await expect(page.getByText(itemName)).toBeVisible()
  })

  test('edits and deletes a department', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 - Inventory' }).click()
    await page.getByRole('tab', { name: 'Departments' }).click()

    // Create a department first
    await page.getByRole('textbox', { name: 'Department Name' }).fill('Beer')
    await page.getByRole('button', { name: 'Add Department' }).click()
    await expect(page.getByText('Department created')).toBeVisible()

    const deptTable = page.getByRole('table', { name: 'Departments list' })

    // Edit the department
    await deptTable.getByRole('button', { name: 'Edit' }).click()
    const editInput = page.getByRole('textbox', { name: 'Edit Department Name' })
    await editInput.clear()
    await editInput.fill('Craft Beer')
    await deptTable.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Department updated')).toBeVisible()
    await expect(deptTable.getByText('Craft Beer')).toBeVisible()

    // Delete the department
    await deptTable.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Department deleted')).toBeVisible()
    await expect(page.getByText('No departments yet')).toBeVisible()
  })

  test('validates required fields on CRUD panels', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 - Inventory' }).click()

    // Department: try to add with empty name
    await page.getByRole('tab', { name: 'Departments' }).click()
    await page.getByRole('button', { name: 'Add Department' }).click()
    await expect(page.getByText('Name is required')).toBeVisible()

    // Tax Code: try to add with empty fields
    await page.getByRole('tab', { name: 'Tax Codes' }).click()
    await page.getByRole('button', { name: 'Add Tax Code' }).click()
    await expect(page.getByText('Code is required')).toBeVisible()
    await expect(page.getByText('Rate is required')).toBeVisible()

    // Vendor: try to add with empty name
    await page.getByRole('tab', { name: 'Vendors' }).click()
    await page.getByRole('button', { name: 'Add Vendor' }).click()
    await expect(page.getByText('Vendor name is required')).toBeVisible()
  })

  test('edits and deletes a tax code', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 - Inventory' }).click()
    await page.getByRole('tab', { name: 'Tax Codes' }).click()

    // Create
    await page.getByRole('textbox', { name: 'Tax Code Name' }).fill('GST')
    await page.getByRole('textbox', { name: 'Tax Rate' }).fill('5')
    await page.getByRole('button', { name: 'Add Tax Code' }).click()
    await expect(page.getByText('Tax code created')).toBeVisible()

    const taxTable = page.getByRole('table', { name: 'Tax codes list' })

    // Edit
    await taxTable.getByRole('button', { name: 'Edit' }).click()
    const editCode = page.getByRole('textbox', { name: 'Edit Tax Code Name' })
    await editCode.clear()
    await editCode.fill('PST')
    const editRate = page.getByRole('textbox', { name: 'Edit Tax Rate' })
    await editRate.clear()
    await editRate.fill('8')
    await taxTable.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Tax code updated')).toBeVisible()
    await expect(taxTable.getByText('PST')).toBeVisible()

    // Delete
    await taxTable.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Tax code deleted')).toBeVisible()
    await expect(page.getByText('No tax codes yet')).toBeVisible()
  })

  test('edits and deletes a vendor', async ({ page }) => {
    await page.getByRole('button', { name: 'F2 - Inventory' }).click()
    await page.getByRole('tab', { name: 'Vendors' }).click()

    // Create
    await page.getByRole('textbox', { name: 'Vendor Name' }).fill('ABC Dist')
    await page.getByRole('button', { name: 'Add Vendor' }).click()
    await expect(page.getByText('Vendor created')).toBeVisible()

    const vendorTable = page.getByRole('table', { name: 'Vendors list' })

    // Edit
    await vendorTable.getByRole('button', { name: 'Edit' }).click()
    const editName = page.getByRole('textbox', { name: 'Edit Vendor Name' })
    await editName.clear()
    await editName.fill('XYZ Distributors')
    await vendorTable.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Vendor updated')).toBeVisible()
    await expect(vendorTable.getByText('XYZ Distributors')).toBeVisible()

    // Delete
    await vendorTable.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Vendor deleted')).toBeVisible()
    await expect(page.getByText('No vendors yet')).toBeVisible()
  })
})
