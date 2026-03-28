import { getDb } from './connection'
import { NAME_MAX_LENGTH } from '../../shared/constants'
import type { SalesRep, CreateSalesRepInput, UpdateSalesRepInput } from '../../shared/types'

export function getSalesRepsByDistributor(distributorNumber: number): SalesRep[] {
  return getDb()
    .prepare(
      `
      SELECT sales_rep_id, distributor_number, rep_name, phone, email, is_active
      FROM sales_reps
      WHERE distributor_number = ?
      ORDER BY rep_name
      `
    )
    .all(distributorNumber) as SalesRep[]
}

export function createSalesRep(input: CreateSalesRepInput): SalesRep {
  const db = getDb()
  const repName = input.rep_name.trim()

  if (!repName) {
    throw new Error('Sales rep name is required')
  }

  if (repName.length > NAME_MAX_LENGTH) {
    throw new Error(`Sales rep name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const distributor = db
    .prepare('SELECT distributor_number FROM distributors WHERE distributor_number = ?')
    .get(input.distributor_number) as { distributor_number: number } | undefined

  if (!distributor) {
    throw new Error('Distributor not found')
  }

  const result = db
    .prepare(
      `
      INSERT INTO sales_reps (distributor_number, rep_name, phone, email)
      VALUES (?, ?, ?, ?)
      `
    )
    .run(input.distributor_number, repName, input.phone ?? null, input.email ?? null)

  return {
    sales_rep_id: Number(result.lastInsertRowid),
    distributor_number: input.distributor_number,
    rep_name: repName,
    phone: input.phone ?? null,
    email: input.email ?? null,
    is_active: 1
  }
}

export function updateSalesRep(input: UpdateSalesRepInput): SalesRep {
  const db = getDb()
  const repName = input.rep_name.trim()

  if (!repName) {
    throw new Error('Sales rep name is required')
  }

  if (repName.length > NAME_MAX_LENGTH) {
    throw new Error(`Sales rep name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db
    .prepare('SELECT sales_rep_id, distributor_number FROM sales_reps WHERE sales_rep_id = ?')
    .get(input.sales_rep_id) as { sales_rep_id: number; distributor_number: number } | undefined

  if (!existing) {
    throw new Error('Sales rep not found')
  }

  db.prepare(
    `
    UPDATE sales_reps
    SET rep_name = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE sales_rep_id = ?
    `
  ).run(repName, input.phone ?? null, input.email ?? null, input.sales_rep_id)

  return {
    sales_rep_id: input.sales_rep_id,
    distributor_number: existing.distributor_number,
    rep_name: repName,
    phone: input.phone ?? null,
    email: input.email ?? null,
    is_active: 1
  }
}

export function deleteSalesRep(salesRepId: number): void {
  const db = getDb()

  const existing = db
    .prepare('SELECT sales_rep_id FROM sales_reps WHERE sales_rep_id = ?')
    .get(salesRepId) as { sales_rep_id: number } | undefined

  if (!existing) {
    throw new Error('Sales rep not found')
  }

  db.prepare('DELETE FROM sales_reps WHERE sales_rep_id = ?').run(salesRepId)
}
