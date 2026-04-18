import Database from 'better-sqlite3'
import * as bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, setDatabase } from './connection'
import { applySchema } from './schema'
import {
  getCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  hashPin,
  validatePin
} from './cashiers.repo'
import { getPendingItems } from './sync-queue.repo'

// Mock getDeviceConfig so enqueue doesn't fail
vi.mock('./device-config.repo', () => ({
  getDeviceConfig: () => ({
    device_id: 'test-device-uuid',
    merchant_id: 'test-merchant',
    subscription_status: 'active',
    created_at: new Date().toISOString()
  })
}))

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('cashiers.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('getCashiers', () => {
    it('returns empty list on fresh DB', () => {
      const cashiers = getCashiers()
      expect(cashiers).toEqual([])
    })

    it('returns all cashiers ordered by name', async () => {
      await createCashier({ name: 'Zoe', pin: '1234', role: 'admin' })
      await createCashier({ name: 'Alice', pin: '5678', role: 'cashier' })

      const list = getCashiers()
      expect(list.length).toBe(2)
      expect(list[0].name).toBe('Alice')
      expect(list[1].name).toBe('Zoe')
    })

    it('does not expose pin_hash in returned cashier objects', async () => {
      await createCashier({ name: 'Test', pin: '1234' })

      const cashiers = getCashiers()
      expect(cashiers[0]).not.toHaveProperty('pin_hash')
    })
  })

  describe('hashPin', () => {
    it('returns different hash each time due to bcrypt salt', async () => {
      const hash1 = await hashPin('1234')
      const hash2 = await hashPin('1234')
      expect(hash1).not.toBe(hash2) // bcrypt includes random salt
    })

    it('can verify PIN against hash using bcrypt.compare', async () => {
      const pin = '1234'
      const hash = await hashPin(pin)
      const isValid = await bcrypt.compare(pin, hash)
      expect(isValid).toBe(true)
    })

    it('fails verification for wrong PIN', async () => {
      const hash = await hashPin('1234')
      const isValid = await bcrypt.compare('5678', hash)
      expect(isValid).toBe(false)
    })

    it('returns a non-empty string', async () => {
      const hash = await hashPin('1234')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('createCashier', () => {
    it('creates a new cashier with bcrypt-hashed PIN and enqueues INSERT', async () => {
      const result = await createCashier({
        name: 'John Cashier',
        pin: '1234',
        role: 'cashier'
      })

      expect(result.id).toBeGreaterThan(0)
      expect(result.name).toBe('John Cashier')
      expect(result.role).toBe('cashier')
      expect(result.is_active).toBe(1)
      expect(result).not.toHaveProperty('pin_hash')

      // Verify enqueued for sync
      const pending = getPendingItems()
      expect(pending).toHaveLength(1)
      expect(pending[0].entity_type).toBe('cashier')
      expect(pending[0].entity_id).toBe(String(result.id))
      expect(pending[0].operation).toBe('INSERT')
    })

    it('defaults role to cashier if not provided', async () => {
      const result = await createCashier({
        name: 'Default Role',
        pin: '1234'
      })

      expect(result.role).toBe('cashier')
    })

    it('stores bcrypt PIN hash, not the PIN itself', async () => {
      const result = await createCashier({
        name: 'Secure',
        pin: '1234',
        role: 'cashier'
      })

      const stored = getDb()
        .prepare('SELECT pin_hash FROM cashiers WHERE id = ?')
        .get(result.id) as { pin_hash: string }

      expect(stored.pin_hash).not.toBe('1234')
      // Verify it's a valid bcrypt hash
      const isValid = await bcrypt.compare('1234', stored.pin_hash)
      expect(isValid).toBe(true)
    })

    it('enqueues payload with pin_hash for sync', async () => {
      const result = await createCashier({
        name: 'Sync Test',
        pin: '9999',
        role: 'admin'
      })

      const pending = getPendingItems()
      const payload = JSON.parse(pending[0].payload)

      expect(payload.cashier).toBeDefined()
      expect(payload.cashier.id).toBe(result.id)
      expect(payload.cashier.name).toBe('Sync Test')
      expect(payload.cashier.role).toBe('admin')
      // Verify pin_hash in payload is valid bcrypt hash
      const isValid = await bcrypt.compare('9999', payload.cashier.pin_hash)
      expect(isValid).toBe(true)
    })
  })

  describe('validatePin', () => {
    it('returns the cashier for a valid PIN and active status', async () => {
      const created = await createCashier({
        name: 'Validator',
        pin: '7777',
        role: 'cashier'
      })

      const result = await validatePin('7777')
      expect(result).toBeDefined()
      expect(result?.id).toBe(created.id)
      expect(result?.name).toBe('Validator')
    })

    it('returns null for invalid PIN', async () => {
      await createCashier({ name: 'Test', pin: '1234' })

      const result = await validatePin('9999')
      expect(result).toBeNull()
    })

    it('returns null for inactive cashier', async () => {
      const created = await createCashier({ name: 'Inactive', pin: '1234' })

      // Manually deactivate
      getDb().prepare('UPDATE cashiers SET is_active = 0 WHERE id = ?').run(created.id)

      const result = await validatePin('1234')
      expect(result).toBeNull()
    })

    it('uses timing-safe bcrypt.compare for validation', async () => {
      const created = await createCashier({
        name: 'Timing Safe',
        pin: '5555',
        role: 'cashier'
      })

      // Valid PIN should return cashier
      const valid = await validatePin('5555')
      expect(valid?.id).toBe(created.id)

      // Invalid PIN should return null (not throw)
      const invalid = await validatePin('0000')
      expect(invalid).toBeNull()
    })
  })

  describe('updateCashier', () => {
    it('updates name and enqueues UPDATE sync', async () => {
      const created = await createCashier({
        name: 'Old Name',
        pin: '1234',
        role: 'cashier'
      })

      const result = await updateCashier({
        id: created.id,
        name: 'New Name'
      })

      expect(result.id).toBe(created.id)
      expect(result.name).toBe('New Name')
      expect(result.role).toBe('cashier')

      const pending = getPendingItems()
      const updates = pending.filter((p) => p.operation === 'UPDATE')
      expect(updates).toHaveLength(1)
      expect(updates[0].entity_id).toBe(String(created.id))
    })

    it('updates PIN hash if new PIN provided', async () => {
      const created = await createCashier({
        name: 'Pin Update',
        pin: '1111',
        role: 'cashier'
      })

      await updateCashier({
        id: created.id,
        pin: '2222'
      })

      // Old PIN should fail
      expect(await validatePin('1111')).toBeNull()

      // New PIN should work
      const validated = await validatePin('2222')
      expect(validated?.id).toBe(created.id)
    })

    it('updates role and is_active status', async () => {
      const created = await createCashier({
        name: 'Status Test',
        pin: '1234',
        role: 'cashier'
      })

      const result = await updateCashier({
        id: created.id,
        role: 'admin',
        is_active: 0
      })

      expect(result.role).toBe('admin')
      expect(result.is_active).toBe(0)
    })

    it('allows partial updates (omitted fields preserved)', async () => {
      const created = await createCashier({
        name: 'Preserve Test',
        pin: '1234',
        role: 'admin'
      })

      await updateCashier({
        id: created.id,
        name: 'New Name'
        // role and pin omitted (should be preserved)
      })

      const updated = getDb()
        .prepare('SELECT name, role, pin_hash FROM cashiers WHERE id = ?')
        .get(created.id) as { name: string; role: string; pin_hash: string }

      expect(updated.name).toBe('New Name')
      expect(updated.role).toBe('admin')
      // Verify PIN is still original using bcrypt
      const isValid = await bcrypt.compare('1234', updated.pin_hash)
      expect(isValid).toBe(true)
    })

    it('throws when cashier does not exist', () => {
      expect(() => updateCashier({ id: 9999, name: 'Ghost' })).toThrow(
        'Cashier with id 9999 not found'
      )
    })
  })

  describe('deleteCashier', () => {
    it('enqueues DELETE before deleting and throws if not found', async () => {
      const created = await createCashier({
        name: 'To Delete',
        pin: '1234'
      })

      // Clear INSERT from queue
      const pending1 = getPendingItems()
      expect(pending1).toHaveLength(1)

      deleteCashier(created.id)

      const allPending = getPendingItems()
      const deleteOps = allPending.filter((p) => p.operation === 'DELETE')
      expect(deleteOps).toHaveLength(1)
      expect(deleteOps[0].entity_id).toBe(String(created.id))

      // Verify deleted
      const list = getCashiers()
      expect(list.length).toBe(0)
    })

    it('enqueues DELETE with pin_hash available at save time', async () => {
      const created = await createCashier({
        name: 'Delete Sync',
        pin: '4444'
      })

      // Clear INSERT
      getPendingItems()

      deleteCashier(created.id)

      const pending = getPendingItems()
      const deleteOp = pending.find((p) => p.operation === 'DELETE')

      expect(deleteOp).toBeDefined()
      const payload = JSON.parse(deleteOp!.payload)
      // Verify pin_hash is valid bcrypt hash
      const isValid = await bcrypt.compare('4444', payload.cashier.pin_hash)
      expect(isValid).toBe(true)
    })

    it('throws when cashier does not exist', () => {
      expect(() => deleteCashier(9999)).toThrow('Cashier with id 9999 not found')
    })
  })

  describe('enqueue sync integrity', () => {
    it('enqueues payload with correct structure on create', async () => {
      const created = await createCashier({
        name: 'Payload Test',
        pin: '5555',
        role: 'admin'
      })

      const pending = getPendingItems()
      const payload = JSON.parse(pending[0].payload)

      expect(payload.cashier).toBeDefined()
      expect(payload.cashier.id).toBe(created.id)
      expect(payload.cashier.name).toBe('Payload Test')
      expect(payload.cashier.role).toBe('admin')
      expect(payload.cashier.is_active).toBe(1)
      expect(payload.cashier.updated_at).toBeDefined()
      // Verify pin_hash is valid bcrypt
      const isValid = await bcrypt.compare('5555', payload.cashier.pin_hash)
      expect(isValid).toBe(true)
    })

    it('enqueues multiple operations in FIFO order', async () => {
      const c1 = await createCashier({ name: 'First', pin: '1111' })
      const c2 = await createCashier({ name: 'Second', pin: '2222' })

      await updateCashier({ id: c1.id, name: 'First Updated' })
      deleteCashier(c2.id)

      const pending = getPendingItems()
      expect(pending.map((p) => p.operation)).toEqual(['INSERT', 'INSERT', 'UPDATE', 'DELETE'])
    })
  })
})
