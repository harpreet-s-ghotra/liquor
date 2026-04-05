/**
 * Cashier sync — main process only.
 *
 * pin_hash is included in cloud payloads so that a second register can
 * validate PINs created on a different machine.  It must NEVER be exposed via
 * IPC to the renderer.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudCashierPayload, CashierSyncPayload } from './types'

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export async function uploadCashier(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: CashierSyncPayload
): Promise<void> {
  const { cashier } = payload

  const cloudPayload: CloudCashierPayload = {
    merchant_id: merchantId,
    name: cashier.name,
    role: cashier.role,
    pin_hash: cashier.pin_hash,
    is_active: cashier.is_active,
    device_id: deviceId,
    updated_at: cashier.updated_at
  }

  const { data, error } = await supabase
    .from('merchant_cashiers')
    .upsert(cloudPayload, { onConflict: 'merchant_id,pin_hash' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Cashier upload failed: ${error?.message ?? 'unknown'}`)
  }

  getDb()
    .prepare(
      `UPDATE cashiers
       SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?
       WHERE id = ?`
    )
    .run(data.id as string, deviceId, cashier.id)
}

export async function applyRemoteCashierChange(
  _supabase: SupabaseClient,
  _merchantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<void> {
  const db = getDb()
  // Identify by pin_hash since it is the stable identity across registers
  const local = db
    .prepare('SELECT id, updated_at FROM cashiers WHERE pin_hash = ? LIMIT 1')
    .get(row.pin_hash) as { id: number; updated_at: string } | undefined

  if (local && toTimestamp(local.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  if (local) {
    db.prepare(
      `UPDATE cashiers
       SET name = ?, role = ?, pin_hash = ?, is_active = ?,
           cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      String(row.name),
      String(row.role ?? 'cashier'),
      String(row.pin_hash),
      Number(row.is_active ?? 1),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at),
      local.id
    )
  } else {
    db.prepare(
      `INSERT INTO cashiers
         (name, role, pin_hash, is_active,
          cloud_id, synced_at, last_modified_by_device, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(
      String(row.name),
      String(row.role ?? 'cashier'),
      String(row.pin_hash),
      Number(row.is_active ?? 1),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at)
    )
  }
}
