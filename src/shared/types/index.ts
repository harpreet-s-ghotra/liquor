// ── Shared types: single source of truth for main, preload, and renderer ──

export type Product = {
  id: number
  sku: string
  name: string
  display_name?: string | null
  size?: string | null
  distributor_name?: string | null
  category: string
  price: number
  quantity: number
  tax_rate: number
  bottles_per_case?: number | null
  case_discount_price?: number | null
  is_favorite?: number
  is_discontinued?: boolean
}

export type InventoryProduct = {
  item_number: number
  sku: string
  item_name: string
  item_type: string | null
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
  size: string | null
  case_cost: number | null
  nysla_discounts: string | null
  brand_name: string | null
  proof: number | null
  alcohol_pct: number | null
  vintage: string | null
  ttb_id: string | null
  display_name: string | null
  is_favorite?: number
  is_discontinued?: number
}

export type NyslaDiscount = {
  amount: number
  min_cases: number
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
  finix_authorization_id: string | null
  card_last_four: string | null
  card_type: string | null
  status: string
  cost_at_sale?: number | null
}

/** A single tender entry within a split (or single) payment */
export type TransactionPayment = {
  id?: number
  method: string
  amount: number
  card_last_four?: string | null
  card_type?: string | null
  finix_authorization_id?: string | null
  finix_transfer_id?: string | null
  /** Account-only: third-party delivery service name. */
  account_service_name?: string | null
}

