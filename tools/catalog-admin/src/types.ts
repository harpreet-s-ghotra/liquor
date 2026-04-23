// Shared TypeScript types for the catalog admin tool.

export type Merchant = {
  id: string // UUID
  merchant_name: string
}

/** catalog_products row including curated overlay columns */
export type CatalogProductFull = {
  id: number
  ttb_id: string | null
  distributor_id: number | null
  nys_item: string | null
  prod_name: string
  brand_name: string | null
  item_size: string | null
  bot_price: number | null
  curated_sku: string | null
  curated_barcode: string | null
  curated_size: string | null
  curated_cost: number | null
  curated_updated_at: string | null
  curated_updated_by: string | null
  curation_source_merchant_id: string | null
}

/** merchant_products columns relevant for diffing */
export type MerchantProductRow = {
  id: string // UUID
  merchant_id: string
  sku: string
  name: string
  barcode: string | null
  size: string | null
  cost: number | null
  ttb_id: string | null
  distributor_number: number | null
  canonical_distributor_id?: number | null
}

export type CuratedField = 'sku' | 'barcode' | 'size' | 'cost'

export type DiffStatus =
  | 'match'
  | 'differs'
  | 'merchant_has_value_catalog_missing'
  | 'no_catalog_match'

export type DiffRow = {
  /** Unique React key */
  key: string
  merchant_product_id: string
  catalog_product_id: number | null
  product_name: string
  field: CuratedField
  /** Original NYSLA/catalog value (never changes) */
  original_catalog_value: string | null
  /** Current curated override (null if never curated) */
  curated_value: string | null
  /** effective = curated_value ?? original_catalog_value */
  effective_catalog_value: string | null
  /** Merchant's current value */
  merchant_value: string | null
  status: DiffStatus
}

export type FilterMode = 'all' | 'sku' | 'barcode' | 'size' | 'cost' | 'no_match'
