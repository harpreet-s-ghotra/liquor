import { describe, expect, it } from 'vitest'
import { buildCatalogMap, computeDiffRows } from './diff'
import type { CatalogProductFull, MerchantProductRow } from '../types'

function catalogProduct(overrides: Partial<CatalogProductFull>): CatalogProductFull {
  return {
    id: 1,
    ttb_id: 'abc123',
    distributor_id: 100,
    nys_item: null,
    prod_name: 'Test Product',
    brand_name: 'Test Brand',
    item_size: '750',
    bot_price: 12,
    curated_sku: null,
    curated_barcode: null,
    curated_size: null,
    curated_cost: null,
    curated_updated_at: null,
    curated_updated_by: null,
    curation_source_merchant_id: null,
    ...overrides,
  }
}

function merchantProduct(overrides: Partial<MerchantProductRow>): MerchantProductRow {
  return {
    id: 'merchant-1',
    merchant_id: 'merchant-a',
    sku: 'SKU-1',
    name: 'Test Product',
    barcode: null,
    size: '750ML',
    cost: 12,
    ttb_id: 'abc123',
    distributor_number: 9,
    canonical_distributor_id: 100,
    ...overrides,
  }
}

describe('catalog-admin diff matching', () => {
  it('matches multi-row catalog products by normalized size and canonical distributor id', () => {
    const catalog = buildCatalogMap([
      catalogProduct({ id: 1, distributor_id: 100, item_size: '375', curated_size: '375' }),
      catalogProduct({ id: 2, distributor_id: 100, item_size: '750' }),
      catalogProduct({ id: 3, distributor_id: 200, item_size: '750', curated_cost: 19 }),
    ])

    const rows = computeDiffRows(
      [merchantProduct({ size: '750ML', cost: 12 })],
      catalog,
    )

    // Picks catalog id=2 (distributor 100, size 750). Cost 12 matches bot_price 12.
    // Only sku surfaces as an enrichment row (no native sku baseline).
    expect(rows).toHaveLength(1)
    expect(rows[0]?.catalog_product_id).toBe(2)
    expect(rows[0]?.field).toBe('sku')
    expect(rows[0]?.status).toBe('merchant_has_value_catalog_missing')
  })

  it('flags merchant cost edits against bot_price baseline', () => {
    const catalog = buildCatalogMap([catalogProduct({ id: 1, bot_price: 14, curated_cost: null })])

    const rows = computeDiffRows(
      [
        merchantProduct({
          sku: 'abc123',
          ttb_id: 'abc123',
          cost: 20,
        }),
      ],
      catalog,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.field).toBe('cost')
    expect(rows[0]?.status).toBe('differs')
    expect(rows[0]?.effective_catalog_value).toBe('14')
    expect(rows[0]?.merchant_value).toBe('20')
  })

  it('suppresses cost rows when merchant cost matches bot_price', () => {
    const catalog = buildCatalogMap([catalogProduct({ id: 1, bot_price: 12, curated_cost: null })])

    const rows = computeDiffRows(
      [merchantProduct({ sku: 'abc123', ttb_id: 'abc123', cost: 12 })],
      catalog,
    )

    expect(rows.filter((r) => r.field === 'cost')).toEqual([])
  })

  it('treats merchant cost as match when any catalog row with same ttb_id matches bot_price', () => {
    // NYSLA price history: three rows with different bot_price values for the same ttb_id.
    const catalog = buildCatalogMap([
      catalogProduct({ id: 1, bot_price: 16 }),
      catalogProduct({ id: 2, bot_price: 16.67 }),
      catalogProduct({ id: 3, bot_price: 17 }),
    ])

    const rows = computeDiffRows(
      [merchantProduct({ sku: 'abc123', ttb_id: 'abc123', cost: 16.67 })],
      catalog,
    )

    expect(rows.filter((r) => r.field === 'cost')).toEqual([])
  })

  it('flags merchant cost when no catalog candidate matches any bot_price', () => {
    const catalog = buildCatalogMap([
      catalogProduct({ id: 1, bot_price: 16 }),
      catalogProduct({ id: 2, bot_price: 17 }),
    ])

    const rows = computeDiffRows(
      [merchantProduct({ sku: 'abc123', ttb_id: 'abc123', cost: 99 })],
      catalog,
    )

    const costRows = rows.filter((r) => r.field === 'cost')
    expect(costRows).toHaveLength(1)
    expect(costRows[0]?.status).toBe('differs')
  })

  it('shows a no-match row when no catalog ttb_id exists after normalization', () => {
    const catalog = buildCatalogMap([])

    const rows = computeDiffRows(
      [merchantProduct({ ttb_id: ' 999999 ' })],
      catalog,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('no_catalog_match')
    expect(rows[0]?.merchant_value).toBe(' 999999 ')
  })
})