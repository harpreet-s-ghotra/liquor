import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { getInventoryDeltaSyncPayload, recordDelta } from './inventory-deltas.repo'
import { createCostLayer } from './product-cost-layers.repo'
import { normalizeSearch } from './schema'
import { enqueueSyncItem } from './sync-queue.repo'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../shared/constants'
// import { normalizeSize } from '../../shared/utils/size' // (was unused)
import type {
  Product,
  InventoryProduct,
  InventoryProductDetail,
  ReorderDistributorRow,
  ReorderProduct,
  ReorderQuery,
  TransactionHistoryItem,
  SpecialPricingRule,
  ActiveSpecialPricingRule,
  InventoryTaxCode,
  SaveInventoryItemInput
} from '../../shared/types'
import type { ProductSyncPayload } from '../services/sync/types'

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
        COALESCE(display_name, name) AS name,
        category,
        size,
        COALESCE(retail_price, price) AS price,
        COALESCE(in_stock, quantity) AS quantity,
        COALESCE(tax_1, tax_rate) AS tax_rate,
        COALESCE(bottles_per_case, 12) AS bottles_per_case,
        case_discount_price,
        COALESCE(is_favorite, 0) AS is_favorite,
        COALESCE(is_discontinued, 0) AS is_discontinued
      FROM products
      WHERE is_active = 1
        AND (COALESCE(retail_price, 0) > 0 OR COALESCE(price, 0) > 0)
      ORDER BY name
      `
    )
    .all() as Product[]
}

export function hasAnyActiveProduct(): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS present
       FROM products
       WHERE is_active = 1
         AND (COALESCE(retail_price, 0) > 0 OR COALESCE(price, 0) > 0)
       LIMIT 1`
    )
    .get() as { present: number } | undefined
  return !!row
}

export function getInventoryProducts(): InventoryProduct[] {
  return getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.item_type,
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
        products.ttb_id,
        products.display_name,
        COALESCE(products.is_discontinued, 0) AS is_discontinued
      FROM products
      LEFT JOIN distributors ON distributors.distributor_number = products.distributor_number
      WHERE products.is_active = 1
      ORDER BY products.id
      `
    )
    .all() as InventoryProduct[]
}

export function getInventoryItemTypes(): string[] {
  return getDb()
    .prepare(
      `
      SELECT name
      FROM (
        SELECT TRIM(name) AS name
        FROM item_types

        UNION

        SELECT COALESCE(NULLIF(TRIM(item_type), ''), NULLIF(TRIM(dept_id), '')) AS name
        FROM products
        WHERE is_active = 1
      )
      WHERE name IS NOT NULL AND name != ''
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
  filters: { departmentId?: number; distributorNumber?: number; size?: string } = {}
): Product[] {
  const normalizedQuery = query.trim()

  const conditions: string[] = ['p.is_active = 1']
  const params: Record<string, unknown> = {}

  if (normalizedQuery) {
    conditions.push('(normalize_search(p.name) LIKE @likeQuery OR p.sku LIKE @rawLikeQuery)')
    params.likeQuery = `%${normalizeSearch(normalizedQuery)}%`
    params.rawLikeQuery = `%${normalizedQuery}%`
  }

  if (filters.departmentId != null) {
    conditions.push('it.id = @departmentId')
    params.departmentId = filters.departmentId
  }
  if (filters.distributorNumber != null) {
    conditions.push('p.distributor_number = @distributorNumber')
    params.distributorNumber = filters.distributorNumber
  }
  if (filters.size != null && filters.size.trim() !== '') {
    conditions.push('p.size = @size')
    params.size = filters.size.trim()
  }

  return getDb()
    .prepare(
      `
      SELECT
        p.id,
        p.sku,
        COALESCE(p.display_name, p.name) AS name,
        p.category,
        p.size,
        d.distributor_name,
        COALESCE(p.retail_price, p.price) AS price,
        COALESCE(p.in_stock, p.quantity) AS quantity,
        COALESCE(p.tax_1, p.tax_rate) AS tax_rate,
        COALESCE(p.bottles_per_case, 12) AS bottles_per_case,
        p.case_discount_price
      FROM products p
      LEFT JOIN item_types it ON it.name = p.item_type
      LEFT JOIN distributors d ON d.distributor_number = p.distributor_number
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.name ASC
      LIMIT 100
      `
    )
    .all(params) as Product[]
}

