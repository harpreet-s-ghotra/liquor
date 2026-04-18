import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, setDatabase } from './connection'
import { applySchema } from './schema'
import { getItemTypes, createItemType, updateItemType, deleteItemType } from './item-types.repo'
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

describe('item-types.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  describe('getItemTypes', () => {
    it('returns empty list when no item types exist', () => {
      const itemTypes = getItemTypes()
      expect(itemTypes).toEqual([])
    })

    it('returns all item types ordered by name', () => {
      createItemType({
        name: 'Spirits',
        description: null,
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      })
      createItemType({
        name: 'Beer',
        description: null,
        default_profit_margin: 0.25,
        default_tax_rate: 0.08
      })
      createItemType({
        name: 'Wine',
        description: null,
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      const itemTypes = getItemTypes()

      expect(itemTypes.length).toBe(3)
      expect(itemTypes.map((it) => it.name)).toEqual(['Beer', 'Spirits', 'Wine'])
    })
  })

  describe('createItemType', () => {
    it('creates a new item type', () => {
      const result = createItemType({
        name: 'Wine',
        description: 'Wine beverages',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Wine')
      expect(result.description).toBe('Wine beverages')
      expect(result.default_profit_margin).toBe(0.35)
      expect(result.default_tax_rate).toBe(0.08)
    })

    it('trims whitespace from name', () => {
      const result = createItemType({
        name: '  Wine  ',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0
      })

      expect(result.name).toBe('Wine')
    })

    it('throws error for empty name', () => {
      expect(() => {
        createItemType({
          name: '   ',
          description: null,
          default_profit_margin: 0,
          default_tax_rate: 0
        })
      }).toThrow('Item type name is required')
    })

    it('throws error for duplicate name', () => {
      createItemType({
        name: 'Wine',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0
      })

      expect(() => {
        createItemType({
          name: 'Wine',
          description: null,
          default_profit_margin: 0,
          default_tax_rate: 0
        })
      }).toThrow('Item type already exists')
    })
  })

  describe('updateItemType', () => {
    it('updates an existing item type', () => {
      const created = createItemType({
        name: 'Wine',
        description: null,
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      })

      const updated = updateItemType({
        id: created.id,
        name: 'Red Wine',
        description: 'Red wine products',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('Red Wine')
      expect(updated.description).toBe('Red wine products')
      expect(updated.default_profit_margin).toBe(0.35)
    })

    it('syncs product item_type references when renamed', () => {
      const db = getDb()

      const itemType = createItemType({
        name: 'Wine',
        description: null,
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      db.prepare(
        'INSERT INTO products (sku, name, category, item_type, price, in_stock, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('WINE-001', 'Test Wine', 'Wine', 'Wine', 15.0, 10, 0.08)

      updateItemType({
        id: itemType.id,
        name: 'Red Wine',
        description: null,
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      const product = db
        .prepare('SELECT item_type FROM products WHERE sku = ?')
        .get('WINE-001') as {
        item_type: string | null
      }
      expect(product.item_type).toBe('Red Wine')
    })

    it('throws error for non-existent item type', () => {
      expect(() => {
        updateItemType({
          id: 999,
          name: 'Nonexistent',
          description: null,
          default_profit_margin: 0,
          default_tax_rate: 0
        })
      }).toThrow('Item type not found')
    })
  })

  describe('deleteItemType', () => {
    it('deletes an item type', () => {
      const itemType = createItemType({
        name: 'Wine',
        description: null,
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      deleteItemType(itemType.id)

      const items = getItemTypes()
      expect(items.length).toBe(0)
    })

    it('throws error when deleting item type assigned to products', () => {
      const db = getDb()

      const itemType = createItemType({
        name: 'Wine',
        description: null,
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      db.prepare(
        'INSERT INTO products (sku, name, category, item_type, price, in_stock, tax_rate) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run('WINE-001', 'Test Wine', 'Wine', 'Wine', 15.0, 10, 0.08)

      expect(() => {
        deleteItemType(itemType.id)
      }).toThrow('Cannot delete item type that is assigned to products')
    })

    it('throws error for non-existent item type', () => {
      expect(() => {
        deleteItemType(999)
      }).toThrow('Item type not found')
    })
  })

  describe('enqueue sync for item types', () => {
    it('enqueues INSERT when creating an item type', () => {
      const created = createItemType({
        name: 'Spirits',
        description: 'Spirit beverages',
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      })

      const pending = getPendingItems()
      const itemTypeInsert = pending.find(
        (p) =>
          p.entity_type === 'item_type' &&
          p.entity_id === String(created.id) &&
          p.operation === 'INSERT'
      )

      expect(itemTypeInsert).toBeDefined()
      expect(itemTypeInsert?.status).toBe('pending')
      expect(itemTypeInsert?.device_id).toBe('test-device-uuid')
    })

    it('enqueues UPDATE when updating an item type', () => {
      const created = createItemType({
        name: 'Wine',
        description: 'Original description',
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      })

      const updated = updateItemType({
        id: created.id,
        name: 'Wine', // Same name, just updating description
        description: 'New description',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })

      // Get all pending items and find the UPDATE
      const pending = getPendingItems()
      const updateOps = pending.filter(
        (p) =>
          p.entity_type === 'item_type' &&
          p.entity_id === String(updated.id) &&
          p.operation === 'UPDATE'
      )
      expect(updateOps).toHaveLength(1)
    })

    it('enqueues DELETE when deleting an item type', () => {
      const created = createItemType({
        name: 'To Delete',
        description: null,
        default_profit_margin: 0,
        default_tax_rate: 0
      })

      deleteItemType(created.id)

      // Get all pending items and find the DELETE
      const pending = getPendingItems()
      const deleteOps = pending.filter(
        (p) =>
          p.entity_type === 'item_type' &&
          p.entity_id === String(created.id) &&
          p.operation === 'DELETE'
      )
      expect(deleteOps).toHaveLength(1)
    })

    it('enqueues payload with correct structure', () => {
      const created = createItemType({
        name: 'Payload Test',
        description: 'Test description',
        default_profit_margin: 0.4,
        default_tax_rate: 0.09
      })

      const pending = getPendingItems()
      const itemTypeInsert = pending.find(
        (p) =>
          p.entity_type === 'item_type' &&
          p.entity_id === String(created.id) &&
          p.operation === 'INSERT'
      )

      expect(itemTypeInsert).toBeDefined()
      const payload = JSON.parse(itemTypeInsert!.payload)

      expect(payload.item_type).toBeDefined()
      expect(payload.item_type.id).toBe(created.id)
      expect(payload.item_type.name).toBe('Payload Test')
      expect(payload.item_type.description).toBe('Test description')
      expect(payload.item_type.default_profit_margin).toBe(0.4)
      expect(payload.item_type.default_tax_rate).toBe(0.09)
      expect(payload.item_type.updated_at).toBeDefined()
    })

    it('enqueues multiple operations in FIFO order', () => {
      const it1 = createItemType({
        name: 'First',
        description: null,
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      })
      const it2 = createItemType({
        name: 'Second',
        description: null,
        default_profit_margin: 0.3,
        default_tax_rate: 0.08
      })

      updateItemType({
        id: it1.id,
        name: 'First',
        description: 'Updated',
        default_profit_margin: 0.35,
        default_tax_rate: 0.08
      })
      deleteItemType(it2.id)

      const pending = getPendingItems()
      const itemTypeOps = pending
        .filter((p) => p.entity_type === 'item_type')
        .map((p) => p.operation)
      const departmentOps = pending
        .filter((p) => p.entity_type === 'department')
        .map((p) => p.operation)

      expect(itemTypeOps).toEqual(['INSERT', 'INSERT', 'UPDATE', 'DELETE'])
      expect(departmentOps).toEqual(['INSERT', 'INSERT', 'DELETE'])
    })
  })
})
