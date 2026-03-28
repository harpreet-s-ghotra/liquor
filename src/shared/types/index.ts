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
  distributor_number: number | null
  distributor_name: string | null
  bottles_per_case: number
  case_discount_price: number | null
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

/** Extended sales history with payment details (used in inventory detail view) */
export type TransactionHistoryItem = InventorySalesHistory & {
  transaction_number: string
  payment_method: string | null
  stax_transaction_id: string | null
  card_last_four: string | null
  card_type: string | null
  status: string
}

/** Input for saving a completed transaction */
export type SaveTransactionInput = {
  subtotal: number
  tax_amount: number
  total: number
  payment_method: string
  stax_transaction_id?: string | null
  card_last_four?: string | null
  card_type?: string | null
  notes?: string | null
  items: Array<{
    product_id: number
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}

/** Input for saving a refund transaction */
export type SaveRefundInput = {
  original_transaction_id: number
  original_transaction_number: string
  subtotal: number
  tax_amount: number
  total: number
  payment_method: string
  stax_transaction_id?: string | null
  card_last_four?: string | null
  card_type?: string | null
  items: Array<{
    product_id: number
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
}

/** Receipt layout/style config stored in peripheral-config.json */
export type ReceiptConfig = {
  fontSize: number // 8–16pt, default 10
  paddingY: number // top + bottom margin in pts, default 4
  paddingX: number // left + right margin in pts, default 4
  storeName: string // receipt header name override ('' = use merchant name)
  footerMessage: string // default footer message ('' = no footer message)
  alwaysPrint: boolean // auto-print receipt after every completed payment
}

/** Input for printing a receipt on the Star receipt printer */
export type PrintReceiptInput = {
  transaction_number: string
  store_name: string
  cashier_name: string
  items: Array<{
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
  subtotal: number
  subtotal_before_discount?: number | null
  discount_amount?: number | null
  tax_amount: number
  total: number
  payment_method: string
  card_last_four?: string | null
  card_type?: string | null
  footer_message?: string | null
}

/** Saved transaction record returned from the database */
export type SavedTransaction = {
  id: number
  transaction_number: string
  subtotal: number
  tax_amount: number
  total: number
  payment_method: string
  stax_transaction_id: string | null
  card_last_four: string | null
  card_type: string | null
  status: string
  original_transaction_id: number | null
  created_at: string
}

/** A single line item within a saved transaction */
export type TransactionLineItem = {
  id: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

/** Full transaction with line items, used for transaction recall */
export type TransactionDetail = SavedTransaction & {
  items: TransactionLineItem[]
}

// ── Sales History Listing ──

/** Filters for the Sales History modal */
export type TransactionListFilter = {
  date_from?: string | null
  date_to?: string | null
  status?: 'completed' | 'refund' | null
  payment_method?: string | null
  search?: string | null
  limit?: number
  offset?: number
}

/** Summary row for the Sales History modal (no line items) */
export type TransactionSummary = SavedTransaction & {
  item_count: number
  notes: string | null
}

/** Paginated result from the transactions:list endpoint */
export type TransactionListResult = {
  transactions: TransactionSummary[]
  total_count: number
}

export type SpecialPricingRule = {
  quantity: number
  price: number
  duration_days: number
}

/** An active special pricing rule returned for POS cart evaluation */
export type ActiveSpecialPricingRule = {
  product_id: number
  quantity: number
  price: number
}

/** Promotion metadata attached to a cart line by the pricing engine */
export type PromoAnnotation = {
  promoType: 'special-pricing' | 'mix-match'
  promoLabel: string
  promoUnitPrice: number
  promoLineSavings: number
  originalUnitPrice: number
}

export type InventoryProductDetail = InventoryProduct & {
  tax_rates: number[]
  additional_skus: string[]
  sales_history: TransactionHistoryItem[]
  special_pricing: SpecialPricingRule[]
}

export type SaveInventoryItemInput = {
  item_number?: number
  sku: string
  item_name: string
  dept_id: string
  distributor_number: number | null
  cost: number
  retail_price: number
  in_stock: number
  tax_rates: number[]
  special_pricing: SpecialPricingRule[]
  additional_skus: string[]
  bottles_per_case: number
  case_discount_price: number | null
}

export type InventoryTaxCode = {
  code: string
  rate: number
}

export type Department = {
  id: number
  name: string
  description: string | null
  default_profit_margin: number
  default_tax_rate: number
}

export type TaxCode = {
  id: number
  code: string
  rate: number
}

export type Distributor = {
  distributor_number: number
  distributor_name: string
  license_id: string | null
  serial_number: string | null
  premises_name: string | null
  premises_address: string | null
  is_active: number
}

export type SalesRep = {
  sales_rep_id: number
  distributor_number: number
  rep_name: string
  phone: string | null
  email: string | null
  is_active: number
}

export type CreateDepartmentInput = {
  name: string
  description?: string | null
  default_profit_margin?: number
  default_tax_rate?: number
}
export type UpdateDepartmentInput = {
  id: number
  name: string
  description?: string | null
  default_profit_margin?: number
  default_tax_rate?: number
}
export type CreateTaxCodeInput = { code: string; rate: number }
export type UpdateTaxCodeInput = { id: number; code: string; rate: number }
export type CreateDistributorInput = {
  distributor_name: string
  license_id?: string
  serial_number?: string
  premises_name?: string
  premises_address?: string
}
export type UpdateDistributorInput = {
  distributor_number: number
  distributor_name: string
  license_id?: string
  serial_number?: string
  premises_name?: string
  premises_address?: string
}
export type CreateSalesRepInput = {
  distributor_number: number
  rep_name: string
  phone?: string
  email?: string
}
export type UpdateSalesRepInput = {
  sales_rep_id: number
  rep_name: string
  phone?: string
  email?: string
}

// ── Hold Transactions ──

/** A cart item serialised into a held transaction snapshot */
export type HeldCartItem = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  basePrice: number
  quantity: number
  tax_rate: number
  lineQuantity: number
  itemDiscountPercent: number
}

/** Input for saving the current cart as a held transaction */
export type SaveHeldTransactionInput = {
  cart: HeldCartItem[]
  transactionDiscountPercent: number
  subtotal: number
  total: number
}

/** A held transaction record returned from the database */
export type HeldTransaction = {
  id: number
  hold_number: number
  cart_snapshot: string
  transaction_discount_percent: number
  subtotal: number
  total: number
  item_count: number
  held_at: string
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

// ── Stax Terminal Payment Processing ──

/**
 * Input for a direct (keyed-entry) card charge via POST /charge.
 * Used when no physical terminal is present — Phase A testing path.
 */
export type DirectChargeInput = {
  /** Total amount in dollars (e.g. 22.59) — minimum 0.01 */
  total: number
  /** Cardholder name */
  person_name: string
  /** Card number (no spaces) */
  card_number: string
  /** 4-digit expiry MMYY e.g. "0427" */
  card_exp: string
  /** CVV / security code */
  card_cvv: string
  /** Card brand hint — null is accepted by Stax */
  card_type?: string
  /** Billing zip for AVS (optional but recommended) */
  address_zip?: string
  /** Optional metadata (tax, subtotal, lineItems, etc.) */
  meta?: Record<string, unknown>
}

/** A physical card reader / terminal device paired with the merchant */
export type TerminalRegister = {
  id: string
  nickname: string
  serial: string
  type: string
  model: string
  is_default: boolean
  register_num: number
}

/** Filters for the POS product search modal */
export type SearchProductFilters = {
  departmentId?: number
  distributorNumber?: number
}

/** Input for sending a charge to a physical card terminal */
export type TerminalChargeInput = {
  /** Total amount in dollars (e.g. 22.59) — minimum 0.01 */
  total: number
  /** Payment type: credit or debit */
  payment_type: 'credit' | 'debit'
  /** Optional metadata (tax, subtotal, lineItems, etc.) */
  meta?: Record<string, unknown>
}

/** Result from a terminal charge (after polling completes) */
export type TerminalChargeResult = {
  /** Stax transaction ID (UUID) */
  transaction_id: string
  /** Whether the charge was approved */
  success: boolean
  /** Last 4 digits of card */
  last_four: string
  /** Card brand (visa, mastercard, etc.) */
  card_type: string
  /** Amount charged in dollars */
  total: number
  /** Human-readable message from gateway */
  message: string
  /** Final terminal status */
  status: 'approved' | 'declined' | 'timeout' | 'error'
}
