import { getDb } from './connection'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../shared/constants'
import type {
  Product,
  InventoryProduct,
  InventoryProductDetail,
  TransactionHistoryItem,
  SpecialPricingRule,
  ActiveSpecialPricingRule,
  InventoryTaxCode,
  SaveInventoryItemInput
} from '../../shared/types'

// ── Helpers ──

function normalizeTaxRate(value: number): number {
  return Number(value.toFixed(6))
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
        products.distributor_number,
        distributors.distributor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.case_discount_price,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active,
        products.item_type,
        products.size,
        products.case_cost,
        products.nysla_discounts,
        products.brand_name,
        products.proof,
        products.alcohol_pct,
        products.vintage,
        products.ttb_id
      FROM products
      LEFT JOIN distributors ON distributors.distributor_number = products.distributor_number
      WHERE products.is_active = 1
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

export function searchProducts(
  query: string,
  filters: { departmentId?: number; distributorNumber?: number } = {}
): Product[] {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []

  const conditions = ['p.is_active = 1', '(p.name LIKE @likeQuery OR p.sku LIKE @likeQuery)']
  const params: Record<string, unknown> = { likeQuery: `%${normalizedQuery}%` }

  if (filters.departmentId != null) {
    conditions.push('d.id = @departmentId')
    params.departmentId = filters.departmentId
  }
  if (filters.distributorNumber != null) {
    conditions.push('p.distributor_number = @distributorNumber')
    params.distributorNumber = filters.distributorNumber
  }

  return getDb()
    .prepare(
      `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.category,
        COALESCE(p.retail_price, p.price) AS price,
        COALESCE(p.in_stock, p.quantity) AS quantity,
        COALESCE(p.tax_1, p.tax_rate) AS tax_rate
      FROM products p
      LEFT JOIN departments d ON d.name = p.category
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.name ASC
      LIMIT 50
      `
    )
    .all(params) as Product[]
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
        products.distributor_number,
        distributors.distributor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.case_discount_price,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active,
        products.item_type,
        products.size,
        products.case_cost,
        products.nysla_discounts,
        products.brand_name,
        products.proof,
        products.alcohol_pct,
        products.vintage,
        products.ttb_id
      FROM products
      LEFT JOIN distributors ON distributors.distributor_number = products.distributor_number
      WHERE products.is_active = 1
        AND (products.sku LIKE @likeQuery OR products.name LIKE @likeQuery OR products.brand_name LIKE @likeQuery)
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
        products.distributor_number,
        distributors.distributor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.case_discount_price,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active,
        products.item_type,
        products.size,
        products.case_cost,
        products.nysla_discounts,
        products.brand_name,
        products.proof,
        products.alcohol_pct,
        products.vintage,
        products.ttb_id
      FROM products
      LEFT JOIN distributors ON distributors.distributor_number = products.distributor_number
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
        .filter(
          (taxRate) =>
            taxRate !== null && taxRate !== undefined && Number.isFinite(taxRate) && taxRate >= 0
        )
        .map((taxRate) => normalizeTaxRate(taxRate))
    )
  )

  const salesHistory = getDb()
    .prepare(
      `
      SELECT
        t.id           AS transaction_id,
        t.transaction_number,
        t.created_at,
        ti.quantity,
        ti.unit_price,
        ti.total_price,
        t.payment_method,
        t.stax_transaction_id,
        t.card_last_four,
        t.card_type,
        t.status
      FROM transaction_items ti
      INNER JOIN transactions t ON t.id = ti.transaction_id
      WHERE ti.product_id = ?
      ORDER BY t.created_at DESC
      LIMIT 20
      `
    )
    .all(itemNumber) as TransactionHistoryItem[]

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

/**
 * Return all active (non-expired) special pricing rules for POS cart evaluation.
 * A rule is active if created_at + duration_days >= today.
 */
