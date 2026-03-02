import { getDb } from './connection'
import { TAX_CODE_MAX_LENGTH } from '../../shared/constants'
import type { TaxCode, CreateTaxCodeInput, UpdateTaxCodeInput } from '../../shared/types'

function normalizeTaxRate(value: number): number {
  return Number(value.toFixed(4))
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
  return { id: Number(result.lastInsertRowid), code, rate }
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

  db.prepare('DELETE FROM tax_codes WHERE id = ?').run(id)
}
