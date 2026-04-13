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

export type PaymentMethod = 'cash' | 'credit' | 'debit'

export type PaymentEntry = {
  id: number
  method: PaymentMethod
  amount: number
  label: string
}

export type PaymentStatus = 'idle' | 'collecting' | 'processing-card' | 'complete'

/** Summary of a completed payment, emitted by PaymentModal → POSScreen */
export type PaymentResult = {
  method: PaymentMethod
  /** Finix Authorization ID (only for card payments) */
  finix_authorization_id?: string | null
  /** Finix Transfer ID created by capture (only for card payments) */
  finix_transfer_id?: string | null
  /** Last 4 digits of card (only for card payments) */
  card_last_four?: string | null
  /** Card brand: Visa, Mastercard, etc. */
  card_type?: string | null
  /** True when the user explicitly clicked "Print Receipt" (false = OK only) */
  shouldPrint?: boolean
}
