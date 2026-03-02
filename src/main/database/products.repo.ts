import { getDb } from './connection'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../shared/constants'
import type {
  Product,
  InventoryProduct,
  InventoryProductDetail,
  InventorySalesHistory,
  SpecialPricingRule,
  InventoryTaxCode,
  SaveInventoryItemInput
} from '../../shared/types'

// ── Helpers ──

function normalizeTaxRate(value: number): number {
  return Number(value.toFixed(4))
}

// ── Read queries ──

export function getProducts(): Product[] {
  return getDb()
    .prepare(
      `
      SELECT
        id,
        sku,
        name,
        category,
        COALESCE(retail_price, price) AS price,
        COALESCE(in_stock, quantity) AS quantity,
        COALESCE(tax_1, tax_rate) AS tax_rate
      FROM products
      WHERE is_active = 1
      ORDER BY name
      `
    )
    .all() as Product[]
}

export function getInventoryProducts(): InventoryProduct[] {
  return getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.dept_id,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price) AS retail_price,
        COALESCE(products.in_stock, products.quantity, 0) AS in_stock,
        COALESCE(products.tax_1, products.tax_rate, 0) AS tax_1,
        COALESCE(products.tax_2, 0) AS tax_2,
        products.vendor_number,
        vendors.vendor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active
      FROM products
      LEFT JOIN vendors ON vendors.vendor_number = products.vendor_number
      ORDER BY products.id
      `
    )
    .all() as InventoryProduct[]
}

export function getInventoryDepartments(): string[] {
  return getDb()
    .prepare(
      `
      SELECT name
      FROM departments
      ORDER BY name
      `
    )
    .all()
    .map((row) => String((row as { name: string }).name))
}

export function getInventoryTaxCodes(): InventoryTaxCode[] {
  return getDb()
    .prepare(
      `
      SELECT code, rate
      FROM tax_codes
      ORDER BY rate
      `
    )
    .all() as InventoryTaxCode[]
}

export function searchInventoryProducts(query: string): InventoryProduct[] {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return getInventoryProducts()
  }

  return getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.dept_id,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price) AS retail_price,
        COALESCE(products.in_stock, products.quantity, 0) AS in_stock,
        COALESCE(products.tax_1, products.tax_rate, 0) AS tax_1,
        COALESCE(products.tax_2, 0) AS tax_2,
        products.vendor_number,
        vendors.vendor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active
      FROM products
      LEFT JOIN vendors ON vendors.vendor_number = products.vendor_number
      WHERE products.sku LIKE @likeQuery OR products.name LIKE @likeQuery
      ORDER BY products.id
      `
    )
    .all({ likeQuery: `%${normalizedQuery}%` }) as InventoryProduct[]
}

