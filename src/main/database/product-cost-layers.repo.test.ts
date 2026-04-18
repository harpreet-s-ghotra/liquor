import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from './connection'
import {
  consumeCostLayersForSale,
  createCostLayer,
  listOpenCostLayers
} from './product-cost-layers.repo'
import { saveInventoryItem } from './products.repo'
import { applySchema } from './schema'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

function createProduct(cost = 10, inStock = 0): number {
  const product = saveInventoryItem({
    sku: `LAYER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    item_name: 'Layer Test Product',
    item_type: '',
    distributor_number: null,
    cost,
    retail_price: 20,
    in_stock: inStock,
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
  })

  return product.item_number
}

describe('product-cost-layers.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  it('creates and lists open layers in received_at order', () => {
    const productId = createProduct(10, 0)

    createCostLayer({
      productId,
      quantity: 2,
      costPerUnit: 9,
      source: 'receiving',
      receivedAt: '2024-01-01T00:00:00Z'
    })
    createCostLayer({
      productId,
      quantity: 3,
      costPerUnit: 11,
      source: 'receiving',
      receivedAt: '2024-02-01T00:00:00Z'
    })

    const layers = listOpenCostLayers(productId)
    expect(layers).toHaveLength(2)
    expect(layers[0].cost_per_unit).toBe(9)
    expect(layers[1].cost_per_unit).toBe(11)
  })

  it('consumes FIFO layers and uses fallback for uncovered quantity', () => {
    const productId = createProduct(7, 0)

    createCostLayer({
      productId,
      quantity: 2,
      costPerUnit: 5,
      source: 'receiving',
      receivedAt: '2024-01-01T00:00:00Z'
    })
    createCostLayer({
      productId,
      quantity: 1,
      costPerUnit: 8,
      source: 'receiving',
      receivedAt: '2024-01-02T00:00:00Z'
    })

    const consumed = consumeCostLayersForSale({
      productId,
      quantity: 5,
      fallbackUnitCost: 7
    })

    // 2*5 + 1*8 + 2*7
    expect(consumed.totalCost).toBe(32)

    const remaining = listOpenCostLayers(productId)
    expect(remaining).toHaveLength(0)
  })
})
