import { getDb } from './connection'
import { HOLD_DESCRIPTION_MAX_LENGTH } from '../../shared/constants'
import type { HeldTransaction, SaveHeldTransactionInput } from '../../shared/types'

function getHeldTransaction(id: number): HeldTransaction | null {
  return (
    (getDb()
      .prepare(
        `SELECT id, hold_number, cart_snapshot, transaction_discount_percent,
                subtotal, total, item_count, description, held_at
         FROM held_transactions WHERE id = ?`
      )
      .get(id) as HeldTransaction | undefined) ?? null
  )
}

/**
 * Save the current cart as a held transaction.
 * hold_number is sequential (MAX + 1) and never reused within a session.
 */
export function saveHeldTransaction(input: SaveHeldTransactionInput): HeldTransaction {
  const db = getDb()

  const row = db.prepare('SELECT MAX(hold_number) AS max_num FROM held_transactions').get() as {
    max_num: number | null
  }

  const holdNumber = (row.max_num ?? 0) + 1
  const itemCount = input.cart.reduce((sum, item) => sum + item.lineQuantity, 0)

  const trimmedDescription = (input.description ?? '').trim()
  if (trimmedDescription.length > HOLD_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Hold description must be ${HOLD_DESCRIPTION_MAX_LENGTH} characters or less`)
  }
  const description = trimmedDescription || null

  const result = db
    .prepare(
      `INSERT INTO held_transactions
         (hold_number, cart_snapshot, transaction_discount_percent, subtotal, total, item_count, description)
       VALUES
         (@hold_number, @cart_snapshot, @transaction_discount_percent, @subtotal, @total, @item_count, @description)`
    )
    .run({
      hold_number: holdNumber,
      cart_snapshot: JSON.stringify(input.cart),
      transaction_discount_percent: input.transactionDiscountPercent,
      subtotal: input.subtotal,
      total: input.total,
      item_count: itemCount,
      description
    })

  return getHeldTransaction(Number(result.lastInsertRowid))!
}

/** Return all held transactions ordered by hold_number ascending. */
export function getHeldTransactions(): HeldTransaction[] {
  return getDb()
    .prepare(
      `SELECT id, hold_number, cart_snapshot, transaction_discount_percent,
              subtotal, total, item_count, description, held_at
       FROM held_transactions
       ORDER BY hold_number ASC`
    )
    .all() as HeldTransaction[]
}

/** Delete a held transaction by id (called when it is recalled into the cart). */
export function deleteHeldTransaction(id: number): void {
  getDb().prepare('DELETE FROM held_transactions WHERE id = ?').run(id)
}

/** Delete all held transactions. */
export function clearAllHeldTransactions(): void {
  getDb().prepare('DELETE FROM held_transactions').run()
}
