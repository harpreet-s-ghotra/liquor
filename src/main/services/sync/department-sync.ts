import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudDepartmentPayload, DepartmentSyncPayload } from './types'

const BATCH_SIZE = 500

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

function ensureDepartmentRowsFromProducts(): void {
  const db = getDb()
  const fromProducts = db
    .prepare(
      `SELECT DISTINCT TRIM(dept_id) AS name
       FROM products
       WHERE dept_id IS NOT NULL AND TRIM(dept_id) != ''`
    )
    .all() as Array<{ name: string }>

  const fromItemTypes = db
    .prepare(
      `SELECT DISTINCT TRIM(name) AS name
       FROM item_types
       WHERE name IS NOT NULL AND TRIM(name) != ''`
    )
    .all() as Array<{ name: string }>

  const names = [...fromProducts, ...fromItemTypes]

  const insert = db.prepare(
    `INSERT OR IGNORE INTO departments (name, tax_code_id, is_deleted, updated_at)
     VALUES (?, NULL, 0, CURRENT_TIMESTAMP)`
  )

  for (const row of names) {
    insert.run(row.name)
  }
}

function getLocalDepartmentSyncPayload(id: number): DepartmentSyncPayload {
  const row = getDb()
    .prepare(
      `SELECT
         id,
         cloud_id,
         name,
         tax_code_id,
         COALESCE(is_deleted, 0) AS is_deleted,
         COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
       FROM departments
       WHERE id = ?
       LIMIT 1`
    )
    .get(id) as DepartmentSyncPayload['department'] | undefined

  if (!row) throw new Error(`Department ${id} not found for sync`)
  return { department: row }
}

export async function uploadDepartment(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: DepartmentSyncPayload
): Promise<void> {
  const { department } = payload

  const cloudPayload: CloudDepartmentPayload = {
    merchant_id: merchantId,
    name: department.name,
    tax_code_id: department.tax_code_id,
    is_deleted: Boolean(department.is_deleted),
    device_id: deviceId,
    updated_at: department.updated_at
  }

  const { data, error } = await supabase
    .from('merchant_departments')
    .upsert(cloudPayload, { onConflict: 'merchant_id,name' })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Department upload failed: ${error?.message ?? 'unknown'}`)
  }

  getDb()
    .prepare(
      `UPDATE departments
       SET cloud_id = ?, synced_at = CURRENT_TIMESTAMP, last_modified_by_device = ?
       WHERE id = ?`
    )
    .run(data.id as string, deviceId, department.id)
}

export async function applyRemoteDepartmentChange(
  _supabase: SupabaseClient,
  _merchantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<void> {
  const db = getDb()
  const local = db
    .prepare('SELECT id, updated_at FROM departments WHERE name = ? LIMIT 1')
    .get(row.name) as { id: number; updated_at: string } | undefined

  if (local && toTimestamp(local.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  if (local) {
    db.prepare(
      `UPDATE departments
       SET tax_code_id = ?,
           is_deleted = ?,
           cloud_id = ?,
           synced_at = CURRENT_TIMESTAMP,
           last_modified_by_device = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      (row.tax_code_id as string | null) ?? null,
      Number(row.is_deleted ?? false),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at),
      local.id
    )
  } else {
    db.prepare(
      `INSERT INTO departments
         (name, tax_code_id, is_deleted, cloud_id, synced_at, last_modified_by_device, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(
      String(row.name),
      (row.tax_code_id as string | null) ?? null,
      Number(row.is_deleted ?? false),
      String(row.id),
      (row.device_id as string | null) ?? null,
      String(row.updated_at)
    )
  }
}

export async function reconcileDepartments(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string
): Promise<{ applied: number; uploaded: number; errors: string[] }> {
  const result = { applied: 0, uploaded: 0, errors: [] as string[] }

  ensureDepartmentRowsFromProducts()

  let lastUpdatedAt: string | null = null
  let lastId: string | null = null
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('merchant_departments')
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
      result.errors.push(`Remote department fetch failed: ${error.message}`)
      break
    }
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    for (const row of data) {
      try {
        await applyRemoteDepartmentChange(supabase, merchantId, row)
        result.applied++
      } catch (err) {
        result.errors.push(
          `Apply failed for department ${row.name}: ${err instanceof Error ? err.message : String(err)}`
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
      `SELECT id
       FROM departments
       WHERE COALESCE(is_deleted, 0) = 0
         AND (cloud_id IS NULL OR cloud_id = '')
       ORDER BY id`
    )
    .all() as { id: number }[]

  for (const { id } of localOnly) {
    try {
      const payload = getLocalDepartmentSyncPayload(id)
      await uploadDepartment(supabase, merchantId, deviceId, payload)
      result.uploaded++
    } catch (err) {
      result.errors.push(
        `Upload failed for department id=${id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
