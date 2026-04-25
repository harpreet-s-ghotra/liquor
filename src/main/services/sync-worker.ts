/**
 * Background sync worker.
 *
 * Drains the local sync_queue when online, uploading changes to Supabase.
 * Subscribes to Supabase Realtime to receive changes from other registers.
 */

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { scoped } from './logger'
import {
  getPendingItems,
  getQueueStats,
  markInFlight,
  markDone,
  markFailed,
  retryFailed,
  recoverInFlight
} from '../database/sync-queue.repo'
import { markDeltaSynced } from '../database/inventory-deltas.repo'
import { isOnline, onConnectivityChange } from './connectivity'
import { uploadInventoryDelta } from './sync/inventory-delta-sync'
import { applyRemoteProductChange, uploadProduct } from './sync/product-sync'
import { uploadTransaction } from './sync/transaction-sync'
import { uploadTaxCode, deleteTaxCode, applyRemoteTaxCodeChange } from './sync/tax-code-sync'
import { uploadDistributor, applyRemoteDistributorChange } from './sync/distributor-sync'
import { uploadItemType, applyRemoteItemTypeChange } from './sync/item-type-sync'
import { uploadCashier, applyRemoteCashierChange } from './sync/cashier-sync'
import { uploadDepartment, applyRemoteDepartmentChange } from './sync/department-sync'
import { uploadSettings, applyRemoteSettingsChange } from './sync/settings-sync'
import type {
  InventoryDeltaSyncPayload,
  ProductSyncPayload,
  TransactionSyncPayload,
  TaxCodeSyncPayload,
  DistributorSyncPayload,
  ItemTypeSyncPayload,
  CashierSyncPayload,
  DepartmentSyncPayload,
  MerchantSettingsSyncPayload
} from './sync/types'

// ── Configuration ──

const DRAIN_INTERVAL_MS = 1_000
const RETRY_INTERVAL_MS = 60_000
const BACKOFF_BASE_MS = 1_000
const MAX_BATCH_SIZE = 100

// ── State ──

const log = scoped('sync-worker')

let merchantId: string | null = null
let deviceId: string | null = null
let supabase: SupabaseClient | null = null
let drainTimer: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setInterval> | null = null
let realtimeChannel: RealtimeChannel | null = null
let unsubConnectivity: (() => void) | null = null
let running = false
let draining = false
let lastSyncedAt: string | null = null

// ── Public API ──

/**
 * Start the sync worker. Should be called after auth is confirmed and device is registered.
 */
export function startSyncWorker(client: SupabaseClient, mId: string, dId: string): void {
  if (running) return

  supabase = client
  merchantId = mId
  deviceId = dId
  running = true

  // Recover any items left in_flight from a previous crash
  recoverInFlight()

  // Start drain loop
  drainTimer = setInterval(drainIfOnline, DRAIN_INTERVAL_MS)

  // Retry failed items periodically
  retryTimer = setInterval(() => {
    retryFailed()
  }, RETRY_INTERVAL_MS)

  // When connectivity returns, drain immediately
  unsubConnectivity = onConnectivityChange((online) => {
    if (online) drainIfOnline()
  })

  // Subscribe to Realtime
  subscribeToRealtime()

  // Drain immediately on start
  drainIfOnline()
}

/**
 * Stop the sync worker and clean up.
 */
export function stopSyncWorker(): void {
  running = false

  if (drainTimer) {
    clearInterval(drainTimer)
    drainTimer = null
  }
  if (retryTimer) {
    clearInterval(retryTimer)
    retryTimer = null
  }
  if (unsubConnectivity) {
    unsubConnectivity()
    unsubConnectivity = null
  }
  if (realtimeChannel && supabase) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  supabase = null
  merchantId = null
  deviceId = null
}

export function getLastSyncedAt(): string | null {
  return lastSyncedAt
}

