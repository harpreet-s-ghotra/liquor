/**
 * Initial product reconciliation.
 *
 * Runs once on startup (after device registration and sync worker start) to
 * converge the local SQLite product catalog with the remote merchant_products
 * table.  Uses last-write-wins (LWW) semantics keyed on updated_at.
 *
 * After reconciling remote→local, any local products that have no cloud_id are
 * uploaded via the existing uploadProduct path so they appear in the cloud.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import { getDeviceConfig } from '../../database/device-config.repo'
import { applyRemoteProductChange, uploadProduct } from './product-sync'
import type { ProductSyncPayload } from './types'

const BATCH_SIZE = 500

export type InitialSyncResult = {
  products_applied: number
  products_uploaded: number
  errors: string[]
}

// ── Helpers ──

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

function getLocalProductSyncPayload(id: number): ProductSyncPayload {
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
        updated_at
      FROM products
      WHERE id = ?
      LIMIT 1
      `
    )
    .get(id) as ProductSyncPayload['product'] | undefined

  if (!product) throw new Error(`Product ${id} not found for initial sync upload`)

  const alt_skus = db
    .prepare('SELECT alt_sku FROM product_alt_skus WHERE product_id = ? ORDER BY alt_sku')
    .all(id)
    .map((r) => String((r as { alt_sku: string }).alt_sku))

  const special_pricing = db
    .prepare(
      'SELECT quantity, price, duration_days FROM special_pricing WHERE product_id = ? ORDER BY quantity'
    )
    .all(id) as ProductSyncPayload['special_pricing']

  return { product, alt_skus, special_pricing }
}

// ── Main reconciliation ──

/**
 * Pull all remote products for this merchant and reconcile them into local
 * SQLite using LWW.  Then upload any local-only products (no cloud_id) that
 * were not covered by the remote pull.
 */
export async function reconcileProducts(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string
): Promise<InitialSyncResult> {
  const result: InitialSyncResult = { products_applied: 0, products_uploaded: 0, errors: [] }

  // ── Step 1: Pull remote rows in pages and apply via LWW ──
  let lastUpdatedAt: string | null = null
  let lastId: string | null = null
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('merchant_products')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(BATCH_SIZE)

    if (lastUpdatedAt && lastId) {
      query = query.or(
        `updated_at.gt.${lastUpdatedAt},and(updated_at.eq.${lastUpdatedAt},id.gt.${lastId})`
      )
    }

    const { data, error } = await query

    if (error) {
      result.errors.push(`Remote product fetch failed: ${error.message}`)
      break
    }

    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    for (const row of data) {
      try {
        const localProduct = getDb()
          .prepare('SELECT id, updated_at, cloud_id FROM products WHERE sku = ? LIMIT 1')
          .get(row.sku) as { id: number; updated_at: string; cloud_id: string | null } | undefined

        if (localProduct && toTimestamp(localProduct.updated_at) >= toTimestamp(row.updated_at)) {
          // Local is at least as fresh; still record the cloud_id if missing
          if (!localProduct.cloud_id) {
            getDb()
              .prepare(
                'UPDATE products SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP WHERE id = ?'
              )
              .run(String(row.id), localProduct.id)
          }
          continue
        }

        await applyRemoteProductChange(supabase, merchantId, row)
        result.products_applied++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Apply failed for SKU ${row.sku}: ${msg}`)
      }
    }

    const last = data[data.length - 1]
    lastUpdatedAt = last.updated_at as string
    lastId = last.id as string
    hasMore = data.length === BATCH_SIZE
  }

  // ── Step 2: Upload local-only products (no cloud_id) ──
  const localOnly = getDb()
    .prepare(
      `SELECT id FROM products WHERE is_active = 1 AND (cloud_id IS NULL OR cloud_id = '') ORDER BY id`
    )
    .all() as { id: number }[]

  for (const { id } of localOnly) {
    try {
      const payload = getLocalProductSyncPayload(id)
      await uploadProduct(supabase, merchantId, deviceId, payload)
      result.products_uploaded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Upload failed for product id=${id}: ${msg}`)
    }
  }

  return result
}

/**
 * Run the full initial product reconciliation.  Errors are logged but do not
 * throw so a single bad row never blocks startup.
 */
export async function runInitialSync(supabase: SupabaseClient, merchantId: string): Promise<void> {
  const device = getDeviceConfig()
  if (!device) {
    console.warn('[initial-sync] No device config found — skipping initial sync')
    return
  }

  console.log('[initial-sync] Starting product reconciliation…')

  try {
    const result = await reconcileProducts(supabase, merchantId, device.device_id)

    console.log(
      `[initial-sync] Done: applied=${result.products_applied} uploaded=${result.products_uploaded} errors=${result.errors.length}`
    )

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.error(`[initial-sync] ${err}`)
      }
    }
  } catch (err) {
    console.error('[initial-sync] Fatal error during reconciliation:', err)
  }
}
