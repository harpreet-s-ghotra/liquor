/**
 * Internal types for cloud sync payloads.
 * These mirror the Supabase table structures and are NOT shared with the renderer.
 */

/** Payload shape for uploading a transaction to merchant_transactions */
export type CloudTransactionPayload = {
  merchant_id: string
  local_id: number
  transaction_number: string
  subtotal: number
  tax_amount: number
  total: number
  payment_method: string | null
  finix_authorization_id: string | null
  finix_transfer_id: string | null
  card_last_four: string | null
  card_type: string | null
  status: string
  notes: string | null
  original_transaction_number: string | null
  session_id: number | null
  device_id: string
  created_at: string
}

/** Payload shape for transaction items */
export type CloudTransactionItemPayload = {
  transaction_id: string
  product_sku: string
  product_name: string
  quantity: number
  unit_price: number
  cost_at_sale?: number | null
  cost_basis_source?: string | null
  total_price: number
}

/** The combined payload stored in sync_queue for a transaction */
export type TransactionSyncPayload = {
  transaction: {
    id: number
    transaction_number: string
    subtotal: number
    tax_amount: number
    total: number
    payment_method: string | null
    finix_authorization_id: string | null
    finix_transfer_id: string | null
    card_last_four: string | null
    card_type: string | null
    status: string
    notes: string | null
    original_transaction_number: string | null
    session_id: number | null
    created_at: string
  }
  items: Array<{
    product_sku: string
    product_name: string
    quantity: number
    unit_price: number
    cost_at_sale?: number | null
    cost_basis_source?: string | null
    total_price: number
  }>
  payments?: Array<{
    method: string
    amount: number
    card_last_four?: string | null
    card_type?: string | null
    finix_authorization_id?: string | null
    finix_transfer_id?: string | null
  }>
}

/** Payload shape for uploading a product to merchant_products */
export type CloudProductPayload = {
  merchant_id: string
  sku: string
  name: string
  description: string | null
  category: string
  price: number
  cost: number | null
  retail_price: number
  in_stock: number
  tax_1: number | null
  tax_2: number | null
  dept_id: string | null
  distributor_number: number | null
  bottles_per_case: number
  case_discount_price: number | null
  special_pricing_enabled: number
  special_price: number | null
  barcode: string | null
  is_active: number
  item_type: string | null
  size: string | null
  case_cost: number | null
  brand_name: string | null
  proof: number | null
  alcohol_pct: number | null
  vintage: string | null
  ttb_id: string | null
  device_id: string
  updated_at: string
}

export type ProductSyncPayload = {
  product: {
    id: number
    cloud_id: string | null
    sku: string
    name: string
    description: string | null
    category: string
    price: number
    cost: number | null
    retail_price: number
    in_stock: number
    tax_1: number | null
    tax_2: number | null
    dept_id: string | null
    distributor_number: number | null
    bottles_per_case: number
    case_discount_price: number | null
    special_pricing_enabled: number
    special_price: number | null
    barcode: string | null
    is_active: number
    item_type: string | null
    size: string | null
    case_cost: number | null
    brand_name: string | null
    proof: number | null
    alcohol_pct: number | null
    vintage: string | null
    ttb_id: string | null
    updated_at: string
  }
  alt_skus: string[]
  special_pricing: Array<{
    quantity: number
    price: number
  }>
}

/** Payload shape for uploading a local inventory delta to cloud inventory_deltas */
export type CloudInventoryDeltaPayload = {
  merchant_id: string
  product_sku: string
  delta: number
  reason: 'sale' | 'refund' | 'manual_adjustment' | 'receiving' | 'receiving_correction'
  reference_id: string | null
  device_id: string
  created_at: string
}

export type InventoryDeltaSyncPayload = {
  delta: {
    id: number
    product_id: number
    product_sku: string
    delta: number
    reason: 'sale' | 'refund' | 'manual_adjustment' | 'receiving' | 'receiving_correction'
    reference_id: string | null
    created_at: string
  }
}

// ── Phase 4: Entity sync payloads ──

/** Payload shape for uploading an item type to merchant_item_types */
export type CloudItemTypePayload = {
  merchant_id: string
  name: string
  description: string | null
  default_profit_margin: number
  default_tax_rate: number
  device_id: string
  updated_at: string
}

export type ItemTypeSyncPayload = {
  item_type: {
    id: number
    cloud_id?: string | null
    name: string
    description: string | null
    default_profit_margin: number
    default_tax_rate: number
    updated_at: string
  }
}

/** Payload shape for uploading a department to merchant_departments */
export type CloudDepartmentPayload = {
  merchant_id: string
  name: string
  tax_code_id: string | null
  is_deleted: boolean
  device_id: string
  updated_at: string
}

export type DepartmentSyncPayload = {
  department: {
    id: number
    cloud_id?: string | null
    name: string
    tax_code_id: string | null
    is_deleted: number
    updated_at: string
  }
}

/** Payload shape for uploading merchant business settings */
export type CloudMerchantSettingsPayload = {
  merchant_id: string
  store_name: string | null
  receipt_header: string | null
  receipt_footer: string | null
  theme: string | null
  extras_json: Record<string, unknown>
  device_id: string
  updated_at: string
}

export type MerchantSettingsSyncPayload = {
  settings: {
    merchant_id: string
    store_name: string | null
    receipt_header: string | null
    receipt_footer: string | null
    theme: string | null
    extras_json: Record<string, unknown>
    updated_at: string
  }
}

/** Payload shape for uploading a tax code to merchant_tax_codes */
export type CloudTaxCodePayload = {
  merchant_id: string
  code: string
  rate: number
  device_id: string
  updated_at: string
}

export type TaxCodeSyncPayload = {
  tax_code: {
    id: number
    cloud_id?: string | null
    code: string
    rate: number
    updated_at: string
  }
}

/** Payload shape for uploading a distributor to merchant_distributors */
export type CloudDistributorPayload = {
  merchant_id: string
  distributor_number: number
  distributor_name: string
  license_id: string | null
  serial_number: string | null
  premises_name: string | null
  premises_address: string | null
  is_active: number
  device_id: string
  updated_at: string
}

export type DistributorSyncPayload = {
  distributor: {
    distributor_number: number
    cloud_id?: string | null
    distributor_name: string
    license_id: string | null
    serial_number: string | null
    premises_name: string | null
    premises_address: string | null
    is_active: number
    updated_at: string
  }
}

/**
 * Payload for uploading a cashier to merchant_cashiers.
 * pin_hash is included here (main-process only) so the second register can
 * validate PINs without a round-trip.  It must never reach the renderer.
 */
export type CloudCashierPayload = {
  merchant_id: string
  name: string
  role: string
  pin_hash: string
  is_active: number
  device_id: string
  updated_at: string
}

export type CashierSyncPayload = {
  cashier: {
    id: number
    cloud_id?: string | null
    name: string
    role: string
    pin_hash: string
    is_active: number
    updated_at: string
  }
}
