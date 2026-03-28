import { getDb } from './connection'
import { normalizeTimestamp, toSqliteFormat } from './utils'
import type {
  SaveRefundInput,
  SaveTransactionInput,
  SavedTransaction,
  TransactionDetail,
  TransactionHistoryItem,
  TransactionLineItem,
  TransactionListFilter,
  TransactionListResult,
  TransactionSummary
} from '../../shared/types'

/**
 * Save a completed transaction with line items and optional Stax payment data.
 * Returns the saved transaction with its generated ID and transaction number.
 */
export function saveTransaction(input: SaveTransactionInput): SavedTransaction {
  const db = getDb()

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
          transaction_number, subtotal, tax_amount, total,
          payment_method, stax_transaction_id, card_last_four, card_type,
          status, notes, session_id
        )
        VALUES (
          @transaction_number, @subtotal, @tax_amount, @total,
          @payment_method, @stax_transaction_id, @card_last_four, @card_type,
          'completed', @notes, @session_id
        )
        `
      )
      .run({
        transaction_number: txNumber,
        subtotal: input.subtotal,
        tax_amount: input.tax_amount,
        total: input.total,
        payment_method: input.payment_method,
        stax_transaction_id: input.stax_transaction_id ?? null,
        card_last_four: input.card_last_four ?? null,
        card_type: input.card_type ?? null,
        notes: input.notes ?? null,
        session_id: sessionId
      })

    const transactionId = Number(result.lastInsertRowid)

    const insertItem = db.prepare(
      `
      INSERT INTO transaction_items (
        transaction_id, product_id, product_name, quantity, unit_price, total_price
      )
      VALUES (?, ?, ?, ?, ?, ?)
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

    for (const item of input.items) {
      insertItem.run(
        transactionId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.total_price
      )

      // Decrement product stock for each sold item
      decrementStock.run(item.quantity, item.quantity, item.product_id)
    }

    return transactionId
  })

  const transactionId = tx()

  return {
    id: transactionId,
    transaction_number: txNumber,
    subtotal: input.subtotal,
    tax_amount: input.tax_amount,
    total: input.total,
    payment_method: input.payment_method,
    stax_transaction_id: input.stax_transaction_id ?? null,
    card_last_four: input.card_last_four ?? null,
    card_type: input.card_type ?? null,
    status: 'completed',
    original_transaction_id: null,
    created_at: new Date().toISOString()
  }
}

/**
 * Get recent transactions, most recent first.
 */
export function getRecentTransactions(limit = 50): SavedTransaction[] {
  return (
    getDb()
      .prepare(
        `
      SELECT
        id, transaction_number, subtotal, tax_amount, total,
        payment_method, stax_transaction_id, card_last_four, card_type,
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
        payment_method, stax_transaction_id, card_last_four, card_type,
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
      SELECT id, product_id, product_name, quantity, unit_price, total_price
      FROM transaction_items
      WHERE transaction_id = ?
      ORDER BY id
      `
    )
    .all(row.id) as TransactionLineItem[]

  return { ...normalizedRow, items }
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
        t.stax_transaction_id,
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
        t.payment_method, t.stax_transaction_id, t.card_last_four, t.card_type,
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
          transaction_number, subtotal, tax_amount, total,
          payment_method, stax_transaction_id, card_last_four, card_type,
          status, original_transaction_id, notes, session_id
        )
        VALUES (
          @transaction_number, @subtotal, @tax_amount, @total,
          @payment_method, @stax_transaction_id, @card_last_four, @card_type,
          'refund', @original_transaction_id, @notes, @session_id
        )
        `
      )
      .run({
        transaction_number: txNumber,
        subtotal: input.subtotal,
        tax_amount: input.tax_amount,
        total: input.total,
        payment_method: input.payment_method,
        stax_transaction_id: input.stax_transaction_id ?? null,
        card_last_four: input.card_last_four ?? null,
        card_type: input.card_type ?? null,
        original_transaction_id: input.original_transaction_id,
        notes: `Refund for ${input.original_transaction_number}`,
        session_id: sessionId
      })

    const transactionId = Number(result.lastInsertRowid)

    const insertItem = db.prepare(
      `
      INSERT INTO transaction_items (
        transaction_id, product_id, product_name, quantity, unit_price, total_price
      )
      VALUES (?, ?, ?, ?, ?, ?)
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

    for (const item of input.items) {
      insertItem.run(
        transactionId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.total_price
      )

      // Increment product stock for returned items
      incrementStock.run(item.quantity, item.quantity, item.product_id)
    }

    return transactionId
  })

  const transactionId = tx()

  return {
    id: transactionId,
    transaction_number: txNumber,
    subtotal: input.subtotal,
    tax_amount: input.tax_amount,
    total: input.total,
    payment_method: input.payment_method,
    stax_transaction_id: input.stax_transaction_id ?? null,
    card_last_four: input.card_last_four ?? null,
    card_type: input.card_type ?? null,
    status: 'refund',
    original_transaction_id: input.original_transaction_id,
    created_at: new Date().toISOString()
  }
}
