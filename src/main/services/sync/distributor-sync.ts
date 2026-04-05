import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudDistributorPayload, DistributorSyncPayload } from './types'

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export async function uploadDistributor(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: DistributorSyncPayload
): Promise<void> {
  const { distributor } = payload

  const cloudPayload: CloudDistributorPayload = {
    merchant_id: merchantId,
    distributor_number: distributor.distributor_number,
    distributor_name: distributor.distributor_name,
    license_id: distributor.license_id,
    serial_number: distributor.serial_number,
    premises_name: distributor.premises_name,
    premises_address: distributor.premises_address,
    is_active: distributor.is_active,
    device_id: deviceId,
    updated_at: distributor.updated_at
  }

  const { data, error } = await supabase
    .from('merchant_distributors')
    .upsert(cloudPayload, { onConflict: 'merchant_id,distributor_number' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Distributor upload failed: ${error?.message ?? 'unknown'}`)
  }

  getDb()
    .prepare(
      `UPDATE distributors
       SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?
       WHERE distributor_number = ?`
    )
    .run(data.id as string, deviceId, distributor.distributor_number)
}

export async function applyRemoteDistributorChange(
  _supabase: SupabaseClient,
  _merchantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<void> {
  const db = getDb()
  const local = db
    .prepare(
      'SELECT distributor_number, updated_at FROM distributors WHERE distributor_number = ? LIMIT 1'
    )
    .get(row.distributor_number) as { distributor_number: number; updated_at: string } | undefined

  if (local && toTimestamp(local.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  if (local) {
    db.prepare(
      `UPDATE distributors
       SET distributor_name = ?, license_id = ?, serial_number = ?,
           premises_name = ?, premises_address = ?, is_active = ?,
           cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?,
           updated_at = ?
       WHERE distributor_number = ?`
    ).run(
      String(row.distributor_name),
      (row.license_id as string | null) ?? null,
      (row.serial_number as string | null) ?? null,
      (row.premises_name as string | null) ?? null,
      (row.premises_address as string | null) ?? null,
      Number(row.is_active ?? 1),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at),
      Number(row.distributor_number)
    )
  } else {
    db.prepare(
      `INSERT INTO distributors
         (distributor_number, distributor_name, license_id, serial_number,
          premises_name, premises_address, is_active,
          cloud_id, synced_at, last_modified_by_device, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(
      Number(row.distributor_number),
      String(row.distributor_name),
      (row.license_id as string | null) ?? null,
      (row.serial_number as string | null) ?? null,
      (row.premises_name as string | null) ?? null,
      (row.premises_address as string | null) ?? null,
      Number(row.is_active ?? 1),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at)
    )
  }
}
