import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, setDatabase } from './connection'
import { saveDeviceConfig } from './device-config.repo'
import { getDeltasByProduct } from './inventory-deltas.repo'
import { applySchema, normalizeSearch } from './schema'
import { getPendingItems } from './sync-queue.repo'
import {
  deleteInventoryItem,
  findProductBySku,
  getActiveSpecialPricing,
  getInventoryItemTypes,
  getInventoryProductDetail,
  getInventoryProducts,
  getInventoryTaxCodes,
  getLowStockProducts,
  getProducts,
  getUnpricedInventoryProducts,
  saveInventoryItem,
  searchProducts,
  searchInventoryProducts
} from './products.repo'
import type { SaveInventoryItemInput } from '../../shared/types'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

const base: SaveInventoryItemInput = {
  sku: 'WINE-001',
  item_name: 'Test Wine',
  item_type: '',
  distributor_number: null,
  cost: 8,
  retail_price: 15,
  in_stock: 10,
  tax_rates: [],
  special_pricing: [],
  additional_skus: [],
  bottles_per_case: 12,
  case_discount_price: null,
  size: '',
  case_cost: null,
  nysla_discounts: null,
  brand_name: '',
  proof: null,
  alcohol_pct: null,
  vintage: '',
  ttb_id: '',
  display_name: ''
}

describe('saveInventoryItem', () => {
  beforeEach(() => createTestDb())

  it('inserts a new item and returns its detail', () => {
    const result = saveInventoryItem(base)

    expect(result.sku).toBe('WINE-001')
    expect(result.item_name).toBe('Test Wine')
    expect(result.retail_price).toBe(15)
    expect(result.cost).toBe(8)
    expect(result.in_stock).toBe(10)
    expect(result.item_number).toBeGreaterThan(0)
    expect(result.brand_name).toBeNull()
    expect(result.proof).toBeNull()
    expect(result.alcohol_pct).toBeNull()
    expect(result.vintage).toBeNull()
    expect(result.ttb_id).toBeNull()
  })

  it('updates an existing item', () => {
    const created = saveInventoryItem(base)

    const updated = saveInventoryItem({
      ...base,
      item_number: created.item_number,
      item_name: 'Updated Wine',
      retail_price: 20
    })

    expect(updated.item_number).toBe(created.item_number)
    expect(updated.item_name).toBe('Updated Wine')
    expect(updated.retail_price).toBe(20)
  })

  it('throws when SKU is missing', () => {
    expect(() => saveInventoryItem({ ...base, sku: '' })).toThrow('SKU is required')
  })

  it('throws when name is missing', () => {
    expect(() => saveInventoryItem({ ...base, item_name: '' })).toThrow('Name is required')
  })

  it('throws when SKU contains invalid characters', () => {
    expect(() => saveInventoryItem({ ...base, sku: 'bad sku!' })).toThrow(
      'SKU must contain only letters, numbers, and hyphens'
    )
  })

  it('throws when creating a second item with the same active SKU', () => {
    saveInventoryItem(base)
    expect(() => saveInventoryItem({ ...base, item_name: 'Duplicate' })).toThrow(
      'SKU already exists'
    )
  })

  it('throws when cost is negative', () => {
    expect(() => saveInventoryItem({ ...base, cost: -1 })).toThrow(
      'Cost must be a non-negative number'
    )
  })

  it('throws when price is negative', () => {
    expect(() => saveInventoryItem({ ...base, retail_price: -5 })).toThrow(
      'Price must be a non-negative number'
    )
  })

  it('enqueues product sync and manual adjustment delta when device is registered', () => {
    saveDeviceConfig({
      device_id: 'device-1',
      device_name: 'Register 1',
      device_fingerprint: 'fp-1'
    })

    const result = saveInventoryItem(base)

    const pending = getPendingItems()
    expect(pending.map((item) => item.entity_type)).toEqual(['product', 'inventory_delta'])

    const deltas = getDeltasByProduct(result.item_number)
    expect(deltas).toHaveLength(1)
    expect(deltas[0].delta).toBe(10)
    expect(deltas[0].reason).toBe('manual_adjustment')
  })

  it('only enqueues product sync when stock does not change on update', () => {
    saveDeviceConfig({
      device_id: 'device-1',
      device_name: 'Register 1',
      device_fingerprint: 'fp-1'
    })

    const created = saveInventoryItem(base)
    getDb().prepare('DELETE FROM sync_queue').run()

    saveInventoryItem({
      ...base,
      item_number: created.item_number,
      item_name: 'Renamed Wine',
      in_stock: 10
    })

    const pending = getPendingItems()
    expect(pending.map((item) => item.entity_type)).toEqual(['product'])
  })
})

