import * as bcrypt from 'bcrypt'
import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import type { Cashier, CreateCashierInput, UpdateCashierInput } from '../../shared/types'
import type { CashierSyncPayload } from '../services/sync/types'

const BCRYPT_ROUNDS = 10

/**
 * Hash a 4-digit PIN using bcrypt.
 */
export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, BCRYPT_ROUNDS)
}

/**
 * Get all cashiers (without pin_hash).
 */
export function getCashiers(): Cashier[] {
  const db = getDb()
  return db
    .prepare('SELECT id, name, role, is_active, created_at FROM cashiers ORDER BY name')
    .all() as Cashier[]
}

/**
 * Create a new cashier with a hashed PIN.
 */
export function createCashier(input: CreateCashierInput): Cashier {
  const db = getDb()
  const pinHash = hashPin(input.pin)
  const role = input.role ?? 'cashier'

  const result = db
    .prepare(`INSERT INTO cashiers (name, pin_hash, role) VALUES (?, ?, ?)`)
    .run(input.name, pinHash, role)

  const created = db
    .prepare('SELECT id, name, role, is_active, created_at FROM cashiers WHERE id = ?')
    .get(result.lastInsertRowid) as Cashier
  enqueueCashierSync(created.id, 'INSERT')
  return created
}

/**
 * Validate a PIN and return the matching cashier (or null).
 * Only checks active cashiers.
 */
export function validatePin(pin: string): Cashier | null {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT id, name, role, is_active, created_at, pin_hash FROM cashiers WHERE is_active = 1'
    )
    .all() as (Cashier & { pin_hash: string })[]

  for (const row of rows) {
    if (bcrypt.compareSync(pin, row.pin_hash)) {
      // Return without pin_hash
      const { pin_hash: _pinHash, ...cashier } = row
      return cashier as Cashier
    }
  }

  return null
}

/**
 * Update an existing cashier (name, PIN, role, active status).
 */
export function updateCashier(input: UpdateCashierInput): Cashier {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM cashiers WHERE id = ?').get(input.id) as
    | (Cashier & { pin_hash: string })
    | undefined

  if (!existing) {
    throw new Error(`Cashier with id ${input.id} not found`)
  }

  const name = input.name ?? existing.name
  const role = input.role ?? existing.role
  const isActive = input.is_active ?? existing.is_active
  const pinHash = input.pin ? hashPin(input.pin) : existing.pin_hash

  db.prepare(
    `UPDATE cashiers SET name = ?, pin_hash = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(name, pinHash, role, isActive, input.id)

  const updated = db
    .prepare('SELECT id, name, role, is_active, created_at FROM cashiers WHERE id = ?')
    .get(input.id) as Cashier
  enqueueCashierSync(input.id, 'UPDATE')
  return updated
}

/**
 * Delete a cashier by ID.
 */
export function deleteCashier(id: number): void {
  const db = getDb()
  enqueueCashierSync(id, 'DELETE')
  const result = db.prepare('DELETE FROM cashiers WHERE id = ?').run(id)
  if (result.changes === 0) {
    throw new Error(`Cashier with id ${id} not found`)
  }
}

// ── Sync helpers (main process only — pin_hash must not reach renderer) ──

function getCashierSyncPayload(id: number): CashierSyncPayload {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, cloud_id, name, role, pin_hash, is_active,
              COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
       FROM cashiers WHERE id = ? LIMIT 1`
    )
    .get(id) as CashierSyncPayload['cashier'] | undefined

  if (!row) throw new Error(`Cashier ${id} not found for sync`)
  return { cashier: row }
}

export function enqueueCashierSync(id: number, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
  const device = getDeviceConfig()
  if (!device) return
  try {
    const payload = getCashierSyncPayload(id)
    enqueueSyncItem({
      entity_type: 'cashier',
      entity_id: String(id),
      operation,
      payload: JSON.stringify(payload),
      device_id: device.device_id
    })
  } catch {
    // Local save already succeeded — enqueue failure is non-blocking
  }
}
