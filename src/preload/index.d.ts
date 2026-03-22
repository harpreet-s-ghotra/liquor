import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Product,
  ActiveSpecialPricingRule,
  InventoryProduct,
  InventoryProductDetail,
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
  Cashier,
  CreateCashierInput,
  UpdateCashierInput,
  TerminalChargeInput,
  TerminalChargeResult,
  TerminalRegister,
  SaveTransactionInput,
  SavedTransaction,
  TransactionDetail,
  SaveHeldTransactionInput,
  HeldTransaction,
  SearchProductFilters
} from '../shared/types'

type AppApi = {
  getProducts: () => Promise<Product[]>
  searchProducts: (query: string, filters?: SearchProductFilters) => Promise<Product[]>
  getActiveSpecialPricing: () => Promise<ActiveSpecialPricingRule[]>
  getInventoryProducts: () => Promise<InventoryProduct[]>
  searchInventoryProducts: (query: string) => Promise<InventoryProduct[]>
  getInventoryProductDetail: (itemNumber: number) => Promise<InventoryProductDetail | null>
  saveInventoryItem: (payload: SaveInventoryItemInput) => Promise<InventoryProductDetail>
  deleteInventoryItem: (itemNumber: number) => Promise<void>
  getInventoryDepartments: () => Promise<string[]>
  getInventoryTaxCodes: () => Promise<InventoryTaxCode[]>
  getDepartments: () => Promise<Department[]>
  createDepartment: (input: CreateDepartmentInput) => Promise<Department>
  updateDepartment: (input: UpdateDepartmentInput) => Promise<Department>
  deleteDepartment: (id: number) => Promise<void>
  getTaxCodes: () => Promise<TaxCode[]>
  createTaxCode: (input: CreateTaxCodeInput) => Promise<TaxCode>
  updateTaxCode: (input: UpdateTaxCodeInput) => Promise<TaxCode>
  deleteTaxCode: (id: number) => Promise<void>
  getVendors: () => Promise<Vendor[]>
  createVendor: (input: CreateVendorInput) => Promise<Vendor>
  updateVendor: (input: UpdateVendorInput) => Promise<Vendor>
  deleteVendor: (vendorNumber: number) => Promise<void>

  // Merchant Config
  getMerchantConfig: () => Promise<MerchantConfig | null>
  activateMerchant: (apiKey: string) => Promise<MerchantConfig>
  deactivateMerchant: () => Promise<void>

  // Cashiers
  getCashiers: () => Promise<Cashier[]>
  createCashier: (input: CreateCashierInput) => Promise<Cashier>
  validatePin: (pin: string) => Promise<Cashier | null>
  updateCashier: (input: UpdateCashierInput) => Promise<Cashier>
  deleteCashier: (id: number) => Promise<void>

  // Stax Terminal Payments
  getTerminalRegisters: () => Promise<TerminalRegister[]>
  chargeTerminal: (input: TerminalChargeInput) => Promise<TerminalChargeResult>

  // Transactions
  saveTransaction: (input: SaveTransactionInput) => Promise<SavedTransaction>
  getRecentTransactions: (limit?: number) => Promise<SavedTransaction[]>
  getTransactionByNumber: (txnNumber: string) => Promise<TransactionDetail | null>

  // Held Transactions
  saveHeldTransaction: (input: SaveHeldTransactionInput) => Promise<HeldTransaction>
  getHeldTransactions: () => Promise<HeldTransaction[]>
  deleteHeldTransaction: (id: number) => Promise<void>
  clearAllHeldTransactions: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api?: AppApi
  }
}