export async function drainSyncQueue(
  timeoutMs: number
): Promise<{ drained: number; remaining: number }> {
  const initialTotal = getQueueDepth()
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (getActiveQueueCount() === 0) {
      break
    }

    if (running && isOnline() && !draining) {
      await drainQueue()
      continue
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const remaining = getQueueDepth()
  return {
    drained: Math.max(0, initialTotal - remaining),
    remaining
  }
}

// ── Queue Drain ──

function drainIfOnline(): void {
  if (!isOnline() || draining || !running) return
  drainQueue().catch((err) => {
    log.error('drain error', err instanceof Error ? err.message : err)
  })
}

async function drainQueue(): Promise<void> {
  if (!supabase || !merchantId || !deviceId) return
  draining = true

  const startedAt = Date.now()
  let processed = 0
  let failed = 0

  try {
    const items = getPendingItems(MAX_BATCH_SIZE)
    if (items.length === 0) return

    log.info(`drain start pending_in_batch=${items.length}`)

    const ids = items.map((i) => i.id)
    markInFlight(ids)

    for (const item of items) {
      try {
        await processItem(item.id, item.entity_type, item.payload, item.operation)
        markDone([item.id])
        processed++
        lastSyncedAt = new Date().toISOString()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        markFailed(item.id, message)
        failed++
        log.warn(
          `item failed entity_type=${item.entity_type} entity_id=${item.entity_id} attempts=${item.attempts + 1} error=${message}`
        )

        // Exponential backoff: if item has been retried, slow down
        if (item.attempts > 0) {
          const delay = Math.min(BACKOFF_BASE_MS * Math.pow(4, item.attempts), 256_000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }
  } finally {
    draining = false
    if (processed > 0 || failed > 0) {
      log.info(
        `drain end processed=${processed} failed=${failed} duration_ms=${Date.now() - startedAt}`
      )
    }
  }
}

function getActiveQueueCount(): number {
  const stats = getQueueStats()
  return stats.pending + stats.in_flight
}

function getQueueDepth(): number {
  const stats = getQueueStats()
  return stats.pending + stats.in_flight + stats.failed
}

async function processItem(
  _id: number,
  entityType: string,
  payloadJson: string,
  operation: string
): Promise<void> {
  if (!supabase || !merchantId || !deviceId) return

  switch (entityType) {
    case 'transaction': {
      const payload = JSON.parse(payloadJson) as TransactionSyncPayload
      await uploadTransaction(supabase, merchantId, deviceId, payload)
      break
    }
    case 'product': {
      const payload = JSON.parse(payloadJson) as ProductSyncPayload
      await uploadProduct(supabase, merchantId, deviceId, payload)
      break
    }
    case 'inventory_delta': {
      const payload = JSON.parse(payloadJson) as InventoryDeltaSyncPayload
      await uploadInventoryDelta(supabase, merchantId, deviceId, payload)
      markDeltaSynced(payload.delta.id)
      break
    }
    case 'item_type': {
      const payload = JSON.parse(payloadJson) as ItemTypeSyncPayload
      await uploadItemType(supabase, merchantId, deviceId, payload)
      break
    }
    case 'department': {
      const payload = JSON.parse(payloadJson) as DepartmentSyncPayload
      await uploadDepartment(supabase, merchantId, deviceId, payload)
      break
    }
    case 'settings': {
      const payload = JSON.parse(payloadJson) as MerchantSettingsSyncPayload
      await uploadSettings(supabase, merchantId, deviceId, payload)
      break
    }
    case 'tax_code': {
      const payload = JSON.parse(payloadJson) as TaxCodeSyncPayload
      if (operation === 'DELETE') {
        await deleteTaxCode(supabase, merchantId, payload)
      } else {
        await uploadTaxCode(supabase, merchantId, deviceId, payload)
      }
      break
    }
    case 'distributor': {
      const payload = JSON.parse(payloadJson) as DistributorSyncPayload
      await uploadDistributor(supabase, merchantId, deviceId, payload)
      break
    }
    case 'cashier': {
      const payload = JSON.parse(payloadJson) as CashierSyncPayload
      await uploadCashier(supabase, merchantId, deviceId, payload)
      break
    }
    default:
      log.warn(`unknown entity type: ${entityType}`)
  }
}

// ── Realtime Subscriptions ──

function subscribeToRealtime(): void {
  if (!supabase || !merchantId) return

  realtimeChannel = supabase
    .channel('merchant-sync')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'merchant_transactions',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        handleRemoteTransaction(payload.new).catch((err) => {
          log.error('remote transaction error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_products',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        handleRemoteProduct(payload.new).catch((err) => {
          log.error('remote product error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_departments',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        applyRemoteDepartmentChange(supabase!, merchantId!, payload.new).catch((err) => {
          log.error('remote department error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_business_settings',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        applyRemoteSettingsChange(supabase!, merchantId!, payload.new).catch((err) => {
          log.error('remote settings error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_item_types',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        applyRemoteItemTypeChange(supabase!, merchantId!, payload.new).catch((err) => {
          log.error('remote item type error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_tax_codes',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        applyRemoteTaxCodeChange(supabase!, merchantId!, payload.new).catch((err) => {
          log.error('remote tax code error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_distributors',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        applyRemoteDistributorChange(supabase!, merchantId!, payload.new).catch((err) => {
          log.error('remote distributor error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'merchant_cashiers',
        filter: `merchant_id=eq.${merchantId}`
      },
      (payload) => {
        if (!payload.new) return
        applyRemoteCashierChange(supabase!, merchantId!, payload.new).catch((err) => {
          log.error('remote cashier error:', err instanceof Error ? err.message : err)
        })
      }
    )
    .subscribe()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRemoteTransaction(row: any): Promise<void> {
  // Skip our own echoed events
  if (row.device_id === deviceId) return

  // Dedup: check if transaction_number already exists locally
  const { getTransactionByNumber } = await import('../database/transactions.repo')
  const existing = getTransactionByNumber(row.transaction_number)
  if (existing) return

  // Insert into local SQLite (read-only copy from another register)
  const { getDb } = await import('../database/connection')
  const db = getDb()

  db.prepare(
    `INSERT OR IGNORE INTO transactions
      (transaction_number, subtotal, tax_amount, total, payment_method,
       finix_authorization_id, finix_transfer_id, card_last_four, card_type, status, notes,
       device_id, synced_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`
  ).run(
    row.transaction_number,
    row.subtotal,
    row.tax_amount,
    row.total,
    row.payment_method,
    row.finix_authorization_id,
    row.finix_transfer_id,
    row.card_last_four,
    row.card_type,
    row.status,
    row.notes,
    row.device_id,
    row.created_at
  )

  // Fetch and insert line items from cloud
  if (supabase && row.id) {
    const { data: items } = await supabase
      .from('merchant_transaction_items')
      .select('*')
      .eq('transaction_id', row.id)

    if (items && items.length > 0) {
      // Get the local transaction id
      const localTxn = getTransactionByNumber(row.transaction_number)
      if (localTxn) {
        const insertItem = db.prepare(
          `INSERT OR IGNORE INTO transaction_items
            (
              transaction_id,
              product_id,
              product_name,
              quantity,
              unit_price,
              cost_at_sale,
              cost_basis_source,
              total_price
            )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )

        // Look up product_id by SKU, fallback to 0 if not found locally
        const findProduct = db.prepare(
          `SELECT id FROM products WHERE sku = ? AND is_active = 1 LIMIT 1`
        )

        for (const item of items) {
          const product = findProduct.get(item.product_sku) as { id: number } | undefined
          if (!product) continue

          insertItem.run(
            localTxn.id,
            product.id,
            item.product_name,
            item.quantity,
            item.unit_price,
            (item.cost_at_sale as number | null | undefined) ?? null,
            (item.cost_basis_source as string | null | undefined) ?? 'fifo_layer',
            item.total_price
          )
        }
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleRemoteProduct(row: any): Promise<void> {
  if (row.device_id === deviceId) return
  if (!supabase || !merchantId) return

  await applyRemoteProductChange(supabase, merchantId, row)
}