export function searchInventoryProducts(query: string): InventoryProduct[] {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return getInventoryProducts()
  }

  const likeQuery = `%${normalizeSearch(normalizedQuery)}%`
  const rawLikeQuery = `%${normalizedQuery}%`

  return getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.item_type,
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
        products.ttb_id,
        products.display_name,
        COALESCE(products.is_discontinued, 0) AS is_discontinued
      FROM products
      LEFT JOIN distributors ON distributors.distributor_number = products.distributor_number
      WHERE products.is_active = 1
        AND (
          products.sku LIKE @rawLikeQuery
          OR normalize_search(products.name) LIKE @likeQuery
          OR normalize_search(products.brand_name) LIKE @likeQuery
        )
      ORDER BY products.id
      LIMIT 20
      `
    )
    .all({ likeQuery, rawLikeQuery }) as InventoryProduct[]
}

export function getInventoryProductDetail(itemNumber: number): InventoryProductDetail | null {
  const product = getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.item_type,
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
        products.ttb_id,
        products.display_name,
        COALESCE(products.is_favorite, 0) AS is_favorite,
        COALESCE(products.is_discontinued, 0) AS is_discontinued
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
        t.finix_authorization_id,
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
      SELECT quantity, price
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
 * Return all special pricing rules for active products for POS cart evaluation.
 * Rules are permanent until the merchant deletes them.
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
      ORDER BY sp.product_id, sp.quantity
      `
    )
    .all() as ActiveSpecialPricingRule[]
}

function getProductSyncPayload(itemNumber: number): ProductSyncPayload {
  const db = getDb()
  const product = db
    .prepare(
      `
      SELECT
        id,
        cloud_id,
        sku,
        name,
        description,
        category,
        price,
        cost,
        COALESCE(retail_price, price) AS retail_price,
        COALESCE(in_stock, quantity, 0) AS in_stock,
        tax_1,
        tax_2,
        distributor_number,
        COALESCE(bottles_per_case, 12) AS bottles_per_case,
        case_discount_price,
        special_pricing_enabled,
        special_price,
        barcode,
        is_active,
        item_type,
        size,
        case_cost,
        brand_name,
        proof,
        alcohol_pct,
        vintage,
        ttb_id,
        is_discontinued,
        updated_at
      FROM products
      WHERE id = ?
      LIMIT 1
      `
    )
    .get(itemNumber) as ProductSyncPayload['product'] | undefined

  if (!product) {
    throw new Error('Product not found for sync')
  }

  const alt_skus = db
    .prepare(
      `
      SELECT alt_sku
      FROM product_alt_skus
      WHERE product_id = ?
      ORDER BY alt_sku
      `
    )
    .all(itemNumber)
    .map((row) => String((row as { alt_sku: string }).alt_sku))

  const special_pricing = db
    .prepare(
      `
      SELECT quantity, price
      FROM special_pricing
      WHERE product_id = ?
      ORDER BY quantity
      `
    )
    .all(itemNumber) as ProductSyncPayload['special_pricing']

  return { product, alt_skus, special_pricing }
}

function enqueueProductSync(itemNumber: number, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
  const device = getDeviceConfig()
  if (!device) return

  const payload = getProductSyncPayload(itemNumber)
  enqueueSyncItem({
    entity_type: 'product',
    entity_id: String(itemNumber),
    operation,
    payload: JSON.stringify(payload),
    device_id: device.device_id
  })
}

function enqueueInventoryDeltaSync(deltaId: number): void {
  const device = getDeviceConfig()
  if (!device) return

  const payload = getInventoryDeltaSyncPayload(deltaId)
  if (!payload) return

  enqueueSyncItem({
    entity_type: 'inventory_delta',
    entity_id: String(deltaId),
    operation: 'INSERT',
    payload: JSON.stringify(payload),
    device_id: device.device_id
  })
}

// ── Write operations ──

