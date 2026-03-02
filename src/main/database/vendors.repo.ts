import { getDb } from './connection'
import { NAME_MAX_LENGTH } from '../../shared/constants'
import type { Vendor, CreateVendorInput, UpdateVendorInput } from '../../shared/types'

export function getVendors(): Vendor[] {
  return getDb()
    .prepare(
      `
      SELECT vendor_number, vendor_name, contact_name, phone, email, is_active
      FROM vendors
      ORDER BY vendor_name
      `
    )
    .all() as Vendor[]
}

export function createVendor(input: CreateVendorInput): Vendor {
  const db = getDb()
  const vendorName = input.vendor_name.trim()

  if (!vendorName) {
    throw new Error('Vendor name is required')
  }

  if (vendorName.length > NAME_MAX_LENGTH) {
    throw new Error(`Vendor name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const result = db
    .prepare(
      `
      INSERT INTO vendors (vendor_name, contact_name, phone, email)
      VALUES (?, ?, ?, ?)
      `
    )
    .run(vendorName, input.contact_name ?? null, input.phone ?? null, input.email ?? null)

  return {
    vendor_number: Number(result.lastInsertRowid),
    vendor_name: vendorName,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    is_active: 1
  }
}

export function updateVendor(input: UpdateVendorInput): Vendor {
  const db = getDb()
  const vendorName = input.vendor_name.trim()

  if (!vendorName) {
    throw new Error('Vendor name is required')
  }

  if (vendorName.length > NAME_MAX_LENGTH) {
    throw new Error(`Vendor name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db
    .prepare('SELECT vendor_number FROM vendors WHERE vendor_number = ?')
    .get(input.vendor_number) as { vendor_number: number } | undefined

  if (!existing) {
    throw new Error('Vendor not found')
  }

  db.prepare(
    `
    UPDATE vendors
    SET vendor_name = ?, contact_name = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE vendor_number = ?
    `
  ).run(
    vendorName,
    input.contact_name ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.vendor_number
  )

  return {
    vendor_number: input.vendor_number,
    vendor_name: vendorName,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    is_active: 1
  }
}

export function deleteVendor(vendorNumber: number): void {
  const db = getDb()

  const existing = db
    .prepare('SELECT vendor_number FROM vendors WHERE vendor_number = ?')
    .get(vendorNumber) as { vendor_number: number } | undefined

  if (!existing) {
    throw new Error('Vendor not found')
  }

  const productCount = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE vendor_number = ?')
    .get(vendorNumber) as { count: number }

  if (productCount.count > 0) {
    throw new Error('Cannot delete vendor that is assigned to products')
  }

  db.prepare('DELETE FROM vendors WHERE vendor_number = ?').run(vendorNumber)
}