export function getInventoryProductDetail(itemNumber: number): InventoryProductDetail | null {
  const product = getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.dept_id,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price) AS retail_price,
        COALESCE(products.in_stock, products.quantity, 0) AS in_stock,
        COALESCE(products.tax_1, products.tax_rate, 0) AS tax_1,
        COALESCE(products.tax_2, 0) AS tax_2,
        products.vendor_number,
        vendors.vendor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active
      FROM products
      LEFT JOIN vendors ON vendors.vendor_number = products.vendor_number
      WHERE products.id = ?
      `
    )
    .get(itemNumber) as InventoryProduct | undefined

  if (!product) {
    return null
  }

  const additionalSkus = getDb()
    .prepare(
      `
      SELECT alt_sku
      FROM product_alt_skus
      WHERE product_id = ?
      ORDER BY alt_sku
      `
    )
    .all(itemNumber) as Array<{ alt_sku: string }>

  const taxRates = Array.from(
    new Set(
      [product.tax_1, product.tax_2]
        .filter((taxRate) => Number.isFinite(taxRate) && taxRate >= 0)
        .map((taxRate) => normalizeTaxRate(taxRate))
    )
  )

  const salesHistory = getDb()
    .prepare(
      `
      SELECT
        transaction_items.transaction_id,
        transactions.created_at,
        transaction_items.quantity,
        transaction_items.unit_price,
        transaction_items.total_price
      FROM transaction_items
      INNER JOIN transactions ON transactions.id = transaction_items.transaction_id
      WHERE transaction_items.product_id = ?
      ORDER BY transactions.created_at DESC
      LIMIT 20
      `
    )
    .all(itemNumber) as InventorySalesHistory[]

  const specialPricing = getDb()
    .prepare(
      `
      SELECT quantity, price, duration_days
      FROM special_pricing
      WHERE product_id = ?
      ORDER BY quantity
      `
    )
    .all(itemNumber) as SpecialPricingRule[]

  return {
    ...product,
    tax_rates: taxRates,
    additional_skus: additionalSkus.map((item) => item.alt_sku),
    sales_history: salesHistory,
    special_pricing: specialPricing
  }
}

// ── Write operations ──

export function saveInventoryItem(input: SaveInventoryItemInput): InventoryProductDetail {
  const db = getDb()

  const normalizedSku = input.sku.trim()
  const normalizedName = input.item_name.trim()
  const normalizedDept = input.dept_id.trim()

  if (!normalizedSku) {
    throw new Error('SKU is required')
  }

  if (!SKU_PATTERN.test(normalizedSku)) {
    throw new Error('SKU must contain only letters, numbers, and hyphens')
  }

  if (!normalizedName) {
    throw new Error('Name is required')
  }

  if (!normalizedDept) {
    throw new Error('Department is required')
  }

  if (normalizedSku.length > SKU_MAX_LENGTH) {
    throw new Error(`SKU must be ${SKU_MAX_LENGTH} characters or less`)
  }

  if (normalizedName.length > NAME_MAX_LENGTH) {
    throw new Error(`Name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  if (!Number.isFinite(input.cost) || input.cost < 0) {
    throw new Error('Cost must be a non-negative number')
  }

  if (!Number.isFinite(input.retail_price) || input.retail_price < 0) {
    throw new Error('Price must be a non-negative number')
  }

  if (!Number.isInteger(input.in_stock)) {
    throw new Error('In stock must be an integer')
  }

  if (!Array.isArray(input.tax_rates) || input.tax_rates.length === 0) {
    throw new Error('At least one tax code must be selected')
  }

  if (
    input.special_pricing.some(
      (rule) =>
        !Number.isInteger(rule.quantity) ||
        rule.quantity < 1 ||
        !Number.isFinite(rule.price) ||
        rule.price < 0 ||
        !Number.isInteger(rule.duration_days) ||
        rule.duration_days < 1
    )
  ) {
    throw new Error('Special pricing rules must have valid quantity, price, and duration')
  }

  const allowedDepartments = new Set(getInventoryDepartments())
  const deptParts = normalizedDept
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  if (deptParts.length === 0) {
    throw new Error('Department is required')
  }
  for (const part of deptParts) {
    if (!allowedDepartments.has(part)) {
      throw new Error('Department must be selected from available departments')
    }
  }

  const allowedTaxRates = new Set(getInventoryTaxCodes().map((code) => normalizeTaxRate(code.rate)))
  const normalizedTaxRates = Array.from(
    new Set(
      input.tax_rates
        .filter((taxRate) => Number.isFinite(taxRate) && taxRate >= 0)
        .map((taxRate) => normalizeTaxRate(taxRate))
    )
  )

  if (normalizedTaxRates.length === 0) {
    throw new Error('At least one tax code must be selected')
  }

  if (normalizedTaxRates.some((taxRate) => !allowedTaxRates.has(taxRate))) {
    throw new Error('Tax codes must be selected from available backend tax codes')
  }

  const duplicateSku = db
    .prepare(
      `
      SELECT id
      FROM products
      WHERE sku = @sku
        AND (@item_number IS NULL OR id != @item_number)
      LIMIT 1
      `
    )
    .get({ sku: normalizedSku, item_number: input.item_number ?? null }) as
    | { id: number }
    | undefined

  if (duplicateSku) {
    throw new Error('SKU already exists')
  }

  const normalizedAdditionalSkus = Array.from(
    new Set(
      input.additional_skus.map((sku) => sku.trim()).filter((sku) => sku && sku !== normalizedSku)
    )
  )

  const tx = db.transaction((payload: SaveInventoryItemInput) => {
    const primaryTaxRate = normalizedTaxRates[0] ?? 0
    const secondaryTaxRate = normalizedTaxRates[1] ?? 0
    const hasSpecialPricing = payload.special_pricing.length > 0

    const statementPayload = {
      sku: normalizedSku,
      name: normalizedName,
      dept_id: normalizedDept,
      cost: payload.cost,
      retail_price: payload.retail_price,
      in_stock: payload.in_stock,
      tax_1: primaryTaxRate,
      tax_2: secondaryTaxRate,
      special_pricing_enabled: hasSpecialPricing ? 1 : 0,
      special_price: hasSpecialPricing ? payload.special_pricing[0].price : null,
      category: deptParts[0],
      quantity: payload.in_stock,
      vendor_number: payload.vendor_number
    }

    let productId = payload.item_number

    if (productId) {
      db.prepare(
        `
        UPDATE products
        SET
          sku = @sku,
          name = @name,
          dept_id = @dept_id,
          category = @category,
          cost = @cost,
          price = @retail_price,
          retail_price = @retail_price,
          quantity = @quantity,
          in_stock = @in_stock,
          tax_rate = @tax_1,
          tax_1 = @tax_1,
          tax_2 = @tax_2,
          special_pricing_enabled = @special_pricing_enabled,
          special_price = @special_price,
          vendor_number = @vendor_number,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
        `
      ).run({ ...statementPayload, id: productId })
    } else {
      const result = db
        .prepare(
          `
          INSERT INTO products (
            sku, name, category, price, cost, quantity, tax_rate,
            dept_id, retail_price, in_stock, tax_1, tax_2,
            special_pricing_enabled, special_price, vendor_number
          )
          VALUES (
            @sku, @name, @category, @retail_price, @cost, @quantity, @tax_1,
            @dept_id, @retail_price, @in_stock, @tax_1, @tax_2,
            @special_pricing_enabled, @special_price, @vendor_number
          )
          `
        )
        .run(statementPayload)

      productId = Number(result.lastInsertRowid)
    }

    db.prepare('DELETE FROM product_alt_skus WHERE product_id = ?').run(productId)

    const insertAltSku = db.prepare(
      `
      INSERT INTO product_alt_skus (product_id, alt_sku)
      VALUES (?, ?)
      `
    )

    for (const additionalSku of normalizedAdditionalSkus) {
      insertAltSku.run(productId, additionalSku)
    }

    // Save special pricing rules
    db.prepare('DELETE FROM special_pricing WHERE product_id = ?').run(productId)

    const insertPricingRule = db.prepare(
      `
      INSERT INTO special_pricing (product_id, quantity, price, duration_days)
      VALUES (?, ?, ?, ?)
      `
    )

    for (const rule of payload.special_pricing) {
      insertPricingRule.run(productId, rule.quantity, rule.price, rule.duration_days)
    }

    return productId
  })

  const productId = tx(input)
  const detail = getInventoryProductDetail(productId)

  if (!detail) {
    throw new Error('Failed to load saved inventory item')
  }

  return detail
}