/** Input for saving a completed transaction */
export type SaveTransactionInput = {
  subtotal: number
  tax_amount: number
  total: number
  /** Card processing surcharge folded into total. 0 when no surcharge applied. */
  surcharge_amount?: number
  payment_method: string
  finix_authorization_id?: string | null
  finix_transfer_id?: string | null
  card_last_four?: string | null
  card_type?: string | null
  /** Account-only: delivery service name (e.g. "UberEats"). */
  account_service_name?: string | null
  notes?: string | null
  session_id?: number | null
  /** All tender entries (required for split payments; single entry for single-method) */
  payments?: TransactionPayment[]
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
  /** Signed surcharge component refunded — negative when refunding card fees. */
  surcharge_amount?: number
  total: number
  payment_method: string
  finix_authorization_id?: string | null
  finix_transfer_id?: string | null
  card_last_four?: string | null
  card_type?: string | null
  session_id?: number | null
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

/** Selected CUPS printer used for receipts and USB drawer fallback. */
export type ReceiptPrinterConfig = {
  printerName: string
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
  /** Card processing surcharge component already included in `total`. */
  surcharge_amount?: number
  payment_method: string
  card_last_four?: string | null
  card_type?: string | null
  /** Account-only: delivery service name printed on receipt. */
  account_service_name?: string | null
  footer_message?: string | null
  /** All tender entries for split-payment receipt rendering */
  payments?: TransactionPayment[]
}

/** Saved transaction record returned from the database */
export type SavedTransaction = {
  id: number
  transaction_number: string
  subtotal: number
  tax_amount: number
  total: number
  surcharge_amount?: number
  payment_method: string
  finix_authorization_id: string | null
  finix_transfer_id: string | null
  card_last_four: string | null
  card_type: string | null
  /** Account-only: delivery service name. Null for non-account methods. */
  account_service_name?: string | null
  status: string
  original_transaction_id: number | null
  session_id?: number | null
  device_id?: string | null
  created_at: string
}

/** A single line item within a saved transaction */
export type TransactionLineItem = {
  id: number
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  cost_at_sale?: number | null
  cost_basis_source?: string | null
  total_price: number
}

/** Full transaction with line items, used for transaction recall */
export type TransactionDetail = SavedTransaction & {
  items: TransactionLineItem[]
  has_refund: boolean
  payments: TransactionPayment[]
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
  /** Optional ISO timestamp; rule is ignored once now() > expires_at. */
  expires_at?: string | null
}

/** An active special pricing rule returned for POS cart evaluation */
export type ActiveSpecialPricingRule = {
  product_id: number
  quantity: number
  price: number
  expires_at?: string | null
}

/** Promotion metadata attached to a cart line by the pricing engine */
export type PromoAnnotation = {
  promoType: 'special-pricing' | 'mix-match' | 'case-discount'
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
  distributor_number: number | null
  cost: number
  retail_price: number
  in_stock: number
  tax_rates: number[]
  special_pricing: SpecialPricingRule[]
  additional_skus: string[]
  bottles_per_case: number
  case_discount_price: number | null
  item_type: string
  size: string | null
  case_cost: number | null
  nysla_discounts: string | null
  brand_name: string
  proof: number | null
  alcohol_pct: number | null
  vintage: string
  ttb_id: string
  display_name: string
  is_favorite?: number
  is_discontinued: boolean
}

export type InventoryTaxCode = {
  code: string
  rate: number
}

export type ItemType = {
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
  is_default?: number
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

export type CreateItemTypeInput = {
  name: string
  description?: string | null
  default_profit_margin?: number
  default_tax_rate?: number
}
export type UpdateItemTypeInput = {
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
  /** Optional cashier-entered note shown on the lookup screen (e.g. customer name). */
  description?: string | null
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
  description?: string | null
}

// ── Supabase Auth & Catalog ──

export type AuthUser = {
  id: string
  email: string
}

export type AuthResult = {
  user: AuthUser
  merchant: MerchantConfig
}

export type CatalogDistributor = {
  distributor_id: number
  distributor_name: string
  distributor_permit_id: string | null
  county: string | null
  post_type: string | null
}

export type CatalogProduct = {
  id: number
  distributor_id: number
  nys_item: string | null
  ttb_id: string | null
  brand_name: string | null
  prod_name: string
  beverage_type: string | null
  bev_type_code: string | null
  item_type: string | null
  item_size: string | null
  unit_of_measure: string | null
  bottles_per_case: number | null
  proof: number | null
  alcohol_pct: number | null
  vintage: string | null
  bot_price: number | null
  case_price: number | null
  post_type: string | null
}

export type ImportResult = {
  imported: number
  distributors_created: number
}

// ── Merchant Activation & Cashier Login ──

export type MerchantConfig = {
  id: number
  merchant_account_id?: string
  finix_api_username: string
  finix_api_password: string
  merchant_id: string
  merchant_name: string
  store_name?: string | null
  receipt_header?: string | null
  receipt_footer?: string | null
  theme?: string | null
  settings_extras_json?: string
  activated_at: string
  updated_at: string
}

export type CardSurchargeConfig = {
  enabled: boolean
  /** Percent applied to credit/debit. Stored as a positive number, e.g. 3.5 = 3.5%. */
  percent: number
}

/**
 * Snapshot pushed from the cashier window to the customer-facing display window.
 * Mirrors only what the customer should see: cart contents, totals, and live
 * payment state (not raw card data or terminal IDs).
 */
export type CustomerDisplaySnapshot = {
  storeName?: string | null
  cart: Array<{
    id: number
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  tax: number
  total: number
  /** When >0, surcharge config is active and this percent applies on card payments. */
  cardSurchargePercent?: number
  /** Filled when payment modal is open or a method has been selected. */
  paymentMethod?: 'cash' | 'credit' | 'debit' | 'account' | null
  /** Account-only: delivery service name to display on the customer screen. */
  accountServiceName?: string | null
  /** When card method is in flight, this reflects the surcharged amount that will be charged. */
  cardChargeAmount?: number
  surchargeAmount?: number
  paymentStatus?: 'idle' | 'collecting' | 'processing-card' | 'complete'
  /** Set when the cashier is owed change after a cash overpayment. */
  changeDue?: number
}

export type SaveMerchantConfigInput = {
  merchant_account_id?: string
  finix_api_username: string
  finix_api_password: string
  merchant_id: string
  merchant_name: string
  store_name?: string | null
  receipt_header?: string | null
  receipt_footer?: string | null
  theme?: string | null
  settings_extras_json?: string
}

// ── Finix Merchant Provisioning ──

export type BusinessAddress = {
  line1: string
  line2?: string
  city: string
  region: string
  postal_code: string
  country: string
}

export type BusinessInfoInput = {
  business_name: string
  doing_business_as: string
  business_type:
    | 'INDIVIDUAL_SOLE_PROPRIETORSHIP'
    | 'PARTNERSHIP'
    | 'LIMITED_LIABILITY_COMPANY'
    | 'CORPORATION'
  business_phone: string
  business_address: BusinessAddress
  first_name: string
  last_name: string
  email: string
  phone: string
  dob: { year: number; month: number; day: number }
  tax_id: string
  business_tax_id: string
  // Required for LLC, CORPORATION, PARTNERSHIP
  url?: string
  principal_percentage_ownership?: number
  annual_card_volume?: number // in cents
  incorporation_date?: { year: number; month: number; day: number }
  // Bank account for payment processing
  bank_account: {
    account_number: string
    routing_number: string
    account_type:
      | 'PERSONAL_CHECKING'
      | 'PERSONAL_SAVINGS'
      | 'BUSINESS_CHECKING'
      | 'BUSINESS_SAVINGS'
    name: string
  }
}

export type ProvisionMerchantResult = {
  finix_merchant_id: string
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

// ── Finix Payment Processing ──

/** Filters for the POS product search modal */
export type SearchProductFilters = {
  departmentId?: number
  distributorNumber?: number | 'none'
  size?: string
  unpricedOnly?: boolean
}

/** Input for a manual card entry charge (Phase A — no hardware) */
export type FinixCardInput = {
  /** Total amount in dollars (e.g. 22.59) */
  total: number
  /** Cardholder name */
  person_name: string
  /** Card number (no spaces) */
  card_number: string
  /** 4-digit expiry MMYY e.g. "0427" */
  card_exp: string
  /** CVV / security code */
  card_cvv: string
  /** Billing zip for AVS (optional) */
  address_zip?: string
}

/** Input for a card-present terminal charge (Phase B — PAX A920PRO) */
export type FinixTerminalChargeInput = {
  /** Total amount in cents (e.g. 2259 = $22.59) */
  total: number
  /** Finix Device ID (DVxxxxxxxx) */
  device_id: string
}

/** A Finix card reader device registered under a merchant */
export type FinixDevice = {
  id: string
  name: string
  model: 'PAX_A800' | 'PAX_A920PRO' | 'D135'
  serial_number: string | null
  enabled: boolean
  merchant: string
}

/** Input for registering a new terminal device under a merchant */
export type FinixCreateDeviceInput = {
  name: string
  model: 'PAX_A800' | 'PAX_A920PRO' | 'D135'
  serial_number: string
}

/** Result from a Finix charge (auth + capture) */
export type FinixChargeResult = {
  /** Finix Authorization ID (AUxxxxxxxx) */
  authorization_id: string
  /** Finix Transfer ID after capture (TRxxxxxxxx) */
  transfer_id: string
  /** Whether the charge was approved */
  success: boolean
  /** Last 4 digits of card */
  last_four: string
  /** Card brand (Visa, Mastercard, etc.) */
  card_type: string
  /** Amount charged in dollars */
  total: number
  /** Human-readable status message */
  message: string
  /** Final charge status */
  status: 'approved' | 'declined' | 'error'
}

// ── Sessions (Clock In / Clock Out) ──

/** A register session record stored in the database */
export type Session = {
  id: number
  opened_by_cashier_id: number
  opened_by_cashier_name: string
  closed_by_cashier_id: number | null
  closed_by_cashier_name: string | null
  started_at: string
  ended_at: string | null
  status: 'active' | 'closed'
}

/** Input for creating a new session (on first login after clock-out or app launch) */
export type CreateSessionInput = {
  cashier_id: number
  cashier_name: string
}

/** Input for closing a session (clock out) */
export type CloseSessionInput = {
  session_id: number
  cashier_id: number
  cashier_name: string
}

/** Sales breakdown by item type for the End-of-Day report */
export type ItemTypeSalesRow = {
  item_type_name: string
  transaction_count: number
  total_amount: number
}

/** Sales breakdown by payment method */
export type PaymentMethodSalesRow = {
  payment_method: string
  transaction_count: number
  total_amount: number
}

/** Sales breakdown by card brand/network */
export type CardBrandSalesRow = {
  card_brand: string
  transaction_count: number
  total_amount: number
}

/** Full End-of-Day (clock-out) report data */
export type ClockOutReport = {
  session: Session
  sales_by_item_type: ItemTypeSalesRow[]
  sales_by_payment_method: PaymentMethodSalesRow[]
  total_sales_count: number
  gross_sales: number
  total_tax_collected: number
  net_sales: number
  total_refund_count: number
  total_refund_amount: number
  average_transaction_value: number
  expected_cash_at_close: number
  cash_total: number
  credit_total: number
  debit_total: number
  /** Sum of sales charged to a delivery-service account (Account method). */
  account_total: number
  /** Per-service breakdown for account-method sales. */
  account_breakdown: Array<{ service_name: string; total: number; count: number }>
}

/** Paginated list of sessions */
export type SessionListResult = {
  sessions: Session[]
  total_count: number
}

/** Input for printing the clock-out report */
export type PrintClockOutReportInput = {
  store_name: string
  cashier_name: string
  report: ClockOutReport
}

// ── Cloud Sync (Phase B) ──

/** Local device identity — singleton table, one row per POS register */
export type DeviceConfig = {
  id: number
  device_id: string
  device_name: string
  device_fingerprint: string
  registered_at: string
}

export type SaveDeviceConfigInput = {
  device_id: string
  device_name: string
  device_fingerprint: string
}

/** Entity types that can be synced to the cloud */
export type SyncEntityType =
  | 'transaction'
  | 'product'
  | 'item_type'
  | 'department'
  | 'settings'
  | 'tax_code'
  | 'cashier'
  | 'distributor'
  | 'inventory_delta'

/** A queued sync operation waiting to be uploaded */
export type SyncQueueItem = {
  id: number
  entity_type: SyncEntityType
  entity_id: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: string
  device_id: string
  created_at: string
  attempts: number
  last_error: string | null
  status: 'pending' | 'in_flight' | 'failed' | 'done'
}

export type SyncQueueInsert = {
  entity_type: SyncEntityType
  entity_id: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: string
  device_id: string
}

/** Sync status exposed to the renderer for the status indicator */
export type SyncStatus = {
  online: boolean
  pending_count: number
  last_synced_at: string | null
}

export type InitialSyncEntity =
  | 'settings'
  | 'tax_codes'
  | 'distributors'
  | 'item_types'
  | 'departments'
  | 'cashiers'
  | 'products'

export type InitialSyncEntityProgress = {
  processed: number
  total: number
}

export type InitialSyncProgressEvent = {
  entity: InitialSyncEntity
  processed: number
  total: number
}

export type InitialSyncStatus = {
  state: 'idle' | 'running' | 'done' | 'failed'
  currentEntity: InitialSyncEntity | null
  progress: Partial<Record<InitialSyncEntity, InitialSyncEntityProgress>>
  completed: InitialSyncEntity[]
  errors: Array<{ entity: string; message: string }>
}

/** Status of the transaction backfill worker. */
export type TransactionBackfillStatus = {
  state: 'idle' | 'running' | 'done' | 'failed'
  days: number
  applied: number
  skipped: number
  errors: number
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
}

/** Local SQLite transaction-history coverage. */
export type LocalTransactionHistoryStats = {
  count: number
  earliest: string | null
  latest: string | null
}

/** Queue statistics for monitoring */
export type SyncQueueStats = {
  pending: number
  in_flight: number
  failed: number
}

export type TelemetryEventType = 'error' | 'performance' | 'behavior' | 'system'

export type TelemetryEventInput = {
  type: TelemetryEventType
  name: string
  payload?: Record<string, unknown>
  sampleRate?: number
}

// ── Sales Reports ──

/** Date range filter for all report queries */
export type ReportDateRange = {
  from: string
  to: string
  preset?: string
  /** When set, scope results to this device only (register-scoped reports) */
  deviceId?: string
}

/** A single day's sales aggregate */
export type DailySalesRow = {
  date: string
  transaction_count: number
  gross_sales: number
  tax_collected: number
  net_sales: number
}

/** Full sales summary report data */
export type SalesSummaryReport = {
  gross_sales: number
  tax_collected: number
  net_sales: number
  refund_count: number
  refund_amount: number
  transaction_count: number
  avg_transaction: number
  sales_by_payment: PaymentMethodSalesRow[]
  sales_by_card_brand: CardBrandSalesRow[]
  sales_by_day: DailySalesRow[]
}

/** A single product's sales data in the product report */
export type ProductSalesRow = {
  product_id: number
  product_name: string
  item_type: string | null
  distributor_name: string | null
  sku: string
  quantity_sold: number
  revenue: number
  cost_total: number
  profit: number
  margin_pct: number
}

/** Product sales report */
export type ProductSalesReport = {
  items: ProductSalesRow[]
}

/** A single category's sales aggregate */
export type CategorySalesRow = {
  item_type: string
  transaction_count: number
  quantity_sold: number
  revenue: number
  profit: number
  profit_margin_pct: number
}

/** Category sales report */
export type CategorySalesReport = {
  categories: CategorySalesRow[]
}

/** A single tax code's aggregate */
export type TaxReportRow = {
  tax_code_name: string
  tax_rate: number
  taxable_sales: number
  tax_collected: number
}

/** Tax summary report */
export type TaxReport = {
  tax_rows: TaxReportRow[]
}

/** Comparison report: two periods side-by-side */
export type ComparisonDelta = {
  field: string
  period_a_value: number
  period_b_value: number
  diff: number
  change_pct: number
}

export type ComparisonReport = {
  period_a: SalesSummaryReport
  period_b: SalesSummaryReport
  deltas: ComparisonDelta[]
}

/** Cashier performance row */
export type CashierSalesRow = {
  cashier_id: number
  cashier_name: string
  transaction_count: number
  gross_sales: number
  avg_transaction: number
}

/** Cashier sales report */
export type CashierSalesReport = {
  cashiers: CashierSalesRow[]
}

/** Hourly sales aggregate */
export type HourlySalesRow = {
  hour: number
  transaction_count: number
  gross_sales: number
}

/** Hourly sales report */
export type HourlySalesReport = {
  hours: HourlySalesRow[]
}

/** A single transaction row for all-transactions export */
export type TransactionListRow = {
  transaction_number: string
  created_at: string
  cashier_name: string
  register_name: string
  status: string
}

/** Transaction list report */
export type TransactionListReport = {
  transactions: TransactionListRow[]
}

/** Export request from the renderer */
export type ReportExportRequest = {
  report_type:
    | 'sales-summary'
    | 'product-sales'
    | 'category-sales'
    | 'tax-summary'
    | 'comparison'
    | 'transaction-list'
  date_range: ReportDateRange
  format: 'pdf' | 'csv'
  metadata?: {
    store_name?: string | null
    merchant_name?: string | null
    merchant_id?: string | null
  }
}

// ── Manager Modal ──

/** A cloud register (Supabase `registers` table) */
export type Register = {
  id: string
  device_name: string
  device_fingerprint: string
  last_seen_at: string
  created_at: string
  is_current: boolean
}

/** A product row in the low-stock / reorder dashboard */
export type LowStockProduct = {
  id: number
  sku: string
  name: string
  item_type: string | null
  in_stock: number
  reorder_point: number
  distributor_name: string | null
}

export type DistributorFilter = number | 'unassigned'

export type ReorderQuery = {
  distributor: DistributorFilter
  unit_threshold: number
  window_days: number
}

export type ReorderProduct = {
  id: number
  sku: string
  name: string
  item_type: string | null
  in_stock: number
  reorder_point: number
  distributor_number: number | null
  distributor_name: string | null
  cost: number
  bottles_per_case: number
  price: number
  velocity_per_day: number
  days_of_supply: number | null
  projected_stock: number
}

export type ReorderProductsResult = {
  rows: ReorderProduct[]
  velocityOffline: boolean
}

export type ReorderDistributorRow = {
  distributor_number: number | null
  distributor_name: string | null
  product_count: number
}

export type SkuExistenceResult = {
  exists: boolean
  source: 'local' | 'cloud'
}

/** Finix merchant status (read-only) */
export type MerchantStatus = {
  merchant_id: string
  merchant_name: string
  processing_enabled: boolean
}

// ── Purchase Orders ──

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'received' | 'cancelled'

/** A purchase order master record */
export type PurchaseOrder = {
  id: number
  po_number: string
  distributor_number: number
  distributor_name: string
  status: PurchaseOrderStatus
  notes: string | null
  subtotal: number
  total: number
  item_count: number
  received_at: string | null
  created_at: string
  updated_at: string
}

/** A single line item in a purchase order */
export type PurchaseOrderItem = {
  id: number
  po_id: number
  product_id: number
  sku: string
  product_name: string
  unit_cost: number
  bottles_per_case: number
  quantity_ordered: number
  quantity_received: number
  line_total: number
}

/** Full purchase order with line items */
export type PurchaseOrderDetail = PurchaseOrder & {
  items: PurchaseOrderItem[]
}

/** Input for creating a new purchase order */
export type CreatePurchaseOrderInput = {
  distributor_number: number
  items: Array<{
    product_id: number
    quantity_ordered: number
    unit_cost?: number
  }>
  notes?: string
}

/** Input for updating a purchase order */
export type UpdatePurchaseOrderInput = {
  id: number
  status?: PurchaseOrderStatus
  notes?: string
}

export type UpdatePurchaseOrderItemsInput = {
  po_id: number
  lines: Array<{
    id: number
    unit_cost?: number
    quantity_ordered?: number
    quantity_received?: number
  }>
}

export type MarkPurchaseOrderReceivedInput = {
  id: number
}

/** Input for receiving items on a purchase order line */
export type ReceivePurchaseOrderItemInput = {
  id: number
  quantity_received: number
}
