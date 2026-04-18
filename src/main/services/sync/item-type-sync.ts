import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudItemTypePayload, ItemTypeSyncPayload } from './types'

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export async function uploadItemType(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: ItemTypeSyncPayload
): Promise<void> {
  const { item_type } = payload

  const cloudPayload: CloudItemTypePayload = {
    merchant_id: merchantId,
    name: item_type.name,
    description: item_type.description,
    default_profit_margin: item_type.default_profit_margin,
    default_tax_rate: item_type.default_tax_rate,
    device_id: deviceId,
    updated_at: item_type.updated_at
  }

  const { data, error } = await supabase
    .from('merchant_item_types')
    .upsert(cloudPayload, { onConflict: 'merchant_id,name' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Item type upload failed: ${error?.message ?? 'unknown'}`)
  }

  getDb()
    .prepare(
      `UPDATE item_types
       SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?
       WHERE id = ?`
    )
    .run(data.id as string, deviceId, item_type.id)
}

export async function applyRemoteItemTypeChange(
  _supabase: SupabaseClient,
  _merchantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<void> {
  const db = getDb()
  const local = db
    .prepare('SELECT id, name, updated_at FROM item_types WHERE name = ? LIMIT 1')
    .get(row.name) as { id: number; name: string; updated_at: string } | undefined

  if (local && toTimestamp(local.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  if (local) {
    // If the name changed on the remote, propagate to product.item_type strings
    if (local.name !== String(row.name)) {
      db.prepare('UPDATE products SET item_type = ? WHERE item_type = ?').run(
        String(row.name),
        local.name
      )
    }
    db.prepare(
      `UPDATE item_types
       SET name = ?, description = ?, default_profit_margin = ?, default_tax_rate = ?,
           cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      String(row.name),
      (row.description as string | null) ?? null,
      Number(row.default_profit_margin ?? 0),
      Number(row.default_tax_rate ?? 0),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at),
      local.id
    )
  } else {
    db.prepare(
      `INSERT INTO item_types
         (name, description, default_profit_margin, default_tax_rate,
          cloud_id, synced_at, last_modified_by_device, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(
      String(row.name),
      (row.description as string | null) ?? null,
      Number(row.default_profit_margin ?? 0),
      Number(row.default_tax_rate ?? 0),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at)
    )
  }
}

const BATCH_SIZE = 500

export async function reconcileItemTypes(
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
      .from('merchant_item_types')
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
      result.errors.push(`Remote item type fetch failed: ${error.message}`)
      break
    }
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    for (const row of data) {
      try {
        await applyRemoteItemTypeChange(supabase, merchantId, row)
        result.applied++
      } catch (err) {
        result.errors.push(
          `Apply failed for item type ${row.name}: ${err instanceof Error ? err.message : String(err)}`
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
      `SELECT id, name, description, default_profit_margin, default_tax_rate, updated_at
       FROM item_types
       WHERE (cloud_id IS NULL OR cloud_id = '')
       ORDER BY id`
    )
    .all() as {
    id: number
    name: string
    description: string | null
    default_profit_margin: number
    default_tax_rate: number
    updated_at: string
  }[]

  for (const it of localOnly) {
    try {
      await uploadItemType(supabase, merchantId, deviceId, {
        item_type: {
          id: it.id,
          name: it.name,
          description: it.description,
          default_profit_margin: it.default_profit_margin,
          default_tax_rate: it.default_tax_rate,
          updated_at: it.updated_at
        }
      })
      result.uploaded++
    } catch (err) {
      result.errors.push(
        `Upload failed for item type id=${it.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
