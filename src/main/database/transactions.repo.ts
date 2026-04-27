import { getDb } from './connection'
import { normalizeTimestamp, toSqliteFormat } from './utils'
import { enqueueSyncItem } from './sync-queue.repo'
import { getDeviceConfig } from './device-config.repo'
import { getInventoryDeltaSyncPayload, recordDelta } from './inventory-deltas.repo'
import { consumeCostLayersForSale, createCostLayer } from './product-cost-layers.repo'
import type {
  LocalTransactionHistoryStats,
  SaveRefundInput,
  SaveTransactionInput,
  SavedTransaction,
  TransactionDetail,
  TransactionHistoryItem,
  TransactionLineItem,
  TransactionListFilter,
  TransactionListResult,
  TransactionPayment,
  TransactionSummary
} from '../../shared/types'
import type { TransactionSyncPayload } from '../services/sync/types'

/**
 * Enqueue a transaction for cloud sync. Called after the local save succeeds.
 * Looks up product SKUs (the cloud uses SKUs, not local IDs) and builds the sync payload.
 */
function enqueueTransactionSync(
  saved: SavedTransaction,
  items: Array<
    SaveTransactionInput['items'][number] & {
      cost_at_sale?: number | null
      cost_basis_source?: string | null
    }
  >,
  originalTxnNumber: string | null,
  payments?: TransactionPayment[]
): void {
  const device = getDeviceConfig()
  if (!device) return // Not registered — skip sync

  const db = getDb()
  const findSku = db.prepare('SELECT sku FROM products WHERE id = ? LIMIT 1')

  const syncItems = items.map((item) => {
    const row = findSku.get(item.product_id) as { sku: string } | undefined
    return {
      product_sku: row?.sku ?? `UNKNOWN-${item.product_id}`,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_at_sale: item.cost_at_sale ?? null,
      cost_basis_source: item.cost_basis_source ?? 'fifo_layer',
      total_price: item.total_price
    }
  })

  const payload: TransactionSyncPayload = {
    transaction: {
      id: saved.id,
      transaction_number: saved.transaction_number,
      subtotal: saved.subtotal,
      tax_amount: saved.tax_amount,
      surcharge_amount: saved.surcharge_amount ?? 0,
      total: saved.total,
      payment_method: saved.payment_method,
      finix_authorization_id: saved.finix_authorization_id,
      finix_transfer_id: saved.finix_transfer_id,
      card_last_four: saved.card_last_four,
      card_type: saved.card_type,
      status: saved.status,
      notes: null,
      original_transaction_number: originalTxnNumber,
      session_id: saved.session_id ?? null,
      created_at: saved.created_at
    },
    items: syncItems,
    payments: payments && payments.length > 0 ? payments : undefined
  }

  enqueueSyncItem({
    entity_type: 'transaction',
    entity_id: String(saved.id),
    operation: 'INSERT',
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

/** Derive the canonical payment_method label from the payments array. */
function derivePaymentMethod(payments: TransactionPayment[] | undefined, fallback: string): string {
  if (!payments || payments.length === 0) return fallback
  const methods = new Set(payments.map((p) => p.method))
  return methods.size === 1 ? [...methods][0] : 'split'
}

/**
 * Save a completed transaction with line items and optional Finix payment data.
 * Returns the saved transaction with its generated ID and transaction number.
 */
export function saveTransaction(input: SaveTransactionInput): SavedTransaction {
  const db = getDb()
  const device = getDeviceConfig()
  const inventoryDeltaIds: number[] = []

  const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const tx = db.transaction(() => {
    // Attach to active session if one exists
    const activeSession = db
      .prepare("SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1")
      .get() as { id: number } | undefined
    const sessionId = input.session_id ?? activeSession?.id ?? null

    const result = db
      .prepare(
        `
        INSERT INTO transactions (
          transaction_number, subtotal, tax_amount, total, surcharge_amount,
          payment_method, finix_authorization_id, finix_transfer_id, card_last_four, card_type,
          status, notes, session_id, device_id
        )
        VALUES (
          @transaction_number, @subtotal, @tax_amount, @total, @surcharge_amount,
          @payment_method, @finix_authorization_id, @finix_transfer_id, @card_last_four, @card_type,
          'completed', @notes, @session_id, @device_id
        )
        `
      )
      .run({
        transaction_number: txNumber,
        subtotal: input.subtotal,
        tax_amount: input.tax_amount,
        total: input.total,
        surcharge_amount: input.surcharge_amount ?? 0,
        payment_method: derivePaymentMethod(input.payments, input.payment_method),
        finix_authorization_id: input.finix_authorization_id ?? null,
        finix_transfer_id: input.finix_transfer_id ?? null,
        card_last_four: input.card_last_four ?? null,
        card_type: input.card_type ?? null,
        notes: input.notes ?? null,
        session_id: sessionId,
        device_id: device?.device_id ?? null
      })

    const transactionId = Number(result.lastInsertRowid)

    if (input.payments && input.payments.length > 0) {
      const insertPayment = db.prepare(`
        INSERT INTO transaction_payments (transaction_id, method, amount, card_last_four, card_type, finix_authorization_id, finix_transfer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const p of input.payments) {
        insertPayment.run(
          transactionId,
          p.method,
          p.amount,
          p.card_last_four ?? null,
          p.card_type ?? null,
          p.finix_authorization_id ?? null,
          p.finix_transfer_id ?? null
        )
      }
    }

    const insertItem = db.prepare(
      `
      INSERT INTO transaction_items (
        transaction_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        cost_at_sale,
        cost_basis_source,
        total_price
      )
      VALUES (?, ?, ?, ?, ?, ?, 'fifo_layer', ?)
      `
    )

    const decrementStock = db.prepare(
      `
      UPDATE products
      SET
        in_stock  = MAX(0, COALESCE(in_stock, quantity, 0) - ?),
        quantity  = MAX(0, COALESCE(quantity, in_stock, 0) - ?)
      WHERE id = ?
      `
    )

    const getProductForCogs = db.prepare(
      `SELECT sku, COALESCE(cost, 0) AS cost FROM products WHERE id = ? LIMIT 1`
    )

    const itemsForSync: Array<
      SaveTransactionInput['items'][number] & {
        cost_at_sale: number
        cost_basis_source: 'fifo_layer'
      }
    > = []

    for (const item of input.items) {
      const productRow = getProductForCogs.get(item.product_id) as
        | { sku: string; cost: number }
        | undefined

      const consumed = consumeCostLayersForSale({
        productId: item.product_id,
        quantity: item.quantity,
        fallbackUnitCost: productRow?.cost ?? 0
      })

      insertItem.run(
        transactionId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        consumed.totalCost,
        item.total_price
      )

      // Decrement product stock for each sold item
      decrementStock.run(item.quantity, item.quantity, item.product_id)

      const skuRow = db
        .prepare('SELECT sku FROM products WHERE id = ? LIMIT 1')
        .get(item.product_id) as { sku: string } | undefined

      itemsForSync.push({
        ...item,
        cost_at_sale: consumed.totalCost,
        cost_basis_source: 'fifo_layer'
      })

      const deltaId = recordDelta({
        product_id: item.product_id,
        product_sku: skuRow?.sku ?? `UNKNOWN-${item.product_id}`,
        delta: -item.quantity,
        reason: 'sale',
        reference_id: txNumber,
        device_id: device?.device_id ?? null
      })
      inventoryDeltaIds.push(deltaId)
    }

    return { transactionId, sessionId, itemsForSync }
  })

  const { transactionId, sessionId, itemsForSync } = tx()

  const saved: SavedTransaction = {
    id: transactionId,
    transaction_number: txNumber,
    subtotal: input.subtotal,
    tax_amount: input.tax_amount,
    total: input.total,
    surcharge_amount: input.surcharge_amount ?? 0,
    payment_method: derivePaymentMethod(input.payments, input.payment_method),
    finix_authorization_id: input.finix_authorization_id ?? null,
    finix_transfer_id: input.finix_transfer_id ?? null,
    card_last_four: input.card_last_four ?? null,
    card_type: input.card_type ?? null,
    status: 'completed',
    original_transaction_id: null,
    session_id: sessionId,
    device_id: device?.device_id ?? null,
    created_at: new Date().toISOString()
  }

  // Enqueue for cloud sync (non-blocking — if device not registered, silently skips)
  try {
    enqueueTransactionSync(saved, itemsForSync, null, input.payments)
  } catch {
    // Sync enqueue failure must never block a sale
  }

  for (const deltaId of inventoryDeltaIds) {
    try {
      enqueueInventoryDeltaSync(deltaId)
    } catch {
      // Sync enqueue failure must never block a sale
    }
  }

  return saved
}

/**
 * Get recent transactions, most recent first.
 */
/**
 * Returns total count and earliest/latest created_at timestamps for locally-stored
 * transactions. Used by the History tab in the manager modal to show how far back
 * reports can reach without triggering a backfill.
 */
export function getLocalTransactionHistoryStats(): LocalTransactionHistoryStats {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count,
              MIN(created_at) AS earliest,
              MAX(created_at) AS latest
         FROM transactions`
    )
    .get() as { count: number; earliest: string | null; latest: string | null }

  return {
    count: row.count,
    earliest: row.earliest ? normalizeTimestamp(row.earliest) : null,
    latest: row.latest ? normalizeTimestamp(row.latest) : null
  }
}

export function getRecentTransactions(limit = 50): SavedTransaction[] {
  return (
    getDb()
      .prepare(
        `
      SELECT
        id, transaction_number, subtotal, tax_amount, total,
        COALESCE(surcharge_amount, 0) AS surcharge_amount,
        payment_method, finix_authorization_id, finix_transfer_id, card_last_four, card_type,
        status, original_transaction_id, created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT ?
      `
      )
      .all(limit) as SavedTransaction[]
  ).map((r) => ({ ...r, created_at: normalizeTimestamp(r.created_at) }))
}

/**
 * Get a full transaction with line items by transaction number.
 * Returns null if the transaction number does not exist.
 */
export function getTransactionByNumber(txnNumber: string): TransactionDetail | null {
  const db = getDb()

  const row = db
    .prepare(
      `
      SELECT
        id, transaction_number, subtotal, tax_amount, total,
        COALESCE(surcharge_amount, 0) AS surcharge_amount,
        payment_method, finix_authorization_id, finix_transfer_id, card_last_four, card_type,
        status, original_transaction_id, created_at
      FROM transactions
      WHERE transaction_number = ?
      `
    )
    .get(txnNumber) as SavedTransaction | undefined

  if (!row) return null

  const normalizedRow = { ...row, created_at: normalizeTimestamp(row.created_at) }

  const items = db
    .prepare(
      `
      SELECT
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        cost_at_sale,
        cost_basis_source,
        total_price
      FROM transaction_items
      WHERE transaction_id = ?
      ORDER BY id
      `
    )
    .all(row.id) as TransactionLineItem[]

  const refundRow = db
    .prepare(
      `SELECT 1 FROM transactions WHERE original_transaction_id = ? AND status = 'refund' LIMIT 1`
    )
    .get(row.id) as { '1': number } | undefined

  const payments = db
    .prepare(
      `SELECT id, method, amount, card_last_four, card_type, finix_authorization_id, finix_transfer_id
       FROM transaction_payments
       WHERE transaction_id = ?
       ORDER BY id`
    )
    .all(row.id) as TransactionPayment[]

  return { ...normalizedRow, items, payments, has_refund: !!refundRow }
}

/**
 * Get detailed sales history for a specific product, including payment info.
 */
export function getProductSalesHistory(productId: number, limit = 20): TransactionHistoryItem[] {
  return (
    getDb()
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
      LIMIT ?
      `
      )
      .all(productId, limit) as TransactionHistoryItem[]
  ).map((r) => ({ ...r, created_at: normalizeTimestamp(r.created_at) }))
}

/**
 * List transactions with optional filters and pagination.
 * Used by the Sales History modal.
 */
export function listTransactions(filter: TransactionListFilter = {}): TransactionListResult {
  const db = getDb()
  const { date_from, date_to, status, payment_method, search, limit = 50, offset = 0 } = filter

  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (date_from) {
    conditions.push('t.created_at >= @date_from')
    params.date_from = toSqliteFormat(date_from)
  }
  if (date_to) {
    conditions.push('t.created_at <= @date_to')
    params.date_to = toSqliteFormat(date_to)
  }
  if (status) {
    conditions.push('t.status = @status')
    params.status = status
  }
  if (payment_method) {
    conditions.push('t.payment_method = @payment_method')
    params.payment_method = payment_method
  }
  if (search) {
    conditions.push(
      `(t.transaction_number LIKE @search_pattern OR t.id IN (SELECT transaction_id FROM transaction_items WHERE product_name LIKE @search_pattern))`
    )
    params.search_pattern = `%${search}%`
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = db
    .prepare(`SELECT COUNT(DISTINCT t.id) AS cnt FROM transactions t ${whereClause}`)
    .get(params) as { cnt: number }

  const rows = (
    db
      .prepare(
        `
      SELECT
        t.id, t.transaction_number, t.subtotal, t.tax_amount, t.total,
        t.payment_method, t.finix_authorization_id, t.card_last_four, t.card_type,
        t.status, t.original_transaction_id, t.notes, t.created_at,
        COUNT(ti.id) AS item_count
      FROM transactions t
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT @limit OFFSET @offset
      `
      )
      .all({ ...params, limit, offset }) as TransactionSummary[]
  ).map((r) => ({ ...r, created_at: normalizeTimestamp(r.created_at) }))

  return { transactions: rows, total_count: countRow.cnt }
}

/**
 * Save a refund transaction. Stores negative totals and increments product stock.
 */
export function saveRefundTransaction(input: SaveRefundInput): SavedTransaction {
  const db = getDb()
  const device = getDeviceConfig()
  const inventoryDeltaIds: number[] = []

  const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const tx = db.transaction(() => {
    // Attach to active session if one exists
    const activeSession = db
      .prepare("SELECT id FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1")
      .get() as { id: number } | undefined
    const sessionId = input.session_id ?? activeSession?.id ?? null

    const result = db
      .prepare(
        `
        INSERT INTO transactions (
          transaction_number, subtotal, tax_amount, total, surcharge_amount,
          payment_method, finix_authorization_id, finix_transfer_id, card_last_four, card_type,
          status, original_transaction_id, notes, session_id, device_id
        )
        VALUES (
          @transaction_number, @subtotal, @tax_amount, @total, @surcharge_amount,
          @payment_method, @finix_authorization_id, @finix_transfer_id, @card_last_four, @card_type,
          'refund', @original_transaction_id, @notes, @session_id, @device_id
        )
        `
      )
      .run({
        transaction_number: txNumber,
        subtotal: input.subtotal,
        tax_amount: input.tax_amount,
        total: input.total,
        surcharge_amount: input.surcharge_amount ?? 0,
        payment_method: input.payment_method,
        finix_authorization_id: input.finix_authorization_id ?? null,
        finix_transfer_id: input.finix_transfer_id ?? null,
        card_last_four: input.card_last_four ?? null,
        card_type: input.card_type ?? null,
        original_transaction_id: input.original_transaction_id,
        notes: `Refund for ${input.original_transaction_number}`,
        session_id: sessionId,
        device_id: device?.device_id ?? null
      })

    const transactionId = Number(result.lastInsertRowid)

    const insertItem = db.prepare(
      `
      INSERT INTO transaction_items (
        transaction_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        cost_at_sale,
        cost_basis_source,
        total_price
      )
      VALUES (?, ?, ?, ?, ?, ?, 'fifo_layer', ?)
      `
    )

    const incrementStock = db.prepare(
      `
      UPDATE products
      SET
        in_stock  = COALESCE(in_stock, quantity, 0) + ?,
        quantity  = COALESCE(quantity, in_stock, 0) + ?
      WHERE id = ?
      `
    )

    const getProductForCost = db.prepare(
      `SELECT sku, COALESCE(cost, 0) AS cost FROM products WHERE id = ? LIMIT 1`
    )
    const getOriginalAvgUnitCost = db.prepare(
      `SELECT
         COALESCE(SUM(COALESCE(cost_at_sale, 0)), 0) AS total_cost,
         COALESCE(SUM(quantity), 0) AS total_qty
       FROM transaction_items
       WHERE transaction_id = ? AND product_id = ?`
    )

    const itemsForSync: Array<
      SaveRefundInput['items'][number] & {
        cost_at_sale: number
        cost_basis_source: 'fifo_layer'
      }
    > = []

    for (const item of input.items) {
      const productRow = getProductForCost.get(item.product_id) as
        | { sku: string; cost: number }
        | undefined

      const originalCost = getOriginalAvgUnitCost.get(
        input.original_transaction_id,
        item.product_id
      ) as { total_cost: number; total_qty: number }

      const avgUnitCostFromOriginal =
        originalCost.total_qty > 0 ? originalCost.total_cost / originalCost.total_qty : 0
      const unitCost = Math.max(0, avgUnitCostFromOriginal || productRow?.cost || 0)
      const lineCostAtSale = -(unitCost * item.quantity)

      insertItem.run(
        transactionId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        lineCostAtSale,
        item.total_price
      )

      // Increment product stock for returned items
      incrementStock.run(item.quantity, item.quantity, item.product_id)

      createCostLayer({
        productId: item.product_id,
        quantity: item.quantity,
        costPerUnit: unitCost,
        source: 'refund',
        sourceReference: txNumber,
        deviceId: device?.device_id ?? null
      })

      const skuRow = db
        .prepare('SELECT sku FROM products WHERE id = ? LIMIT 1')
        .get(item.product_id) as { sku: string } | undefined

      itemsForSync.push({
        ...item,
        cost_at_sale: lineCostAtSale,
        cost_basis_source: 'fifo_layer'
      })

      const deltaId = recordDelta({
        product_id: item.product_id,
        product_sku: skuRow?.sku ?? `UNKNOWN-${item.product_id}`,
        delta: item.quantity,
        reason: 'refund',
        reference_id: txNumber,
        device_id: device?.device_id ?? null
      })
      inventoryDeltaIds.push(deltaId)
    }

    return { transactionId, sessionId, itemsForSync }
  })

  const { transactionId, sessionId, itemsForSync } = tx()

  const saved: SavedTransaction = {
    id: transactionId,
    transaction_number: txNumber,
    subtotal: input.subtotal,
    tax_amount: input.tax_amount,
    total: input.total,
    surcharge_amount: input.surcharge_amount ?? 0,
    payment_method: input.payment_method,
    finix_authorization_id: input.finix_authorization_id ?? null,
    finix_transfer_id: input.finix_transfer_id ?? null,
    card_last_four: input.card_last_four ?? null,
    card_type: input.card_type ?? null,
    status: 'refund',
    original_transaction_id: input.original_transaction_id,
    session_id: sessionId,
    device_id: device?.device_id ?? null,
    created_at: new Date().toISOString()
  }

  try {
    enqueueTransactionSync(saved, itemsForSync, input.original_transaction_number)
  } catch {
    // Sync enqueue failure must never block a refund
  }

  for (const deltaId of inventoryDeltaIds) {
    try {
      enqueueInventoryDeltaSync(deltaId)
    } catch {
      // Sync enqueue failure must never block a refund
    }
  }

  return saved
}

/**
 * Backfill device_id on all existing transaction rows that were written before
 * device registration was completed. Called once at startup after registerDevice.
 */
export function backfillTransactionDeviceId(deviceId: string): void {
  getDb().prepare('UPDATE transactions SET device_id = ? WHERE device_id IS NULL').run(deviceId)
}
