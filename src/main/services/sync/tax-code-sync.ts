import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudTaxCodePayload, TaxCodeSyncPayload } from './types'

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export async function uploadTaxCode(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: TaxCodeSyncPayload
): Promise<void> {
  const { tax_code } = payload

  const cloudPayload: CloudTaxCodePayload = {
    merchant_id: merchantId,
    code: tax_code.code,
    rate: tax_code.rate,
    device_id: deviceId,
    updated_at: tax_code.updated_at
  }

  const { data, error } = await supabase
    .from('merchant_tax_codes')
    .upsert(cloudPayload, { onConflict: 'merchant_id,code' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Tax code upload failed: ${error?.message ?? 'unknown'}`)
  }

  getDb()
    .prepare(
      `UPDATE tax_codes
       SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?
       WHERE id = ?`
    )
    .run(data.id as string, deviceId, tax_code.id)
}

export async function applyRemoteTaxCodeChange(
  _supabase: SupabaseClient,
  _merchantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<void> {
  const db = getDb()
  const local = db
    .prepare('SELECT id, updated_at FROM tax_codes WHERE code = ? LIMIT 1')
    .get(row.code) as { id: number; updated_at: string } | undefined

  if (local && toTimestamp(local.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  if (local) {
    db.prepare(
      `UPDATE tax_codes
       SET rate = ?, cloud_id = ?, synced_at = CURRENT_TIMESTAMP,
           last_modified_by_device = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      Number(row.rate),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at),
      local.id
    )
  } else {
    db.prepare(
      `INSERT INTO tax_codes (code, rate, cloud_id, synced_at, last_modified_by_device, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(
      String(row.code),
      Number(row.rate),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at)
    )
  }
}

const BATCH_SIZE = 500

export async function reconcileTaxCodes(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string
): Promise<{ applied: number; uploaded: number; errors: string[] }> {
  const result = { applied: 0, uploaded: 0, errors: [] as string[] }

  let lastUpdatedAt: string | null = null
  let lastId: string | null = null
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('merchant_tax_codes')
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
      result.errors.push(`Remote tax code fetch failed: ${error.message}`)
      break
    }
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    for (const row of data) {
      try {
        await applyRemoteTaxCodeChange(supabase, merchantId, row)
        result.applied++
      } catch (err) {
        result.errors.push(
          `Apply failed for tax code ${row.code}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    const last = data[data.length - 1]
    lastUpdatedAt = last.updated_at as string
    lastId = last.id as string
    hasMore = data.length === BATCH_SIZE
  }

  const localOnly = getDb()
    .prepare(
      `SELECT id, code, rate, updated_at
       FROM tax_codes
       WHERE (cloud_id IS NULL OR cloud_id = '')
       ORDER BY id`
    )
    .all() as { id: number; code: string; rate: number; updated_at: string }[]

  for (const tc of localOnly) {
    try {
      await uploadTaxCode(supabase, merchantId, deviceId, {
        tax_code: { id: tc.id, code: tc.code, rate: tc.rate, updated_at: tc.updated_at }
      })
      result.uploaded++
    } catch (err) {
      result.errors.push(
        `Upload failed for tax code id=${tc.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
