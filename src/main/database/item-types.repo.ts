import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import { DEPARTMENT_NAME_MAX_LENGTH } from '../../shared/constants'
import type { ItemType, CreateItemTypeInput, UpdateItemTypeInput } from '../../shared/types'
import type { ItemTypeSyncPayload } from '../services/sync/types'

export function getItemTypes(): ItemType[] {
  return getDb()
    .prepare(
      'SELECT id, name, description, COALESCE(default_profit_margin, 0) AS default_profit_margin, COALESCE(default_tax_rate, 0) AS default_tax_rate FROM item_types ORDER BY name'
    )
    .all() as ItemType[]
}

export function createItemType(input: CreateItemTypeInput): ItemType {
  const db = getDb()
  const name = input.name.trim()

  if (!name) {
    throw new Error('Item type name is required')
  }

  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Item type name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db.prepare('SELECT id FROM item_types WHERE name = ?').get(name) as
    | { id: number }
    | undefined

  if (existing) {
    throw new Error('Item type already exists')
  }

  const result = db
    .prepare(
      'INSERT INTO item_types (name, description, default_profit_margin, default_tax_rate) VALUES (?, ?, ?, ?)'
    )
    .run(
      name,
      input.description ?? null,
      input.default_profit_margin ?? 0,
      input.default_tax_rate ?? 0
    )
  const newId = Number(result.lastInsertRowid)
  enqueueItemTypeSync(newId, 'INSERT')
  return {
    id: newId,
    name,
    description: input.description ?? null,
    default_profit_margin: input.default_profit_margin ?? 0,
    default_tax_rate: input.default_tax_rate ?? 0
  }
}

export function updateItemType(input: UpdateItemTypeInput): ItemType {
  const db = getDb()
  const name = input.name.trim()

  if (!name) {
    throw new Error('Item type name is required')
  }

  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Item type name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or less`)
  }

  const duplicate = db
    .prepare('SELECT id FROM item_types WHERE name = ? AND id != ?')
    .get(name, input.id) as { id: number } | undefined

  if (duplicate) {
    throw new Error('Item type already exists')
  }

  const current = db.prepare('SELECT name FROM item_types WHERE id = ?').get(input.id) as
    | { name: string }
    | undefined

  if (!current) {
    throw new Error('Item type not found')
  }

  db.prepare(
    'UPDATE item_types SET name = ?, description = ?, default_profit_margin = ?, default_tax_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(
    name,
    input.description ?? null,
    input.default_profit_margin ?? 0,
    input.default_tax_rate ?? 0,
    input.id
  )

  // Keep product item_type references in sync with the renamed backing row.
  db.prepare('UPDATE products SET item_type = ? WHERE item_type = ?').run(name, current.name)

  enqueueItemTypeSync(input.id, 'UPDATE')
  return {
    id: input.id,
    name,
    description: input.description ?? null,
    default_profit_margin: input.default_profit_margin ?? 0,
    default_tax_rate: input.default_tax_rate ?? 0
  }
}

export function deleteItemType(id: number): void {
  const db = getDb()

  const itemType = db.prepare('SELECT name FROM item_types WHERE id = ?').get(id) as
    | { name: string }
    | undefined

  if (!itemType) {
    throw new Error('Item type not found')
  }

  const productCount = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE item_type = ?')
    .get(itemType.name) as { count: number }

  if (productCount.count > 0) {
    throw new Error('Cannot delete item type that is assigned to products')
  }

  enqueueItemTypeSync(id, 'DELETE')
  db.prepare('DELETE FROM item_types WHERE id = ?').run(id)
}

// ── Sync helpers ──

function getItemTypeSyncPayload(id: number): ItemTypeSyncPayload {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, cloud_id, name, description,
              COALESCE(default_profit_margin, 0) AS default_profit_margin,
              COALESCE(default_tax_rate, 0) AS default_tax_rate,
              COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
       FROM item_types WHERE id = ? LIMIT 1`
    )
    .get(id) as ItemTypeSyncPayload['item_type'] | undefined

  if (!row) throw new Error(`Item type ${id} not found for sync`)
  return { item_type: row }
}

export function enqueueItemTypeSync(id: number, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
  const device = getDeviceConfig()
  if (!device) return
  try {
    const payload = getItemTypeSyncPayload(id)
    enqueueSyncItem({
      entity_type: 'item_type',
      entity_id: String(id),
      operation,
      payload: JSON.stringify(payload),
      device_id: device.device_id
    })
  } catch {
    // Local save already succeeded — enqueue failure is non-blocking
  }
}