export function saveInventoryItem(input: SaveInventoryItemInput): InventoryProductDetail {
  const db = getDb()

  const normalizedSku = input.sku.trim()
  const normalizedName = input.item_name.trim()
  const normalizedItemType = input.item_type.trim()

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
        rule.price < 0
    )
  ) {
    throw new Error('Special pricing rules must have valid quantity and price')
  }

  if (normalizedItemType) {
    const allowedItemTypes = new Set(getInventoryItemTypes())
    const itemTypeParts = normalizedItemType
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)
    for (const part of itemTypeParts) {
      if (!allowedItemTypes.has(part)) {
        throw new Error('Item type must be selected from available item types')
      }
    }
  }

  const itemTypeParts = normalizedItemType
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

  const targetProductId = input.item_number ?? inactiveMatch?.id ?? null
  const existingProduct = targetProductId
    ? (db
        .prepare(
          `
          SELECT id, COALESCE(in_stock, quantity, 0) AS in_stock
          FROM products
          WHERE id = ?
          LIMIT 1
          `
        )
        .get(targetProductId) as { id: number; in_stock: number } | undefined)
    : undefined
  const previousInStock = existingProduct?.in_stock ?? 0
  const syncOperation = input.item_number == null && inactiveMatch == null ? 'INSERT' : 'UPDATE'

  const tx = db.transaction((payload: SaveInventoryItemInput) => {
    // On INSERT (new item, no user-selected tax rate), fall back to the
    // merchant's default tax code so "Apply to all items" sticks for future items.
    const isInsert = payload.item_number == null && inactiveMatch == null
    let effectiveTaxRates = normalizedTaxRates
    if (isInsert && effectiveTaxRates.length === 0) {
      const defaultRow = db
        .prepare('SELECT rate FROM tax_codes WHERE is_default = 1 LIMIT 1')
        .get() as { rate: number } | undefined
      if (defaultRow) {
        effectiveTaxRates = [normalizeTaxRate(defaultRow.rate)]
      }
    }
    const primaryTaxRate = effectiveTaxRates.length > 0 ? effectiveTaxRates[0] : null
    const secondaryTaxRate = effectiveTaxRates.length > 1 ? effectiveTaxRates[1] : null
    const hasSpecialPricing = payload.special_pricing.length > 0

    const statementPayload = {
      sku: normalizedSku,
      name: normalizedName,
      cost: payload.cost,
      retail_price: payload.retail_price,
      in_stock: payload.in_stock,
      tax_1: primaryTaxRate,
      tax_2: secondaryTaxRate,
      special_pricing_enabled: hasSpecialPricing ? 1 : 0,
      special_price: hasSpecialPricing ? payload.special_pricing[0].price : null,
      category: itemTypeParts[0] ?? '',
      quantity: payload.in_stock,
      distributor_number: payload.distributor_number,
      bottles_per_case: payload.bottles_per_case,
      case_discount_price: payload.case_discount_price,
      item_type: normalizedItemType || null,
      size: payload.size || null,
      case_cost: payload.case_cost,
      nysla_discounts: payload.nysla_discounts,
      brand_name: payload.brand_name || null,
      proof: payload.proof,
      alcohol_pct: payload.alcohol_pct,
      vintage: payload.vintage || null,
      ttb_id: payload.ttb_id || null,
      display_name: payload.display_name || null,
      is_favorite: payload.is_favorite ?? 0,
      is_discontinued: payload.is_discontinued ? 1 : 0
    }

    let productId = payload.item_number ?? inactiveMatch?.id

    if (productId) {
      db.prepare(
        `
        UPDATE products
        SET
          sku = @sku,
          name = @name,
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
          display_name = @display_name,
          is_favorite = @is_favorite,
          is_discontinued = @is_discontinued,
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
            retail_price, in_stock, tax_1, tax_2,
            special_pricing_enabled, special_price, distributor_number,
            bottles_per_case, case_discount_price,
            item_type, size, case_cost, nysla_discounts,
            brand_name, proof, alcohol_pct, vintage, ttb_id, display_name, is_favorite,
            is_discontinued
          )
          VALUES (
            @sku, @name, @category, @retail_price, @cost, @quantity, @tax_1,
            @retail_price, @in_stock, @tax_1, @tax_2,
            @special_pricing_enabled, @special_price, @distributor_number,
            @bottles_per_case, @case_discount_price,
            @item_type, @size, @case_cost, @nysla_discounts,
            @brand_name, @proof, @alcohol_pct, @vintage, @ttb_id, @display_name, @is_favorite,
            @is_discontinued
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
      INSERT INTO special_pricing (product_id, quantity, price)
      VALUES (?, ?, ?)
      `
    )

    for (const rule of payload.special_pricing) {
      insertPricingRule.run(productId, rule.quantity, rule.price)
    }

    return productId
  })

  const productId = tx(input)
  const detail = getInventoryProductDetail(productId)

  if (!detail) {
    throw new Error('Failed to load saved inventory item')
  }

  const device = getDeviceConfig()
  const stockDelta = detail.in_stock - previousInStock

  try {
    enqueueProductSync(detail.item_number, syncOperation)
  } catch {
    // Sync enqueue failure must never block inventory saves
  }

  if (stockDelta !== 0) {
    if (stockDelta > 0) {
      createCostLayer({
        productId: detail.item_number,
        quantity: stockDelta,
        costPerUnit: detail.cost,
        source: 'manual_adjustment',
        sourceReference: `inventory-item-${detail.item_number}`,
        deviceId: device?.device_id ?? null
      })
    }

    const deltaId = recordDelta({
      product_id: detail.item_number,
      product_sku: detail.sku,
      delta: stockDelta,
      reason: 'manual_adjustment',
      device_id: device?.device_id ?? null
    })

    try {
      enqueueInventoryDeltaSync(deltaId)
    } catch {
      // Sync enqueue failure must never block inventory saves
    }
  }

  return detail
}

