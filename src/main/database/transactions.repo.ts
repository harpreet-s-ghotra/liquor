import { getDb } from './connection'
import type {
  SaveTransactionInput,
  SavedTransaction,
  TransactionDetail,
  TransactionHistoryItem,
  TransactionLineItem
} from '../../shared/types'

/**
 * Save a completed transaction with line items and optional Stax payment data.
 * Returns the saved transaction with its generated ID and transaction number.
 */
export function saveTransaction(input: SaveTransactionInput): SavedTransaction {
  const db = getDb()

  const txNumber = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `
        INSERT INTO transactions (
          transaction_number, subtotal, tax_amount, total,
          payment_method, stax_transaction_id, card_last_four, card_type,
          status, notes
        )
        VALUES (
          @transaction_number, @subtotal, @tax_amount, @total,
          @payment_method, @stax_transaction_id, @card_last_four, @card_type,
          'completed', @notes
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
        notes: input.notes ?? null
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
    created_at: new Date().toISOString()
  }
}

/**
 * Get recent transactions, most recent first.
 */
export function getRecentTransactions(limit = 50): SavedTransaction[] {
  return getDb()
    .prepare(
      `
      SELECT
        id, transaction_number, subtotal, tax_amount, total,
        payment_method, stax_transaction_id, card_last_four, card_type,
        status, created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT ?
      `
    )
    .all(limit) as SavedTransaction[]
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
        status, created_at
      FROM transactions
      WHERE transaction_number = ?
      `
    )
    .get(txnNumber) as SavedTransaction | undefined

  if (!row) return null

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

  return { ...row, items }
}

/**
 * Get detailed sales history for a specific product, including payment info.
 */
export function getProductSalesHistory(productId: number, limit = 20): TransactionHistoryItem[] {
  return getDb()
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
        t.card_type
      FROM transaction_items ti
      INNER JOIN transactions t ON t.id = ti.transaction_id
      WHERE ti.product_id = ?
      ORDER BY t.created_at DESC
      LIMIT ?
      `
    )
    .all(productId, limit) as TransactionHistoryItem[]
}
