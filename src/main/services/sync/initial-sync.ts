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
import { reconcileCashiers } from './cashier-sync'
import { reconcileTaxCodes } from './tax-code-sync'
import { reconcileDistributors } from './distributor-sync'
import { reconcileItemTypes } from './item-type-sync'
import { reconcileDepartments } from './department-sync'
import { reconcileSettings } from './settings-sync'
import { backfillRecentTransactions } from './transaction-backfill'
import type { ProductSyncPayload } from './types'
import type { InitialSyncStatus, InitialSyncEntity } from '../../../shared/types'

const BATCH_SIZE = 500

export type SyncEntity = InitialSyncEntity

export type InitialSyncResult = {
  products_applied: number
  products_uploaded: number
  errors: string[]
}

// Singleton status — polled via IPC by renderer
let _syncStatus: InitialSyncStatus = {
  state: 'idle',
  currentEntity: null,
  entityProgress: { done: 0, total: null },
  completed: [],
  errors: []
}

// Callback invoked when status changes (set by main/index.ts to push to renderer)
let _onStatusChanged: ((status: InitialSyncStatus) => void) | null = null

export function setInitialSyncStatusCallback(cb: (status: InitialSyncStatus) => void): void {
  _onStatusChanged = cb
}

export function getInitialSyncStatus(): InitialSyncStatus {
  return { ..._syncStatus }
}

function updateStatus(patch: Partial<InitialSyncStatus>): void {
  _syncStatus = { ..._syncStatus, ...patch }
  _onStatusChanged?.(_syncStatus)
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
 * Run the full initial reconciliation for all merchant-scoped entities.
 * Errors are logged but do not throw so a single bad row never blocks startup.
 *
 * Order matters — dependencies must be reconciled before products:
 *   settings → tax_codes → distributors → item_types → departments → cashiers → products → transactions
 */
export async function runInitialSync(supabase: SupabaseClient, merchantId: string): Promise<void> {
  const device = getDeviceConfig()
  if (!device) {
    console.warn('[initial-sync] No device config found — skipping initial sync')
    return
  }

  updateStatus({
    state: 'running',
    currentEntity: null,
    entityProgress: { done: 0, total: null },
    completed: [],
    errors: []
  })

  const allErrors: Array<{ entity: string; message: string }> = []
  const completed: SyncEntity[] = []

  const run = async (
    entity: SyncEntity,
    fn: () => Promise<{ applied: number; uploaded: number; errors: string[] }>
  ): Promise<void> => {
    updateStatus({ currentEntity: entity, entityProgress: { done: 0, total: null } })
    try {
      const res = await fn()
      updateStatus({ entityProgress: { done: res.applied + res.uploaded, total: null } })
      if (res.errors.length > 0) {
        for (const e of res.errors) {
          console.error(`[initial-sync][${entity}] ${e}`)
          allErrors.push({ entity, message: e })
        }
      }
      console.log(
        `[initial-sync][${entity}] applied=${res.applied} uploaded=${res.uploaded} errors=${res.errors.length}`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[initial-sync][${entity}] Fatal: ${msg}`)
      allErrors.push({ entity, message: msg })
    }
    completed.push(entity)
    updateStatus({ completed: [...completed], errors: allErrors })
  }

  await run('settings', () => reconcileSettings(supabase, merchantId, device.device_id))
  await run('tax_codes', () => reconcileTaxCodes(supabase, merchantId, device.device_id))
  await run('distributors', () => reconcileDistributors(supabase, merchantId, device.device_id))
  await run('item_types', () => reconcileItemTypes(supabase, merchantId, device.device_id))
  await run('departments', () => reconcileDepartments(supabase, merchantId, device.device_id))
  await run('cashiers', () => reconcileCashiers(supabase, merchantId, device.device_id))

  // Products — uses dedicated result type to track applied/uploaded separately
  updateStatus({ currentEntity: 'products', entityProgress: { done: 0, total: null } })
  try {
    const result = await reconcileProducts(supabase, merchantId, device.device_id)
    updateStatus({
      entityProgress: { done: result.products_applied + result.products_uploaded, total: null }
    })
    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.error(`[initial-sync][products] ${e}`)
        allErrors.push({ entity: 'products', message: e })
      }
    }
    console.log(
      `[initial-sync][products] applied=${result.products_applied} uploaded=${result.products_uploaded} errors=${result.errors.length}`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[initial-sync][products] Fatal: ${msg}`)
    allErrors.push({ entity: 'products', message: msg })
  }
  completed.push('products')

  await run('transactions', () => backfillRecentTransactions(supabase, merchantId))

  updateStatus({
    state: allErrors.length > 0 ? 'failed' : 'done',
    currentEntity: null,
    completed,
    errors: allErrors
  })

  console.log(`[initial-sync] Complete. entities=${completed.length} errors=${allErrors.length}`)
}
