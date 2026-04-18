import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import type { DepartmentSyncPayload } from '../services/sync/types'

function getDepartmentSyncPayload(id: number): DepartmentSyncPayload {
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

function enqueueDepartmentSync(id: number, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
  const device = getDeviceConfig()
  if (!device) return
  try {
    const payload = getDepartmentSyncPayload(id)
    enqueueSyncItem({
      entity_type: 'department',
      entity_id: String(id),
      operation,
      payload: JSON.stringify(payload),
      device_id: device.device_id
    })
  } catch {
    // Local save already succeeded — sync enqueue failure is non-blocking
  }
}

export function ensureDepartmentFromItemType(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return

  const db = getDb()
  const existing = db
    .prepare('SELECT id, is_deleted FROM departments WHERE name = ? LIMIT 1')
    .get(trimmed) as { id: number; is_deleted: number } | undefined

  if (existing) {
    if (existing.is_deleted === 1) {
      db.prepare(
        `UPDATE departments
         SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(existing.id)
      enqueueDepartmentSync(existing.id, 'UPDATE')
    }
    return
  }

  const result = db
    .prepare(
      `INSERT INTO departments (name, tax_code_id, is_deleted, updated_at)
       VALUES (?, NULL, 0, CURRENT_TIMESTAMP)`
    )
    .run(trimmed)

  const id = Number(result.lastInsertRowid)
  enqueueDepartmentSync(id, 'INSERT')
}

export function renameDepartmentFromItemType(oldName: string, newName: string): void {
  const oldTrimmed = oldName.trim()
  const newTrimmed = newName.trim()
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return

  const db = getDb()
  const current = db
    .prepare('SELECT id FROM departments WHERE name = ? LIMIT 1')
    .get(oldTrimmed) as { id: number } | undefined

  if (current) {
    db.prepare(
      `UPDATE departments
       SET name = ?, is_deleted = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(newTrimmed, current.id)
    enqueueDepartmentSync(current.id, 'UPDATE')
    return
  }

  ensureDepartmentFromItemType(newTrimmed)
}

export function softDeleteDepartmentFromItemType(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return

  const db = getDb()
  const existing = db
    .prepare('SELECT id, is_deleted FROM departments WHERE name = ? LIMIT 1')
    .get(trimmed) as { id: number; is_deleted: number } | undefined

  if (!existing) return
  if (existing.is_deleted === 1) return

  db.prepare(
    `UPDATE departments
     SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(existing.id)

  enqueueDepartmentSync(existing.id, 'DELETE')
}
