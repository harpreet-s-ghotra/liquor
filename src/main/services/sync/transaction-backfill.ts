import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import { scoped } from '../logger'

const BATCH_SIZE = 200
const DEFAULT_BACKFILL_DAYS = 365
export const MAX_SAFE_BACKFILL_DAYS = 365

const log = scoped('backfill')

export type BackfillState = 'idle' | 'running' | 'done' | 'failed'

export type BackfillStatus = {
  state: BackfillState
  days: number
  applied: number
  skipped: number
  errors: number
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
}

let status: BackfillStatus = {
  state: 'idle',
  days: 0,
  applied: 0,
  skipped: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
  lastError: null
}

type StatusListener = (s: BackfillStatus) => void
const listeners = new Set<StatusListener>()

export function getBackfillStatus(): BackfillStatus {
  return { ...status }
}

export function onBackfillStatusChange(cb: StatusListener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function updateStatus(patch: Partial<BackfillStatus>): void {
  status = { ...status, ...patch }
  for (const l of listeners) {
    try {
      l(status)
    } catch (err) {
      log.warn('status listener threw', err instanceof Error ? err.message : err)
    }
  }
}

function toIsoDateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

function getLocalProductIdBySku(sku: string): number | null {
  const row = getDb().prepare('SELECT id FROM products WHERE sku = ? LIMIT 1').get(sku) as
    | { id: number }
    | undefined
  return row?.id ?? null
}

/**
 * Pull merchant_transactions (+ items) from Supabase into local SQLite.
 * Idempotent: skips any transaction_number that already exists locally.
 * Paginated via (created_at, id) keyset.
 */
export async function backfillTransactions(
  supabase: SupabaseClient,
  merchantId: string,
  days: number = DEFAULT_BACKFILL_DAYS
): Promise<{ applied: number; uploaded: number; errors: string[] }> {
  const result = { applied: 0, uploaded: 0, errors: [] as string[] }

  if (status.state === 'running') {
    log.warn(`backfill already running — skipping new request for days=${days}`)
    result.errors.push('Backfill already running')
    return result
  }

  updateStatus({
    state: 'running',
    days,
    applied: 0,
    skipped: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null
  })

  const startAt = toIsoDateDaysAgo(days)
  log.info(`start days=${days} since=${startAt}`)

  let lastCreatedAt: string | null = null
  let lastId: string | null = null
  let hasMore = true
  let skipped = 0

  try {
    while (hasMore) {
      let query = supabase
        .from('merchant_transactions')
        .select('*')
        .eq('merchant_id', merchantId)
        .gte('created_at', startAt)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (lastCreatedAt && lastId) {
        query = query.or(
          `created_at.gt.${lastCreatedAt},and(created_at.eq.${lastCreatedAt},id.gt.${lastId})`
        )
      }

      const { data, error } = await query
      if (error) {
        result.errors.push(`Remote transaction fetch failed: ${error.message}`)
        break
      }
      if (!data || data.length === 0) {
        hasMore = false
        break
      }

      for (const row of data) {
        const txnNumber = String(row.transaction_number)
        const existing = getDb()
          .prepare('SELECT id FROM transactions WHERE transaction_number = ? LIMIT 1')
          .get(txnNumber) as { id: number } | undefined

        if (existing) {
          skipped++
          continue
        }

        const { data: items, error: itemErr } = await supabase
          .from('merchant_transaction_items')
          .select('*')
          .eq('transaction_id', String(row.id))

        if (itemErr) {
          result.errors.push(`Failed to fetch items for ${txnNumber}: ${itemErr.message}`)
          continue
        }

        try {
          const tx = getDb().transaction(() => {
            const insertTxn = getDb().prepare(
              `INSERT INTO transactions
                 (transaction_number, subtotal, tax_amount, total, payment_method,
                  finix_authorization_id, finix_transfer_id, card_last_four, card_type, status,
                  notes, session_id, device_id, backfilled, created_at, synced_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, CURRENT_TIMESTAMP)`
            )

            const txnRes = insertTxn.run(
              txnNumber,
              Number(row.subtotal ?? 0),
              Number(row.tax_amount ?? 0),
              Number(row.total ?? 0),
              (row.payment_method as string | null) ?? null,
              (row.finix_authorization_id as string | null) ?? null,
              (row.finix_transfer_id as string | null) ?? null,
              (row.card_last_four as string | null) ?? null,
              (row.card_type as string | null) ?? null,
              String(row.status ?? 'completed'),
              (row.notes as string | null) ?? null,
              (row.device_id as string | null) ?? null,
              String(row.created_at)
            )

            const localTxnId = Number(txnRes.lastInsertRowid)
            const insertItem = getDb().prepare(
              `INSERT INTO transaction_items
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

            for (const item of items ?? []) {
              const sku = String(item.product_sku)
              const productId = getLocalProductIdBySku(sku)
              if (!productId) {
                throw new Error(`Missing local product for SKU ${sku}`)
              }

              insertItem.run(
                localTxnId,
                productId,
                String(item.product_name),
                Number(item.quantity ?? 0),
                Number(item.unit_price ?? 0),
                (item.cost_at_sale as number | null | undefined) ?? null,
                (item.cost_basis_source as string | null | undefined) ??
                  ((item.cost_at_sale as number | null | undefined) == null
                    ? 'legacy_baseline'
                    : 'fifo_layer'),
                Number(item.total_price ?? 0)
              )
            }
          })

          tx()
          result.applied++
          updateStatus({ applied: result.applied, skipped })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result.errors.push(`Backfill failed for ${txnNumber}: ${msg}`)
          updateStatus({ errors: result.errors.length, lastError: msg })
        }
      }

      const last = data[data.length - 1]
      lastCreatedAt = last.created_at as string
      lastId = last.id as string
      hasMore = data.length === BATCH_SIZE
    }

    updateStatus({
      state: result.errors.length > 0 ? 'failed' : 'done',
      applied: result.applied,
      skipped,
      errors: result.errors.length,
      finishedAt: new Date().toISOString(),
      lastError: result.errors[result.errors.length - 1] ?? null
    })
    log.info(`end applied=${result.applied} skipped=${skipped} errors=${result.errors.length}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(msg)
    updateStatus({
      state: 'failed',
      applied: result.applied,
      skipped,
      errors: result.errors.length,
      finishedAt: new Date().toISOString(),
      lastError: msg
    })
    log.error(`fatal ${msg}`)
  }

  return result
}

// Backward-compatible wrapper — retained for existing call sites.
export const backfillRecentTransactions = backfillTransactions
