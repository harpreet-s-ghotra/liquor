import Database from 'better-sqlite3'
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

    it('returns all cashiers ordered by name', () => {
      createCashier({ name: 'Zoe', pin: '1234', role: 'admin' })
      createCashier({ name: 'Alice', pin: '5678', role: 'cashier' })

      const list = getCashiers()
      expect(list.length).toBe(2)
      expect(list[0].name).toBe('Alice')
      expect(list[1].name).toBe('Zoe')
    })

    it('does not expose pin_hash in returned cashier objects', () => {
      createCashier({ name: 'Test', pin: '1234' })

      const cashiers = getCashiers()
      expect(cashiers[0]).not.toHaveProperty('pin_hash')
    })
  })

  describe('hashPin', () => {
    it('returns consistent hash for same PIN', () => {
      const hash1 = hashPin('1234')
      const hash2 = hashPin('1234')
      expect(hash1).toBe(hash2)
    })

    it('returns different hash for different PINs', () => {
      const hash1 = hashPin('1234')
      const hash2 = hashPin('5678')
      expect(hash1).not.toBe(hash2)
    })

    it('returns a non-empty string', () => {
      const hash = hashPin('1234')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('createCashier', () => {
    it('creates a new cashier with hashed PIN and enqueues INSERT', () => {
      const result = createCashier({
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

    it('defaults role to cashier if not provided', () => {
      const result = createCashier({
        name: 'Default Role',
        pin: '1234'
      })

      expect(result.role).toBe('cashier')
    })

    it('stores PIN hash, not the PIN itself', () => {
      const result = createCashier({
        name: 'Secure',
        pin: '1234',
        role: 'cashier'
      })

      const stored = getDb()
        .prepare('SELECT pin_hash FROM cashiers WHERE id = ?')
        .get(result.id) as { pin_hash: string }

      expect(stored.pin_hash).not.toBe('1234')
      expect(stored.pin_hash).toBe(hashPin('1234'))
    })

    it('enqueues payload with pin_hash for sync', () => {
      const result = createCashier({
        name: 'Sync Test',
        pin: '9999',
        role: 'admin'
      })

      const pending = getPendingItems()
      const payload = JSON.parse(pending[0].payload)

      expect(payload.cashier).toBeDefined()
      expect(payload.cashier.id).toBe(result.id)
      expect(payload.cashier.name).toBe('Sync Test')
      expect(payload.cashier.pin_hash).toBe(hashPin('9999'))
      expect(payload.cashier.role).toBe('admin')
    })
  })

  describe('validatePin', () => {
    it('returns the cashier for a valid PIN and active status', () => {
      const created = createCashier({
        name: 'Validator',
        pin: '7777',
        role: 'cashier'
      })

      const result = validatePin('7777')
      expect(result).toBeDefined()
      expect(result?.id).toBe(created.id)
      expect(result?.name).toBe('Validator')
    })

    it('returns null for invalid PIN', () => {
      createCashier({ name: 'Test', pin: '1234' })

      const result = validatePin('9999')
      expect(result).toBeNull()
    })

    it('returns null for inactive cashier', () => {
      const created = createCashier({ name: 'Inactive', pin: '1234' })

      // Manually deactivate
      getDb().prepare('UPDATE cashiers SET is_active = 0 WHERE id = ?').run(created.id)

      const result = validatePin('1234')
      expect(result).toBeNull()
    })
  })

  describe('updateCashier', () => {
    it('updates name and enqueues UPDATE sync', () => {
      const created = createCashier({
        name: 'Old Name',
        pin: '1234',
        role: 'cashier'
      })

      const result = updateCashier({
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

    it('updates PIN hash if new PIN provided', () => {
      const created = createCashier({
        name: 'Pin Update',
        pin: '1111',
        role: 'cashier'
      })

      updateCashier({
        id: created.id,
        pin: '2222'
      })

      // Old PIN should fail
      expect(validatePin('1111')).toBeNull()

      // New PIN should work
      const validated = validatePin('2222')
      expect(validated?.id).toBe(created.id)
    })

    it('updates role and is_active status', () => {
      const created = createCashier({
        name: 'Status Test',
        pin: '1234',
        role: 'cashier'
      })

      const result = updateCashier({
        id: created.id,
        role: 'admin',
        is_active: 0
      })

      expect(result.role).toBe('admin')
      expect(result.is_active).toBe(0)
    })

    it('allows partial updates (omitted fields preserved)', () => {
      const created = createCashier({
        name: 'Preserve Test',
        pin: '1234',
        role: 'admin'
      })

      updateCashier({
        id: created.id,
        name: 'New Name'
        // role and pin omitted (should be preserved)
      })

      const updated = getDb()
        .prepare('SELECT name, role, pin_hash FROM cashiers WHERE id = ?')
        .get(created.id) as { name: string; role: string; pin_hash: string }

      expect(updated.name).toBe('New Name')
      expect(updated.role).toBe('admin')
      expect(updated.pin_hash).toBe(hashPin('1234'))
    })

    it('throws when cashier does not exist', () => {
      expect(() => updateCashier({ id: 9999, name: 'Ghost' })).toThrow(
        'Cashier with id 9999 not found'
      )
    })
  })

  describe('deleteCashier', () => {
    it('enqueues DELETE before deleting and throws if not found', () => {
      const created = createCashier({
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

    it('enqueues DELETE with pin_hash available at save time', () => {
      const created = createCashier({
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
      expect(payload.cashier.pin_hash).toBe(hashPin('4444'))
    })

    it('throws when cashier does not exist', () => {
      expect(() => deleteCashier(9999)).toThrow('Cashier with id 9999 not found')
    })
  })

  describe('enqueue sync integrity', () => {
    it('enqueues payload with correct structure on create', () => {
      const created = createCashier({
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
      expect(payload.cashier.pin_hash).toBe(hashPin('5555'))
      expect(payload.cashier.is_active).toBe(1)
      expect(payload.cashier.updated_at).toBeDefined()
    })

    it('enqueues multiple operations in FIFO order', () => {
      const c1 = createCashier({ name: 'First', pin: '1111' })
      const c2 = createCashier({ name: 'Second', pin: '2222' })

      updateCashier({ id: c1.id, name: 'First Updated' })
      deleteCashier(c2.id)

      const pending = getPendingItems()
      expect(pending.map((p) => p.operation)).toEqual(['INSERT', 'INSERT', 'UPDATE', 'DELETE'])
    })
  })
})
