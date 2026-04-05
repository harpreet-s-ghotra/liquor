import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudProductPayload, ProductSyncPayload } from './types'

type RemoteMerchantProductRow = Omit<CloudProductPayload, 'merchant_id'> & {
  id: string
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function resolveDistributorNumber(distributorNumber: number | null): number | null {
  if (distributorNumber == null) return null

  const db = getDb()
  const row = db
    .prepare('SELECT distributor_number FROM distributors WHERE distributor_number = ? LIMIT 1')
    .get(distributorNumber) as { distributor_number: number } | undefined

  return row ? distributorNumber : null
}

async function syncRelatedRows(
  supabase: SupabaseClient,
  merchantId: string,
  sku: string,
  altSkus: string[],
  specialPricing: ProductSyncPayload['special_pricing']
): Promise<void> {
  await supabase
    .from('merchant_product_alt_skus')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('product_sku', sku)

  if (altSkus.length > 0) {
    const { error: altSkuError } = await supabase.from('merchant_product_alt_skus').insert(
      altSkus.map((altSku) => ({
        merchant_id: merchantId,
        product_sku: sku,
        alt_sku: altSku
      }))
    )

    if (altSkuError) {
      throw new Error(`Product alternate SKU upload failed: ${altSkuError.message}`)
    }
  }

  await supabase
    .from('merchant_special_pricing')
    .delete()
    .eq('merchant_id', merchantId)
    .eq('product_sku', sku)

  if (specialPricing.length > 0) {
    const { error: pricingError } = await supabase.from('merchant_special_pricing').insert(
      specialPricing.map((rule) => ({
        merchant_id: merchantId,
        product_sku: sku,
        quantity: rule.quantity,
        price: rule.price,
        duration_days: rule.duration_days
      }))
    )

    if (pricingError) {
      throw new Error(`Product special pricing upload failed: ${pricingError.message}`)
    }
  }
}

export async function uploadProduct(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: ProductSyncPayload
): Promise<void> {
  const { product, alt_skus, special_pricing } = payload

  const cloudProduct: CloudProductPayload = {
    merchant_id: merchantId,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    cost: product.cost,
    retail_price: product.retail_price,
    in_stock: product.in_stock,
    tax_1: product.tax_1,
    tax_2: product.tax_2,
    dept_id: product.dept_id,
    distributor_number: product.distributor_number,
    bottles_per_case: product.bottles_per_case,
    case_discount_price: product.case_discount_price,
    special_pricing_enabled: product.special_pricing_enabled,
    special_price: product.special_price,
    barcode: product.barcode,
    is_active: product.is_active,
    item_type: product.item_type,
    size: product.size,
    case_cost: product.case_cost,
    brand_name: product.brand_name,
    proof: product.proof,
    alcohol_pct: product.alcohol_pct,
    vintage: product.vintage,
    ttb_id: product.ttb_id,
    device_id: deviceId,
    updated_at: product.updated_at
  }

  const { data, error } = await supabase
    .from('merchant_products')
    .upsert(cloudProduct, { onConflict: 'merchant_id,sku' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Product upload failed: ${error?.message ?? 'unknown'}`)
  }

  await syncRelatedRows(supabase, merchantId, product.sku, alt_skus, special_pricing)

  getDb()
    .prepare(
      `
      UPDATE products
      SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?
      WHERE id = ?
      `
    )
    .run(data.id as string, deviceId, product.id)
}

export async function applyRemoteProductChange(
  supabase: SupabaseClient,
  merchantId: string,
  row: RemoteMerchantProductRow
): Promise<void> {
  const db = getDb()
  const localProduct = db
    .prepare('SELECT id, updated_at FROM products WHERE sku = ? LIMIT 1')
    .get(row.sku) as { id: number; updated_at: string } | undefined

  if (localProduct && toTimestamp(localProduct.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  const [{ data: altSkus, error: altSkuError }, { data: pricingRows, error: pricingError }] =
    await Promise.all([
      supabase
        .from('merchant_product_alt_skus')
        .select('alt_sku')
        .eq('merchant_id', merchantId)
        .eq('product_sku', row.sku),
      supabase
        .from('merchant_special_pricing')
        .select('quantity, price, duration_days')
        .eq('merchant_id', merchantId)
        .eq('product_sku', row.sku)
    ])

  if (altSkuError) {
    throw new Error(`Failed to fetch remote alternate SKUs: ${altSkuError.message}`)
  }

  if (pricingError) {
    throw new Error(`Failed to fetch remote special pricing: ${pricingError.message}`)
  }

  const distributorNumber = resolveDistributorNumber(
    (row.distributor_number as number | null) ?? null
  )

  const tx = db.transaction(() => {
    let productId = localProduct?.id

    const writeParams = {
      sku: String(row.sku),
      name: String(row.name),
      description: (row.description as string | null) ?? null,
      category: (row.category as string | null) ?? '',
      price: Number(row.price ?? row.retail_price ?? 0),
      cost: (row.cost as number | null) ?? null,
      retail_price: Number(row.retail_price ?? row.price ?? 0),
      quantity: Number(row.in_stock ?? 0),
      in_stock: Number(row.in_stock ?? 0),
      tax_rate: Number(row.tax_1 ?? 0),
      tax_1: (row.tax_1 as number | null) ?? null,
      tax_2: Number(row.tax_2 ?? 0),
      dept_id: (row.dept_id as string | null) ?? null,
      distributor_number: distributorNumber,
      bottles_per_case: Number(row.bottles_per_case ?? 12),
      case_discount_price: (row.case_discount_price as number | null) ?? null,
      special_pricing_enabled: Number(row.special_pricing_enabled ?? 0),
      special_price: (row.special_price as number | null) ?? null,
      barcode: (row.barcode as string | null) ?? null,
      is_active: Number(row.is_active ?? 1),
      item_type: (row.item_type as string | null) ?? null,
      size: (row.size as string | null) ?? null,
      case_cost: (row.case_cost as number | null) ?? null,
      brand_name: (row.brand_name as string | null) ?? null,
      proof: (row.proof as number | null) ?? null,
      alcohol_pct: (row.alcohol_pct as number | null) ?? null,
      vintage: (row.vintage as string | null) ?? null,
      ttb_id: (row.ttb_id as string | null) ?? null,
      cloud_id: String(row.id),
      device_id: (row.device_id as string | null) ?? null,
      updated_at: String(row.updated_at)
    }

    if (productId != null) {
      db.prepare(
        `
        UPDATE products
        SET
          sku = @sku,
          name = @name,
          description = @description,
          category = @category,
          price = @price,
          cost = @cost,
          retail_price = @retail_price,
          quantity = @quantity,
          in_stock = @in_stock,
          tax_rate = @tax_rate,
          tax_1 = @tax_1,
          tax_2 = @tax_2,
          dept_id = @dept_id,
          distributor_number = @distributor_number,
          bottles_per_case = @bottles_per_case,
          case_discount_price = @case_discount_price,
          special_pricing_enabled = @special_pricing_enabled,
          special_price = @special_price,
          barcode = @barcode,
          is_active = @is_active,
          item_type = @item_type,
          size = @size,
          case_cost = @case_cost,
          brand_name = @brand_name,
          proof = @proof,
          alcohol_pct = @alcohol_pct,
          vintage = @vintage,
          ttb_id = @ttb_id,
          cloud_id = @cloud_id,
          synced_at = CURRENT_TIMESTAMP,
          last_modified_by_device = @device_id,
          updated_at = @updated_at
        WHERE id = @id
        `
      ).run({ ...writeParams, id: productId })
    } else {
      const result = db
        .prepare(
          `
          INSERT INTO products (
            sku,
            name,
            description,
            category,
            price,
            cost,
            quantity,
            tax_rate,
            dept_id,
            retail_price,
            in_stock,
            tax_1,
            tax_2,
            distributor_number,
            bottles_per_case,
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
            cloud_id,
            synced_at,
            last_modified_by_device,
            updated_at
          )
          VALUES (
            @sku,
            @name,
            @description,
            @category,
            @price,
            @cost,
            @quantity,
            @tax_rate,
            @dept_id,
            @retail_price,
            @in_stock,
            @tax_1,
            @tax_2,
            @distributor_number,
            @bottles_per_case,
            @case_discount_price,
            @special_pricing_enabled,
            @special_price,
            @barcode,
            @is_active,
            @item_type,
            @size,
            @case_cost,
            @brand_name,
            @proof,
            @alcohol_pct,
            @vintage,
            @ttb_id,
            @cloud_id,
            CURRENT_TIMESTAMP,
            @device_id,
            @updated_at
          )
          `
        )
        .run(writeParams)

      productId = Number(result.lastInsertRowid)
    }

    db.prepare('DELETE FROM product_alt_skus WHERE product_id = ?').run(productId)
    const insertAltSku = db.prepare(
      'INSERT INTO product_alt_skus (product_id, alt_sku) VALUES (?, ?)'
    )
    for (const row of altSkus ?? []) {
      insertAltSku.run(productId, (row as { alt_sku: string }).alt_sku)
    }

    db.prepare('DELETE FROM special_pricing WHERE product_id = ?').run(productId)
    const insertPricing = db.prepare(
      'INSERT INTO special_pricing (product_id, quantity, price, duration_days) VALUES (?, ?, ?, ?)'
    )
    for (const pricingRow of pricingRows ?? []) {
      const rule = pricingRow as { quantity: number; price: number; duration_days: number }
      insertPricing.run(productId, rule.quantity, rule.price, rule.duration_days)
    }
  })

  tx()
}
