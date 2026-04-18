/**
 * Transaction sync — uploads local transactions to Supabase.
 *
 * Transactions are immutable after creation, so this is one-way (local -> cloud).
 * Other registers receive new transactions via Supabase Realtime.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TransactionSyncPayload, CloudTransactionPayload } from './types'

/**
 * Upload a single transaction (with its items) to the cloud.
 * Uses upsert by (merchant_id, transaction_number) for idempotency.
 */
export async function uploadTransaction(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: TransactionSyncPayload
): Promise<void> {
  const { transaction, items } = payload

  const cloudTxn: CloudTransactionPayload = {
    merchant_id: merchantId,
    local_id: transaction.id,
    transaction_number: transaction.transaction_number,
    subtotal: transaction.subtotal,
    tax_amount: transaction.tax_amount,
    total: transaction.total,
    payment_method: transaction.payment_method,
    finix_authorization_id: transaction.finix_authorization_id,
    finix_transfer_id: transaction.finix_transfer_id,
    card_last_four: transaction.card_last_four,
    card_type: transaction.card_type,
    status: transaction.status,
    notes: transaction.notes,
    original_transaction_number: transaction.original_transaction_number,
    session_id: transaction.session_id,
    device_id: deviceId,
    created_at: transaction.created_at
  }

  // Upsert the transaction
  const { data: txnData, error: txnError } = await supabase
    .from('merchant_transactions')
    .upsert(cloudTxn, { onConflict: 'merchant_id,transaction_number' })
    .select('id')
    .single()

  if (txnError || !txnData) {
    throw new Error(`Transaction upload failed: ${txnError?.message ?? 'unknown'}`)
  }

  const cloudTxnId = txnData.id as string

  // Insert line items (delete existing first for idempotency)
  if (items.length > 0) {
    await supabase.from('merchant_transaction_items').delete().eq('transaction_id', cloudTxnId)

    const cloudItems = items.map((item) => ({
      transaction_id: cloudTxnId,
      product_sku: item.product_sku,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_at_sale: item.cost_at_sale ?? null,
      cost_basis_source: item.cost_basis_source ?? 'fifo_layer',
      total_price: item.total_price
    }))

    const { error: itemsError } = await supabase
      .from('merchant_transaction_items')
      .insert(cloudItems)

    if (itemsError) {
      throw new Error(`Transaction items upload failed: ${itemsError.message}`)
    }
  }
}
