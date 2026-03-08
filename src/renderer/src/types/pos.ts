// Re-export shared types (single source of truth)
export type {
  Product,
  InventoryProduct,
  InventoryProductDetail,
  InventorySalesHistory,
  SpecialPricingRule,
  SaveInventoryItemInput,
  InventoryTaxCode,
  Department,
  TaxCode,
  Vendor,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  CreateTaxCodeInput,
  UpdateTaxCodeInput,
  CreateVendorInput,
  UpdateVendorInput,
  MerchantConfig,
  SaveMerchantConfigInput,
  Cashier,
  CashierRole,
  CreateCashierInput,
  UpdateCashierInput,
  StaxMerchantInfo
} from '../../../shared/types'

// ── Renderer-only types ──

import type { Product } from '../../../shared/types'

export type CartItem = Product & {
  basePrice?: number
  kind?: 'product'
  itemDiscountPercent?: number
  lineQuantity: number
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