/**
 * Apply a tax code's rate to every active product AND mark that code as the
 * merchant's default so future creates/imports inherit the rate automatically.
 * Runs in a single transaction so the existing items and the default flag
 * always agree.
 */
export function applyTaxToAllProducts(taxCodeId: number): number {
  const db = getDb()
  const taxCode = db.prepare('SELECT id, rate FROM tax_codes WHERE id = ?').get(taxCodeId) as
    | { id: number; rate: number }
    | undefined

  if (!taxCode) {
    throw new Error('Tax code not found')
  }

  let updatedCount = 0
  const tx = db.transaction(() => {
    // Mark this tax code as default, clear default on others
    db.prepare('UPDATE tax_codes SET is_default = 0 WHERE is_default = 1').run()
    db.prepare(
      'UPDATE tax_codes SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(taxCodeId)

    // Apply the rate to every active product
    const result = db
      .prepare(`UPDATE products SET tax_1 = ?, updated_at = CURRENT_TIMESTAMP WHERE is_active = 1`)
      .run(taxCode.rate)
    updatedCount = result.changes
  })
  tx()
  return updatedCount
}

export function deleteInventoryItem(itemNumber: number): void {
  const db = getDb()
  db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    itemNumber
  )

  try {
    enqueueProductSync(itemNumber, 'DELETE')
  } catch {
    // Sync enqueue failure must never block inventory deletes
  }
}

