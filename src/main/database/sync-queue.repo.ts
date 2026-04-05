import { getDb } from './connection'
import type { SyncQueueItem, SyncQueueInsert, SyncQueueStats } from '../../shared/types'

const MAX_RETRIES = 5

/**
 * Add an item to the sync queue for background upload.
 */
export function enqueueSyncItem(item: SyncQueueInsert): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, device_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(item.entity_type, item.entity_id, item.operation, item.payload, item.device_id)
}

/**
 * Fetch the next batch of pending items to process.
 */
export function getPendingItems(limit = 50): SyncQueueItem[] {
  const db = getDb()
  return db
    .prepare(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC LIMIT ?`)
    .all(limit) as SyncQueueItem[]
}

/**
 * Mark items as currently being processed.
 */
export function markInFlight(ids: number[]): void {
  if (ids.length === 0) return
  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`UPDATE sync_queue SET status = 'in_flight' WHERE id IN (${placeholders})`).run(...ids)
}

/**
 * Mark items as successfully synced.
 */
export function markDone(ids: number[]): void {
  if (ids.length === 0) return
  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`DELETE FROM sync_queue WHERE id IN (${placeholders})`).run(...ids)
}

/**
 * Mark a single item as failed with an error message.
 */
export function markFailed(id: number, error: string): void {
  const db = getDb()
  db.prepare(
    `UPDATE sync_queue SET status = 'failed', last_error = ?, attempts = attempts + 1 WHERE id = ?`
  ).run(error, id)
}

/**
 * Reset failed items with fewer than MAX_RETRIES attempts back to pending.
 */
export function retryFailed(): number {
  const db = getDb()
  const result = db
    .prepare(
      `UPDATE sync_queue SET status = 'pending', last_error = NULL WHERE status = 'failed' AND attempts < ?`
    )
    .run(MAX_RETRIES)
  return result.changes
}

/**
 * Get queue statistics for the sync status indicator.
 */
export function getQueueStats(): SyncQueueStats {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'in_flight' THEN 1 ELSE 0 END), 0) AS in_flight,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
      FROM sync_queue`
    )
    .get() as SyncQueueStats
  return row
}

/**
 * Reset any in_flight items back to pending (recovery after crash).
 */
export function recoverInFlight(): number {
  const db = getDb()
  const result = db
    .prepare(`UPDATE sync_queue SET status = 'pending' WHERE status = 'in_flight'`)
    .run()
  return result.changes
}
