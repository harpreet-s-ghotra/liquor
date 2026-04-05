import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import { TAX_CODE_MAX_LENGTH } from '../../shared/constants'
import type { TaxCode, CreateTaxCodeInput, UpdateTaxCodeInput } from '../../shared/types'
import type { TaxCodeSyncPayload } from '../services/sync/types'

function normalizeTaxRate(value: number): number {
  return Number(value.toFixed(6))
}

export function getTaxCodes(): TaxCode[] {
  return getDb().prepare('SELECT id, code, rate FROM tax_codes ORDER BY rate').all() as TaxCode[]
}

export function createTaxCode(input: CreateTaxCodeInput): TaxCode {
  const db = getDb()
  const code = input.code.trim()

  if (!code) {
    throw new Error('Tax code name is required')
  }

  if (code.length > TAX_CODE_MAX_LENGTH) {
    throw new Error(`Tax code name must be ${TAX_CODE_MAX_LENGTH} characters or less`)
  }

  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1) {
    throw new Error('Tax rate must be between 0 and 1')
  }

  const existing = db.prepare('SELECT id FROM tax_codes WHERE code = ?').get(code) as
    | { id: number }
    | undefined

  if (existing) {
    throw new Error('Tax code already exists')
  }

  const rate = normalizeTaxRate(input.rate)
  const result = db.prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?)').run(code, rate)
  const newId = Number(result.lastInsertRowid)
  enqueueTaxCodeSync(newId, 'INSERT')
  return { id: newId, code, rate }
}

export function updateTaxCode(input: UpdateTaxCodeInput): TaxCode {
  const db = getDb()
  const code = input.code.trim()

  if (!code) {
    throw new Error('Tax code name is required')
  }

  if (code.length > TAX_CODE_MAX_LENGTH) {
    throw new Error(`Tax code name must be ${TAX_CODE_MAX_LENGTH} characters or less`)
  }

  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1) {
    throw new Error('Tax rate must be between 0 and 1')
  }

  const duplicate = db
    .prepare('SELECT id FROM tax_codes WHERE code = ? AND id != ?')
    .get(code, input.id) as { id: number } | undefined

  if (duplicate) {
    throw new Error('Tax code already exists')
  }

  const rate = normalizeTaxRate(input.rate)
  db.prepare(
    'UPDATE tax_codes SET code = ?, rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(code, rate, input.id)

  enqueueTaxCodeSync(input.id, 'UPDATE')
  return { id: input.id, code, rate }
}

export function deleteTaxCode(id: number): void {
  const db = getDb()

  const taxCode = db.prepare('SELECT id FROM tax_codes WHERE id = ?').get(id) as
    | { id: number }
    | undefined

  if (!taxCode) {
    throw new Error('Tax code not found')
  }

  enqueueTaxCodeSync(id, 'DELETE')
  db.prepare('DELETE FROM tax_codes WHERE id = ?').run(id)
}

// ── Sync helpers ──

function getTaxCodeSyncPayload(id: number): TaxCodeSyncPayload {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT id, cloud_id,
              code, rate,
              COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
       FROM tax_codes WHERE id = ? LIMIT 1`
    )
    .get(id) as TaxCodeSyncPayload['tax_code'] | undefined

  if (!row) throw new Error(`Tax code ${id} not found for sync`)
  return { tax_code: row }
}

export function enqueueTaxCodeSync(id: number, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
  const device = getDeviceConfig()
  if (!device) return
  try {
    const payload = getTaxCodeSyncPayload(id)
    enqueueSyncItem({
      entity_type: 'tax_code',
      entity_id: String(id),
      operation,
      payload: JSON.stringify(payload),
      device_id: device.device_id
    })
  } catch {
    // Local save already succeeded — enqueue failure is non-blocking
  }
}