export function setProductDiscontinued(id: number, discontinued: boolean): void {
  const db = getDb()
  db.prepare(
    `UPDATE products
     SET is_discontinued = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(discontinued ? 1 : 0, id)

  try {
    enqueueProductSync(id, 'UPDATE')
  } catch {
    // Sync enqueue failure must never block inventory updates
  }
}

export function getDistributorsWithReorderable(): ReorderDistributorRow[] {
  return getDb()
    .prepare(
      `SELECT
        p.distributor_number,
        d.distributor_name,
        COUNT(*) AS product_count
      FROM products p
      LEFT JOIN distributors d ON p.distributor_number = d.distributor_number
      WHERE p.is_active = 1
        AND COALESCE(p.is_discontinued, 0) = 0
        AND COALESCE(p.retail_price, p.price, 0) > 0
      GROUP BY p.distributor_number, d.distributor_name
      ORDER BY d.distributor_name IS NULL, d.distributor_name ASC`
    )
    .all() as ReorderDistributorRow[]
}

export function getReorderProducts(
  query: ReorderQuery,
  velocityBySku?: ReadonlyMap<string, number>
): ReorderProduct[] {
  const distributorClause =
    query.distributor === 'unassigned'
      ? 'p.distributor_number IS NULL'
      : 'p.distributor_number = @distributor_number'

  const rows = getDb()
    .prepare(
      `SELECT
        p.id,
        p.sku,
        COALESCE(p.display_name, p.name) AS name,
        p.item_type,
        COALESCE(p.in_stock, 0) AS in_stock,
        COALESCE(p.reorder_point, 0) AS reorder_point,
        p.distributor_number,
        d.distributor_name,
        COALESCE(
          NULLIF(p.cost, 0),
          CASE
            WHEN COALESCE(p.bottles_per_case, 0) > 0 AND COALESCE(p.case_cost, 0) > 0
              THEN p.case_cost / CAST(p.bottles_per_case AS REAL)
          END,
          0
        ) AS cost,
        CASE
          WHEN COALESCE(p.bottles_per_case, 0) > 0 THEN p.bottles_per_case
          ELSE 12
        END AS bottles_per_case,
        COALESCE(p.retail_price, p.price, 0) AS price
      FROM products p
      LEFT JOIN distributors d ON p.distributor_number = d.distributor_number
      WHERE p.is_active = 1
        AND COALESCE(p.is_discontinued, 0) = 0
        AND COALESCE(p.retail_price, p.price, 0) > 0
        AND ${distributorClause}`
    )
    .all(
      query.distributor === 'unassigned' ? {} : { distributor_number: query.distributor }
    ) as Array<{
    id: number
    sku: string
    name: string
    item_type: string | null
    in_stock: number
    reorder_point: number
    distributor_number: number | null
    distributor_name: string | null
    cost: number
    bottles_per_case: number
    price: number
  }>

  return rows
    .map((row) => {
      const velocityPerDay = Number(velocityBySku?.get(row.sku) ?? 0)
      const projectedStock = row.in_stock - velocityPerDay * query.window_days
      return {
        ...row,
        velocity_per_day: velocityPerDay,
        days_of_supply: velocityPerDay > 0 ? row.in_stock / velocityPerDay : null,
        projected_stock: projectedStock
      }
    })
    .filter((row) => row.projected_stock < query.unit_threshold)
    .sort((left, right) => left.projected_stock - right.projected_stock)
}

export function getUnpricedInventoryProducts(): InventoryProduct[] {
  return getDb()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.item_type,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price, 0) AS retail_price,
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
        products.size,
        products.case_cost,
        products.nysla_discounts,
        products.brand_name,
        products.proof,
        products.reorder_point
      FROM products
      LEFT JOIN distributors ON products.distributor_number = distributors.distributor_number
      WHERE products.is_active = 1
        AND COALESCE(products.retail_price, 0) = 0
        AND COALESCE(products.price, 0) = 0
      ORDER BY products.name
      `
    )
    .all() as InventoryProduct[]
}

export function findProductBySku(sku: string): Product | null {
  const term = sku.trim().toLowerCase()
  if (!term) return null
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT
        p.id,
        p.sku,
        COALESCE(p.display_name, p.name) AS name,
        p.category,
        p.size,
        COALESCE(p.retail_price, p.price, 0) AS price,
        COALESCE(p.in_stock, p.quantity) AS quantity,
        COALESCE(p.tax_1, p.tax_rate) AS tax_rate,
        COALESCE(p.bottles_per_case, 12) AS bottles_per_case,
        p.case_discount_price
      FROM products p
      WHERE p.is_active = 1
        AND (
          lower(p.sku) = ?
          OR lower(p.barcode) = ?
          OR EXISTS (
            SELECT 1 FROM product_alt_skus a
            WHERE a.product_id = p.id AND lower(a.alt_sku) = ?
          )
        )
      LIMIT 1
      `
    )
    .get(term, term, term) as Product | undefined
  return row ?? null
}

export function toggleFavorite(productId: number): void {
  getDb()
    .prepare(
      `
      UPDATE products
      SET is_favorite = CASE WHEN COALESCE(is_favorite, 0) = 0 THEN 1 ELSE 0 END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_active = 1
      `
    )
    .run(productId)

  try {
    enqueueProductSync(productId, 'UPDATE')
  } catch {
    // Sync enqueue failure must never block inventory writes
  }
}

export function getDistinctSizes(): string[] {
  return getDb()
    .prepare(
      `
      SELECT size, COUNT(*) AS count
      FROM products
      WHERE size IS NOT NULL AND TRIM(size) != ''
      GROUP BY size
      ORDER BY count DESC, size ASC
      LIMIT 100
      `
    )
    .all()
    .map((row) => String((row as { size: string }).size))
}
