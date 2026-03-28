import { getDb } from './connection'
import { NAME_MAX_LENGTH } from '../../shared/constants'
import type {
  Distributor,
  CreateDistributorInput,
  UpdateDistributorInput
} from '../../shared/types'

export function getDistributors(): Distributor[] {
  return getDb()
    .prepare(
      `
      SELECT distributor_number, distributor_name, license_id, serial_number,
             premises_name, premises_address, is_active
      FROM distributors
      ORDER BY distributor_name
      `
    )
    .all() as Distributor[]
}

export function createDistributor(input: CreateDistributorInput): Distributor {
  const db = getDb()
  const distributorName = input.distributor_name.trim()

  if (!distributorName) {
    throw new Error('Distributor name is required')
  }

  if (distributorName.length > NAME_MAX_LENGTH) {
    throw new Error(`Distributor name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const result = db
    .prepare(
      `
      INSERT INTO distributors (distributor_name, license_id, serial_number, premises_name, premises_address)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(
      distributorName,
      input.license_id ?? null,
      input.serial_number ?? null,
      input.premises_name ?? null,
      input.premises_address ?? null
    )

  return {
    distributor_number: Number(result.lastInsertRowid),
    distributor_name: distributorName,
    license_id: input.license_id ?? null,
    serial_number: input.serial_number ?? null,
    premises_name: input.premises_name ?? null,
    premises_address: input.premises_address ?? null,
    is_active: 1
  }
}

export function updateDistributor(input: UpdateDistributorInput): Distributor {
  const db = getDb()
  const distributorName = input.distributor_name.trim()

  if (!distributorName) {
    throw new Error('Distributor name is required')
  }

  if (distributorName.length > NAME_MAX_LENGTH) {
    throw new Error(`Distributor name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db
    .prepare('SELECT distributor_number FROM distributors WHERE distributor_number = ?')
    .get(input.distributor_number) as { distributor_number: number } | undefined

  if (!existing) {
    throw new Error('Distributor not found')
  }

  db.prepare(
    `
    UPDATE distributors
    SET distributor_name = ?, license_id = ?, serial_number = ?,
        premises_name = ?, premises_address = ?, updated_at = CURRENT_TIMESTAMP
    WHERE distributor_number = ?
    `
  ).run(
    distributorName,
    input.license_id ?? null,
    input.serial_number ?? null,
    input.premises_name ?? null,
    input.premises_address ?? null,
    input.distributor_number
  )

  return {
    distributor_number: input.distributor_number,
    distributor_name: distributorName,
    license_id: input.license_id ?? null,
    serial_number: input.serial_number ?? null,
    premises_name: input.premises_name ?? null,
    premises_address: input.premises_address ?? null,
    is_active: 1
  }
}

export function deleteDistributor(distributorNumber: number): void {
  const db = getDb()

  const existing = db
    .prepare('SELECT distributor_number FROM distributors WHERE distributor_number = ?')
    .get(distributorNumber) as { distributor_number: number } | undefined

  if (!existing) {
    throw new Error('Distributor not found')
  }

  const productCount = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE distributor_number = ?')
    .get(distributorNumber) as { count: number }

  if (productCount.count > 0) {
    throw new Error('Cannot delete distributor that is assigned to products')
  }

  // Delete associated sales reps first
  db.prepare('DELETE FROM sales_reps WHERE distributor_number = ?').run(distributorNumber)

  db.prepare('DELETE FROM distributors WHERE distributor_number = ?').run(distributorNumber)
}