describe('deleteInventoryItem', () => {
  beforeEach(() => createTestDb())

  it('sets is_active to 0 without deleting the row', () => {
    const item = saveInventoryItem(base)
    deleteInventoryItem(item.item_number)

    const row = getDb()
      .prepare('SELECT is_active FROM products WHERE id = ?')
      .get(item.item_number) as { is_active: number }

    expect(row.is_active).toBe(0)
  })

  it('hides the deleted item from getInventoryProducts', () => {
    const item = saveInventoryItem(base)
    saveInventoryItem({ ...base, sku: 'BEER-001', item_name: 'Beer' })

    deleteInventoryItem(item.item_number)

    const list = getInventoryProducts()
    expect(list).toHaveLength(1)
    expect(list[0].sku).toBe('BEER-001')
  })

  it('hides the deleted item from searchInventoryProducts', () => {
    const item = saveInventoryItem(base)
    deleteInventoryItem(item.item_number)

    const results = searchInventoryProducts('Wine')
    expect(results).toHaveLength(0)
  })

  it('preserves the product row so transaction history remains intact', () => {
    const item = saveInventoryItem(base)
    const db = getDb()

    db.prepare(
      `INSERT INTO transactions (transaction_number, subtotal, tax_amount, total, payment_method)
       VALUES ('TXN-001', 15, 0, 15, 'cash')`
    ).run()

    const txn = db
      .prepare(`SELECT id FROM transactions WHERE transaction_number = 'TXN-001'`)
      .get() as { id: number }

    db.prepare(
      `INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(txn.id, item.item_number, item.item_name, 1, 15, 15)

    // This would throw a foreign key violation if the row were hard-deleted
    deleteInventoryItem(item.item_number)

    const historyRow = db
      .prepare('SELECT product_id FROM transaction_items WHERE transaction_id = ?')
      .get(txn.id) as { product_id: number }

    expect(historyRow.product_id).toBe(item.item_number)
  })

  it('enqueues a delete sync event when device is registered', () => {
    saveDeviceConfig({
      device_id: 'device-1',
      device_name: 'Register 1',
      device_fingerprint: 'fp-1'
    })

    const item = saveInventoryItem(base)
    getDb().prepare('DELETE FROM sync_queue').run()

    deleteInventoryItem(item.item_number)

    const pending = getPendingItems()
    expect(pending).toHaveLength(1)
    expect(pending[0].entity_type).toBe('product')
    expect(pending[0].operation).toBe('DELETE')
  })
})

describe('SKU reactivation on re-add', () => {
  beforeEach(() => createTestDb())

  it('reactivates an inactive item when a new item uses the same SKU', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)

    const reactivated = saveInventoryItem({ ...base, item_name: 'Wine v2', retail_price: 18 })

    expect(reactivated.item_number).toBe(original.item_number)
    expect(reactivated.item_name).toBe('Wine v2')
    expect(reactivated.retail_price).toBe(18)
  })

  it('reactivated item is_active returns to 1', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)
    saveInventoryItem({ ...base, item_name: 'Wine v2' })

    const row = getDb()
      .prepare('SELECT is_active FROM products WHERE id = ?')
      .get(original.item_number) as { is_active: number }

    expect(row.is_active).toBe(1)
  })

  it('reactivated item appears in getInventoryProducts', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)

    saveInventoryItem({ ...base, item_name: 'Wine v2' })

    const list = getInventoryProducts()
    expect(list).toHaveLength(1)
    expect(list[0].sku).toBe('WINE-001')
  })

  it('reactivated item appears in searchInventoryProducts', () => {
    const original = saveInventoryItem(base)
    deleteInventoryItem(original.item_number)

    saveInventoryItem({ ...base, item_name: 'Wine v2' })

    const results = searchInventoryProducts('WINE')
    expect(results).toHaveLength(1)
    expect(results[0].sku).toBe('WINE-001')
  })

  it('still throws when the SKU belongs to a different active item', () => {
    saveInventoryItem(base)
    expect(() => saveInventoryItem({ ...base, item_name: 'Conflict' })).toThrow(
      'SKU already exists'
    )
  })
})

describe('getInventoryProductDetail', () => {
  beforeEach(() => createTestDb())

  it('returns null for a non-existent item', () => {
    expect(getInventoryProductDetail(9999)).toBeNull()
  })

  it('returns full detail including empty arrays for new item', () => {
    const item = saveInventoryItem(base)
    const detail = getInventoryProductDetail(item.item_number)

    expect(detail).not.toBeNull()
    expect(detail!.sku).toBe('WINE-001')
    expect(detail!.sales_history).toEqual([])
    expect(detail!.additional_skus).toEqual([])
    expect(detail!.special_pricing).toEqual([])
  })
})

describe('inventory read queries', () => {
  beforeEach(() => createTestDb())

  it('getProducts returns only active products with normalized price, quantity, and tax rate', () => {
    getDb().prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?)').run('STANDARD', 0.13)

    saveInventoryItem({
      ...base,
      sku: 'ACTIVE-001',
      item_name: 'Active Wine',
      retail_price: 18,
      in_stock: 7,
      tax_rates: [0.13]
    })

    const inactive = saveInventoryItem({
      ...base,
      sku: 'INACTIVE-001',
      item_name: 'Inactive Wine',
      retail_price: 22,
      in_stock: 3
    })
    deleteInventoryItem(inactive.item_number)

    expect(getProducts()).toEqual([
      expect.objectContaining({
        sku: 'ACTIVE-001',
        name: 'Active Wine',
        price: 18,
        quantity: 7,
        tax_rate: 0.13
      })
    ])
  })

  it('getInventoryProducts and searchInventoryProducts include distributor and brand metadata', () => {
    getDb()
      .prepare(
        'INSERT INTO distributors (distributor_number, distributor_name) VALUES (?, ?), (?, ?)'
      )
      .run(101, 'North Wines', 102, 'Craft Beer Co')

    saveInventoryItem({
      ...base,
      sku: 'WINE-META-1',
      item_name: 'Reserve Red',
      distributor_number: 101,
      brand_name: 'Estate Cellars'
    })
    saveInventoryItem({
      ...base,
      sku: 'BEER-META-1',
      item_name: 'Hazy IPA',
      distributor_number: 102,
      brand_name: 'Cloudburst'
    })

    const inventory = getInventoryProducts()
    expect(inventory).toHaveLength(2)
    expect(inventory[0]).toHaveProperty('distributor_name')

    expect(searchInventoryProducts('Estate')).toEqual([
      expect.objectContaining({
        sku: 'WINE-META-1',
        item_name: 'Reserve Red',
        distributor_name: 'North Wines',
        brand_name: 'Estate Cellars'
      })
    ])

    expect(searchInventoryProducts('')).toHaveLength(2)
  })

  it('getInventoryTaxCodes returns codes ordered by rate', () => {
    getDb()
      .prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?), (?, ?), (?, ?)')
      .run('HIGH', 0.13, 'LOW', 0.04, 'MID', 0.08)

    expect(getInventoryTaxCodes()).toEqual([
      { code: 'LOW', rate: 0.04 },
      { code: 'MID', rate: 0.08 },
      { code: 'HIGH', rate: 0.13 }
    ])
  })

  it('searchProducts filters by item type id and distributor number', () => {
    getDb()
      .prepare(
        'INSERT INTO item_types (id, name, description, default_profit_margin, default_tax_rate) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)'
      )
      .run(1, 'Wine', null, 0, 0, 2, 'Beer', null, 0, 0)
    getDb()
      .prepare(
        'INSERT INTO distributors (distributor_number, distributor_name) VALUES (?, ?), (?, ?)'
      )
      .run(201, 'Wine House', 202, 'Beer House')

    saveInventoryItem({
      ...base,
      sku: 'FILTER-WINE',
      item_name: 'Cabernet',
      item_type: 'Wine',
      distributor_number: 201
    })
    saveInventoryItem({
      ...base,
      sku: 'FILTER-BEER',
      item_name: 'Pilsner',
      item_type: 'Beer',
      distributor_number: 202
    })

    expect(searchProducts('ernet', { departmentId: 1 })).toEqual([
      expect.objectContaining({ sku: 'FILTER-WINE', name: 'Cabernet' })
    ])
    expect(searchProducts('Pils', { distributorNumber: 202 })).toEqual([
      expect.objectContaining({ sku: 'FILTER-BEER', name: 'Pilsner' })
    ])
  })

  it('getActiveSpecialPricing returns only unexpired rules', () => {
    const created = saveInventoryItem({
      ...base,
      sku: 'SPECIAL-001',
      item_name: 'Promo Bottle',
      special_pricing: [{ quantity: 2, price: 20, duration_days: 7 }]
    })

    getDb()
      .prepare(
        `
        INSERT INTO special_pricing (product_id, quantity, price, duration_days, created_at)
        VALUES (?, ?, ?, ?, datetime('now', '-10 days'))
        `
      )
      .run(created.item_number, 3, 27, 5)

    expect(getActiveSpecialPricing()).toEqual([
      { product_id: created.item_number, quantity: 2, price: 20 }
    ])
  })
})

describe('getInventoryItemTypes', () => {
  beforeEach(() => createTestDb())

  it('includes hydrated item types from onboarded products', () => {
    getDb()
      .prepare(
        `
      INSERT INTO products (sku, name, category, price, quantity, in_stock, tax_rate, item_type, dept_id)
      VALUES
        ('SKU-1', 'Imported Wine', 'Wine', 10, 5, 5, 0, 'Wine', ''),
        ('SKU-2', 'Imported Beer', 'Beer', 11, 6, 6, 0, 'Beer', NULL),
        ('SKU-3', 'Legacy Spirit', 'Spirits', 12, 7, 7, 0, '', 'Legacy Spirits')
      `
      )
      .run()

    expect(getInventoryItemTypes()).toEqual(['Beer', 'Legacy Spirits', 'Wine'])
  })
})

describe('NYSLA fields', () => {
  beforeEach(() => createTestDb())

  it('saves and returns item_type, size, case_cost, nysla_discounts', () => {
    getDb()
      .prepare(
        'INSERT INTO item_types (name, description, default_profit_margin, default_tax_rate) VALUES (?, ?, ?, ?)'
      )
      .run('Table Red and Rose Wine', null, 0, 0)

    const item = saveInventoryItem({
      ...base,
      item_type: 'Table Red and Rose Wine',
      size: '750ML',
      case_cost: 84.0,
      nysla_discounts: '[{"amount":8,"min_cases":3}]'
    })

    const detail = getInventoryProductDetail(item.item_number)
    expect(detail!.item_type).toBe('Table Red and Rose Wine')
    expect(detail!.size).toBe('750ML')
    expect(detail!.case_cost).toBe(84.0)
    expect(detail!.nysla_discounts).toBe('[{"amount":8,"min_cases":3}]')
  })

  it('returns null for optional NYSLA fields when not set', () => {
    const item = saveInventoryItem(base)
    const detail = getInventoryProductDetail(item.item_number)

    expect(detail!.item_type).toBeNull()
    expect(detail!.size).toBeNull()
    expect(detail!.case_cost).toBeNull()
    expect(detail!.nysla_discounts).toBeNull()
  })

  it('updates NYSLA fields on subsequent saves', () => {
    getDb()
      .prepare(
        'INSERT INTO item_types (name, description, default_profit_margin, default_tax_rate) VALUES (?, ?, ?, ?), (?, ?, ?, ?)'
      )
      .run('Sparkling Wine', null, 0, 0, 'Table White Wine', null, 0, 0)

    const created = saveInventoryItem({ ...base, item_type: 'Sparkling Wine', size: '750ML' })
    const updated = saveInventoryItem({
      ...base,
      item_number: created.item_number,
      item_type: 'Table White Wine',
      size: '1.5L',
      case_cost: 120.0
    })

    expect(updated.item_type).toBe('Table White Wine')
    expect(updated.size).toBe('1.5L')
    expect(updated.case_cost).toBe(120.0)
  })

  it('saves and retrieves NYSLA product metadata fields', () => {
    const item = saveInventoryItem({
      ...base,
      brand_name: 'Château Margaux',
      proof: 86,
      alcohol_pct: 13.5,
      vintage: '2015',
      ttb_id: 'TTB-12345-ABC'
    })

    const detail = getInventoryProductDetail(item.item_number)
    expect(detail!.brand_name).toBe('Château Margaux')
    expect(detail!.proof).toBe(86)
    expect(detail!.alcohol_pct).toBe(13.5)
    expect(detail!.vintage).toBe('2015')
    expect(detail!.ttb_id).toBe('TTB-12345-ABC')
  })

  it('returns null for optional metadata fields when not set', () => {
    const item = saveInventoryItem(base)
    const detail = getInventoryProductDetail(item.item_number)

    expect(detail!.brand_name).toBeNull()
    expect(detail!.proof).toBeNull()
    expect(detail!.alcohol_pct).toBeNull()
    expect(detail!.vintage).toBeNull()
    expect(detail!.ttb_id).toBeNull()
  })

  it('updates metadata fields on subsequent saves', () => {
    const created = saveInventoryItem({
      ...base,
      brand_name: 'Original Brand',
      proof: 80,
      alcohol_pct: 12.0,
      vintage: '2010',
      ttb_id: 'TTB-OLD'
    })

    const updated = saveInventoryItem({
      ...base,
      item_number: created.item_number,
      brand_name: 'Updated Brand',
      proof: 100,
      alcohol_pct: 15.5,
      vintage: '2020',
      ttb_id: 'TTB-NEW'
    })

    expect(updated.brand_name).toBe('Updated Brand')
    expect(updated.proof).toBe(100)
    expect(updated.alcohol_pct).toBe(15.5)
    expect(updated.vintage).toBe('2020')
    expect(updated.ttb_id).toBe('TTB-NEW')
  })
})

describe('normalizeSearch', () => {
  it('strips diacritics', () => {
    expect(normalizeSearch('Rosé')).toBe('rose')
    expect(normalizeSearch('Côtes du Rhône')).toBe('cotes du rhone')
    expect(normalizeSearch('Añejo')).toBe('anejo')
  })

  it('replaces hyphens and underscores with spaces', () => {
    expect(normalizeSearch('All-In Dry')).toBe('all in dry')
    expect(normalizeSearch('half_case')).toBe('half case')
  })

  it('lowercases', () => {
    expect(normalizeSearch('CABERNET')).toBe('cabernet')
  })

  it('handles null and empty', () => {
    expect(normalizeSearch(null)).toBe('')
    expect(normalizeSearch('')).toBe('')
  })
})

describe('normalized search queries', () => {
  beforeEach(() => createTestDb())

  it('searchInventoryProducts finds accented names with plain query', () => {
    saveInventoryItem({ ...base, sku: 'ROSE-001', item_name: 'All-In Dry Rosé' })

    const results = searchInventoryProducts('rose')
    expect(results).toEqual([expect.objectContaining({ sku: 'ROSE-001' })])

    const results2 = searchInventoryProducts('dry rose')
    expect(results2).toEqual([expect.objectContaining({ sku: 'ROSE-001' })])
  })

  it('searchInventoryProducts finds hyphenated names without hyphens', () => {
    saveInventoryItem({ ...base, sku: 'ROSE-002', item_name: 'All-In Dry Rosé' })

    const results = searchInventoryProducts('All In')
    expect(results).toEqual([expect.objectContaining({ sku: 'ROSE-002' })])
  })

  it('searchProducts finds accented names with plain query', () => {
    saveInventoryItem({ ...base, sku: 'ROSE-003', item_name: 'All-In Dry Rosé' })

    const results = searchProducts('rose')
    expect(results).toEqual([expect.objectContaining({ sku: 'ROSE-003' })])
  })

  it('searchInventoryProducts still matches by SKU exactly', () => {
    saveInventoryItem({ ...base, sku: 'SPEC-CHAR', item_name: 'Château Margaux' })

    const results = searchInventoryProducts('SPEC-CHAR')
    expect(results).toEqual([expect.objectContaining({ sku: 'SPEC-CHAR' })])
  })

  it('searchInventoryProducts matches by brand_name with normalization', () => {
    saveInventoryItem({
      ...base,
      sku: 'BRAND-001',
      item_name: 'Test',
      brand_name: 'Möet & Chandon'
    })

    const results = searchInventoryProducts('moet')
    expect(results).toEqual([expect.objectContaining({ sku: 'BRAND-001' })])
  })
})

describe('getLowStockProducts', () => {
  beforeEach(() => createTestDb())

  it('returns empty when no products exist', () => {
    expect(getLowStockProducts(10)).toEqual([])
  })

  it('filters products by threshold (in_stock <= threshold)', () => {
    getDb()
      .prepare('INSERT INTO distributors (distributor_number, distributor_name) VALUES (?, ?)')
      .run(1, 'Test Distributor')

    saveInventoryItem({
      ...base,
      sku: 'LOW-001',
      item_name: 'Low Stock Wine',
      in_stock: 5,
      distributor_number: 1
    })
    saveInventoryItem({
      ...base,
      sku: 'HIGH-001',
      item_name: 'High Stock Beer',
      item_type: '',
      in_stock: 50,
      distributor_number: 1
    })

    const results = getLowStockProducts(10)
    expect(results).toHaveLength(1)
    expect(results[0].sku).toBe('LOW-001')
    expect(results[0].in_stock).toBe(5)
  })

  it('includes zero stock items', () => {
    saveInventoryItem({
      ...base,
      sku: 'ZERO-001',
      item_name: 'Zero Stock Wine',
      in_stock: 0
    })

    const results = getLowStockProducts(5)
    expect(results).toHaveLength(1)
    expect(results[0].in_stock).toBe(0)
  })

  it('joins with distributors table for distributor_name', () => {
    getDb()
      .prepare('INSERT INTO distributors (distributor_number, distributor_name) VALUES (?, ?)')
      .run(99, 'Premium Wines Co')

    saveInventoryItem({
      ...base,
      sku: 'DIST-001',
      item_name: 'Distributed Wine',
      in_stock: 3,
      distributor_number: 99
    })

    const results = getLowStockProducts(10)
    expect(results).toHaveLength(1)
    expect(results[0].distributor_name).toBe('Premium Wines Co')
  })

  it('returns null distributor_name when not associated with a distributor', () => {
    saveInventoryItem({
      ...base,
      sku: 'NODIST-001',
      item_name: 'No Distributor Wine',
      in_stock: 3,
      distributor_number: null
    })

    const results = getLowStockProducts(10)
    expect(results).toHaveLength(1)
    expect(results[0].distributor_name).toBeNull()
  })

  it('includes reorder_point field and defaults to 0', () => {
    saveInventoryItem({
      ...base,
      sku: 'REORDER-001',
      item_name: 'Reorder Test',
      in_stock: 5
    })

    const results = getLowStockProducts(10)
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveProperty('reorder_point')
    expect(results[0].reorder_point).toBe(0)
  })

  it('excludes inactive products', () => {
    const item = saveInventoryItem({
      ...base,
      sku: 'INACTIVE-001',
      item_name: 'Will be deleted',
      in_stock: 2
    })
    deleteInventoryItem(item.item_number)

    const results = getLowStockProducts(10)
    expect(results).toHaveLength(0)
  })

  it('orders results by in_stock ascending', () => {
    saveInventoryItem({
      ...base,
      sku: 'ORDER-001',
      item_name: 'Middle Stock',
      in_stock: 5
    })
    saveInventoryItem({
      ...base,
      sku: 'ORDER-002',
      item_name: 'High Stock',
      in_stock: 10
    })
    saveInventoryItem({
      ...base,
      sku: 'ORDER-003',
      item_name: 'Zero Stock',
      in_stock: 0
    })

    const results = getLowStockProducts(15)
    expect(results).toHaveLength(3)
    expect(results[0].in_stock).toBe(0)
    expect(results[1].in_stock).toBe(5)
    expect(results[2].in_stock).toBe(10)
  })

  it('includes item_type field', () => {
    saveInventoryItem({
      ...base,
      sku: 'TYPE-001',
      item_name: 'Typed Wine',
      item_type: '',
      in_stock: 3
    })

    const results = getLowStockProducts(10)
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveProperty('item_type')
  })
})

describe('getProducts price filter', () => {
  beforeEach(() => createTestDb())

  it('excludes products with retail_price=0 and price=0', () => {
    saveInventoryItem({
      ...base,
      sku: 'PRICED-001',
      item_name: 'Priced Wine',
      retail_price: 15,
      in_stock: 5
    })
    saveInventoryItem({
      ...base,
      sku: 'UNPRICED-001',
      item_name: 'No Price Wine',
      retail_price: 0,
      in_stock: 3,
      cost: 0
    })

    const results = getProducts()
    expect(results.every((p) => p.price > 0)).toBe(true)
    expect(results.find((p) => p.sku === 'PRICED-001')).toBeDefined()
    expect(results.find((p) => p.sku === 'UNPRICED-001')).toBeUndefined()
  })

  it('includes products with retail_price=0 but cost > 0', () => {
    // Product has cost but retail_price=0. getProducts uses
    // GREATEST(COALESCE(retail_price,0), COALESCE(price,0)) which checks both.
    // A product with only cost set should still be excluded (price columns are what matter).
    saveInventoryItem({
      ...base,
      sku: 'COST-ONLY-001',
      item_name: 'Cost Only Wine',
      retail_price: 0,
      cost: 10,
      in_stock: 3
    })
    const results = getProducts()
    expect(results.find((p) => p.sku === 'COST-ONLY-001')).toBeUndefined()
  })
})

describe('getUnpricedInventoryProducts', () => {
  beforeEach(() => createTestDb())

  it('returns only active products with $0 price', () => {
    saveInventoryItem({
      ...base,
      sku: 'PRICED-001',
      item_name: 'Priced Wine',
      retail_price: 15,
      in_stock: 5
    })
    saveInventoryItem({
      ...base,
      sku: 'UNPRICED-001',
      item_name: 'No Price Wine',
      retail_price: 0,
      in_stock: 3,
      cost: 0
    })

    const results = getUnpricedInventoryProducts()
    expect(results).toHaveLength(1)
    expect(results[0].sku).toBe('UNPRICED-001')
    expect(results[0].retail_price).toBe(0)
  })

  it('returns empty when all products are priced', () => {
    saveInventoryItem({
      ...base,
      sku: 'PRICED-001',
      item_name: 'Priced Wine',
      retail_price: 12,
      in_stock: 5
    })
    expect(getUnpricedInventoryProducts()).toHaveLength(0)
  })

  it('excludes inactive (deleted) products', () => {
    const item = saveInventoryItem({
      ...base,
      sku: 'DELETED-001',
      item_name: 'Deleted Wine',
      retail_price: 0,
      in_stock: 3
    })
    deleteInventoryItem(item.item_number)
    expect(getUnpricedInventoryProducts()).toHaveLength(0)
  })
})

describe('findProductBySku', () => {
  beforeEach(() => createTestDb())

  it('finds product by primary sku regardless of price', () => {
    saveInventoryItem({
      ...base,
      sku: 'FIND-001',
      item_name: 'Find Me Wine',
      retail_price: 0,
      in_stock: 3
    })
    const result = findProductBySku('FIND-001')
    expect(result).not.toBeNull()
    expect(result?.sku).toBe('FIND-001')
  })

  it('is case-insensitive on SKU', () => {
    saveInventoryItem({
      ...base,
      sku: 'CASE-001',
      item_name: 'Case Test Wine',
      retail_price: 10,
      in_stock: 2
    })
    expect(findProductBySku('case-001')).not.toBeNull()
    expect(findProductBySku('CASE-001')).not.toBeNull()
  })

  it('returns null for completely unknown SKU', () => {
    expect(findProductBySku('GHOST-999')).toBeNull()
  })

  it('includes inactive products when searching by SKU (finds unpriced items regardless)', () => {
    saveInventoryItem({
      ...base,
      sku: 'UNPRICED-SKU',
      item_name: 'Unpriced Wine',
      retail_price: 0,
      in_stock: 3
    })
    // getProducts() would exclude this, but findProductBySku should find it
    expect(getProducts().find((p) => p.sku === 'UNPRICED-SKU')).toBeUndefined()
    expect(findProductBySku('UNPRICED-SKU')).not.toBeNull()
  })
})
