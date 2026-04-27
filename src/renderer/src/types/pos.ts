// Re-export shared types (single source of truth)
export type {
  Product,
  ActiveSpecialPricingRule,
  PromoAnnotation,
  InventoryProduct,
  InventoryProductDetail,
  InventorySalesHistory,
  NyslaDiscount,
  SpecialPricingRule,
  SaveInventoryItemInput,
  InventoryTaxCode,
  ItemType,
  TaxCode,
  Distributor,
  SalesRep,
  CreateItemTypeInput,
  UpdateItemTypeInput,
  CreateTaxCodeInput,
  UpdateTaxCodeInput,
  CreateDistributorInput,
  UpdateDistributorInput,
  CreateSalesRepInput,
  UpdateSalesRepInput,
  CatalogDistributor,
  MerchantConfig,
  SaveMerchantConfigInput,
  Cashier,
  CashierRole,
  CreateCashierInput,
  UpdateCashierInput,
  FinixDevice,
  FinixCardInput,
  FinixTerminalChargeInput,
  FinixChargeResult,
  SaveTransactionInput,
  DistributorFilter,
  ReorderDistributorRow,
  ReorderProduct,
  ReorderQuery,
  SavedTransaction,
  TransactionDetail,
  TransactionLineItem,
  TransactionHistoryItem,
  Session,
  CreateSessionInput,
  CloseSessionInput,
  ClockOutReport,
  ItemTypeSalesRow,
  PaymentMethodSalesRow,
  SessionListResult,
  PrintClockOutReportInput
} from '../../../shared/types'

// ── Renderer-only types ──

import type { Product, PromoAnnotation } from '../../../shared/types'

export type CartItem = Product & {
  basePrice?: number
  kind?: 'product'
  itemDiscountPercent?: number
  lineQuantity: number
  promo?: PromoAnnotation
}

export type TransactionDiscountItem = {
  id: number
  kind: 'transaction-discount'
  name: string
  lineQuantity: 1
  price: number
  discountRate: number
}

export type CartLineItem = CartItem | TransactionDiscountItem

export type PaymentMethod = 'cash' | 'credit' | 'debit' | 'account'

export type PaymentEntry = {
  id: number
  method: PaymentMethod
  amount: number
  label: string
  card_last_four?: string | null
  card_type?: string | null
  finix_authorization_id?: string | null
  finix_transfer_id?: string | null
  /** Card-only: surcharge fee folded into amount. base = amount - surcharge_amount. */
  surcharge_amount?: number
  /** Account-only: name of the third-party delivery service the sale is billed to. */
  account_service_name?: string | null
}

export type PaymentStatus = 'idle' | 'collecting' | 'processing-card' | 'complete'

/** Summary of a completed payment, emitted by PaymentModal → POSScreen */
export type PaymentResult = {
  method: PaymentMethod
  /** All tender entries — populated for both single and split payments */
  payments?: PaymentEntry[]
  /** Finix Authorization ID (only for card payments) */
  finix_authorization_id?: string | null
  /** Finix Transfer ID created by capture (only for card payments) */
  finix_transfer_id?: string | null
  /** Last 4 digits of card (only for card payments) */
  card_last_four?: string | null
  /** Card brand: Visa, Mastercard, etc. */
  card_type?: string | null
  /** Account-only: delivery service name (UberEats, DoorDash, etc.). */
  account_service_name?: string | null
  /** True when the user explicitly clicked "Print Receipt" (false = OK only) */
  shouldPrint?: boolean
}
