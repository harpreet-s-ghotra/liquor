// ── Shared types: single source of truth for main, preload, and renderer ──

export type Product = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  quantity: number
  tax_rate: number
}

export type InventoryProduct = {
  item_number: number
  sku: string
  item_name: string
  dept_id: string | null
  category_id: number | null
  category_name: string | null
  cost: number
  retail_price: number
  in_stock: number
  tax_1: number
  tax_2: number
  vendor_number: number | null
  vendor_name: string | null
  bottles_per_case: number
  barcode: string | null
  description: string | null
  special_pricing_enabled: number
  special_price: number | null
  is_active: number
}

export type InventorySalesHistory = {
  transaction_id: number
  created_at: string
  quantity: number
  unit_price: number
  total_price: number
}

export type SpecialPricingRule = {
  quantity: number
  price: number
  duration_days: number
}

export type InventoryProductDetail = InventoryProduct & {
  tax_rates: number[]
  additional_skus: string[]
  sales_history: InventorySalesHistory[]
  special_pricing: SpecialPricingRule[]
}

export type SaveInventoryItemInput = {
  item_number?: number
  sku: string
  item_name: string
  dept_id: string
  vendor_number: number | null
  cost: number
  retail_price: number
  in_stock: number
  tax_rates: number[]
  special_pricing: SpecialPricingRule[]
  additional_skus: string[]
}

export type InventoryTaxCode = {
  code: string
  rate: number
}

export type Department = {
  id: number
  name: string
}

export type TaxCode = {
  id: number
  code: string
  rate: number
}

export type Vendor = {
  vendor_number: number
  vendor_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  is_active: number
}

export type CreateDepartmentInput = { name: string }
export type UpdateDepartmentInput = { id: number; name: string }
export type CreateTaxCodeInput = { code: string; rate: number }
export type UpdateTaxCodeInput = { id: number; code: string; rate: number }
export type CreateVendorInput = {
  vendor_name: string
  contact_name?: string
  phone?: string
  email?: string
}
export type UpdateVendorInput = {
  vendor_number: number
  vendor_name: string
  contact_name?: string
  phone?: string
  email?: string
}

// ── Merchant Activation & Cashier Login ──

export type MerchantConfig = {
  id: number
  stax_api_key: string
  merchant_id: string
  merchant_name: string
  activated_at: string
  updated_at: string
}

export type SaveMerchantConfigInput = {
  stax_api_key: string
  merchant_id: string
  merchant_name: string
}

export type CashierRole = 'admin' | 'cashier'

export type Cashier = {
  id: number
  name: string
  role: CashierRole
  is_active: number
  created_at: string
}

export type CreateCashierInput = {
  name: string
  pin: string
  role?: CashierRole
}

export type UpdateCashierInput = {
  id: number
  name?: string
  pin?: string
  role?: CashierRole
  is_active?: number
}

export type StaxMerchantInfo = {
  merchant_id: string
  company_name: string
  status: string
}