export function getActiveSpecialPricing(): ActiveSpecialPricingRule[] {
  return getDb()
    .prepare(
      `
      SELECT
        sp.product_id,
        sp.quantity,
        sp.price
      FROM special_pricing sp
      INNER JOIN products p ON p.id = sp.product_id AND p.is_active = 1
      WHERE date(sp.created_at, '+' || sp.duration_days || ' days') >= date('now')
      ORDER BY sp.product_id, sp.quantity
      `
    )
    .all() as ActiveSpecialPricingRule[]
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

  if (normalizedDept) {
    const allowedDepartments = new Set(getInventoryDepartments())
    const deptParts = normalizedDept
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    for (const part of deptParts) {
      if (!allowedDepartments.has(part)) {
        throw new Error('Department must be selected from available departments')
      }
    }
  }

  const deptParts = normalizedDept
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)

  const allowedTaxRates = new Set(getInventoryTaxCodes().map((code) => normalizeTaxRate(code.rate)))
  const normalizedTaxRates = Array.from(
    new Set(
      input.tax_rates
        .filter((taxRate) => Number.isFinite(taxRate) && taxRate >= 0)
        .map((taxRate) => normalizeTaxRate(taxRate))
    )
  )

  if (
    normalizedTaxRates.length > 0 &&
    normalizedTaxRates.some((taxRate) => !allowedTaxRates.has(taxRate))
  ) {
    throw new Error('Tax codes must be selected from available backend tax codes')
  }

  // Only block on active duplicates — inactive rows can be reactivated
  const activeDuplicate = db
    .prepare(
      `
      SELECT id
      FROM products
      WHERE sku = @sku
        AND is_active = 1
        AND (@item_number IS NULL OR id != @item_number)
      LIMIT 1
      `
    )
    .get({ sku: normalizedSku, item_number: input.item_number ?? null }) as
    | { id: number }
    | undefined

  if (activeDuplicate) {
    throw new Error('SKU already exists')
  }

  // If creating a new item and an inactive row has the same SKU, reactivate it.
  // When updating an existing item, prevent assigning a SKU that belongs to a different inactive item.
  let inactiveMatch: { id: number } | undefined

  if (input.item_number == null) {
    inactiveMatch = db
      .prepare(`SELECT id FROM products WHERE sku = @sku AND is_active = 0 LIMIT 1`)
      .get({ sku: normalizedSku }) as { id: number } | undefined
  } else {
    const inactiveDuplicate = db
      .prepare(
        `SELECT id FROM products WHERE sku = @sku AND is_active = 0 AND id != @item_number LIMIT 1`
      )
      .get({ sku: normalizedSku, item_number: input.item_number }) as { id: number } | undefined

    if (inactiveDuplicate) {
      throw new Error('SKU already exists')
    }
  }
  const normalizedAdditionalSkus = Array.from(
    new Set(
      input.additional_skus.map((sku) => sku.trim()).filter((sku) => sku && sku !== normalizedSku)
    )
  )

  // Validate additional SKUs don't conflict with other products' primary or alt SKUs
  for (const altSku of normalizedAdditionalSkus) {
    const primaryConflict = db
      .prepare(
        `
        SELECT id, sku, name
        FROM products
        WHERE sku = @alt_sku
          AND is_active = 1
          AND (@item_number IS NULL OR id != @item_number)
        LIMIT 1
        `
      )
      .get({ alt_sku: altSku, item_number: input.item_number ?? null }) as
      | { id: number; sku: string; name: string }
      | undefined

    if (primaryConflict) {
      throw new Error(
        `Additional SKU "${altSku}" is already the primary SKU of "${primaryConflict.name}"`
      )
    }

    const altConflict = db
      .prepare(
        `
        SELECT pas.alt_sku, p.name
        FROM product_alt_skus pas
        JOIN products p ON p.id = pas.product_id
        WHERE pas.alt_sku = @alt_sku
          AND p.is_active = 1
          AND (@item_number IS NULL OR pas.product_id != @item_number)
        LIMIT 1
        `
      )
      .get({ alt_sku: altSku, item_number: input.item_number ?? null }) as
      | { alt_sku: string; name: string }
      | undefined

    if (altConflict) {
      throw new Error(`Additional SKU "${altSku}" is already used by "${altConflict.name}"`)
    }
  }

  const tx = db.transaction((payload: SaveInventoryItemInput) => {
    const primaryTaxRate = normalizedTaxRates.length > 0 ? normalizedTaxRates[0] : null
    const secondaryTaxRate = normalizedTaxRates.length > 1 ? normalizedTaxRates[1] : null
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
      category: deptParts[0] ?? '',
      quantity: payload.in_stock,
      distributor_number: payload.distributor_number,
      bottles_per_case: payload.bottles_per_case,
      case_discount_price: payload.case_discount_price,
      item_type: payload.item_type || null,
      size: payload.size || null,
      case_cost: payload.case_cost,
      nysla_discounts: payload.nysla_discounts,
      brand_name: payload.brand_name || null,
      proof: payload.proof,
      alcohol_pct: payload.alcohol_pct,
      vintage: payload.vintage || null,
      ttb_id: payload.ttb_id || null
    }

    let productId = payload.item_number ?? inactiveMatch?.id

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
          distributor_number = @distributor_number,
          bottles_per_case = @bottles_per_case,
          case_discount_price = @case_discount_price,
          item_type = @item_type,
          size = @size,
          case_cost = @case_cost,
          nysla_discounts = @nysla_discounts,
          brand_name = @brand_name,
          proof = @proof,
          alcohol_pct = @alcohol_pct,
          vintage = @vintage,
          ttb_id = @ttb_id,
          is_active = 1,
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
            special_pricing_enabled, special_price, distributor_number,
            bottles_per_case, case_discount_price,
            item_type, size, case_cost, nysla_discounts,
            brand_name, proof, alcohol_pct, vintage, ttb_id
          )
          VALUES (
            @sku, @name, @category, @retail_price, @cost, @quantity, @tax_1,
            @dept_id, @retail_price, @in_stock, @tax_1, @tax_2,
            @special_pricing_enabled, @special_price, @distributor_number,
            @bottles_per_case, @case_discount_price,
            @item_type, @size, @case_cost, @nysla_discounts,
            @brand_name, @proof, @alcohol_pct, @vintage, @ttb_id
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

export function deleteInventoryItem(itemNumber: number): void {
  const db = getDb()
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(itemNumber)
}
