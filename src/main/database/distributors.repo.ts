import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import { NAME_MAX_LENGTH } from '../../shared/constants'
import type {
  Distributor,
  CreateDistributorInput,
  UpdateDistributorInput
} from '../../shared/types'
import type { DistributorSyncPayload } from '../services/sync/types'

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

  const newDistributorNumber = Number(result.lastInsertRowid)
  enqueueDistributorSync(newDistributorNumber, 'INSERT')
  return {
    distributor_number: newDistributorNumber,
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

  enqueueDistributorSync(input.distributor_number, 'UPDATE')
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

  enqueueDistributorSync(distributorNumber, 'DELETE')
  db.prepare('DELETE FROM distributors WHERE distributor_number = ?').run(distributorNumber)
}

// ── Sync helpers ──

function getDistributorSyncPayload(distributorNumber: number): DistributorSyncPayload {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT distributor_number, cloud_id, distributor_name, license_id, serial_number,
              premises_name, premises_address, is_active,
              COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
       FROM distributors WHERE distributor_number = ? LIMIT 1`
    )
    .get(distributorNumber) as DistributorSyncPayload['distributor'] | undefined

  if (!row) throw new Error(`Distributor ${distributorNumber} not found for sync`)
  return { distributor: row }
}

export function enqueueDistributorSync(
  distributorNumber: number,
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
): void {
  const device = getDeviceConfig()
  if (!device) return
  try {
    const payload = getDistributorSyncPayload(distributorNumber)
    enqueueSyncItem({
      entity_type: 'distributor',
      entity_id: String(distributorNumber),
      operation,
      payload: JSON.stringify(payload),
      device_id: device.device_id
    })
  } catch {
    // Local save already succeeded — enqueue failure is non-blocking
  }
}
