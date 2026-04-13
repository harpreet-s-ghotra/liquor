import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Product,
  ActiveSpecialPricingRule,
  InventoryProduct,
  InventoryProductDetail,
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
  MerchantConfig,
  Cashier,
  CreateCashierInput,
  UpdateCashierInput,
  FinixCardInput,
  FinixTerminalChargeInput,
  FinixChargeResult,
  FinixDevice,
  FinixCreateDeviceInput,
  SaveTransactionInput,
  SavedTransaction,
  TransactionDetail,
  SaveRefundInput,
  SaveHeldTransactionInput,
  HeldTransaction,
  SearchProductFilters,
  TransactionListFilter,
  TransactionListResult,
  PrintReceiptInput,
  ReceiptConfig,
  ReceiptPrinterConfig,
  Session,
  CreateSessionInput,
  CloseSessionInput,
  ClockOutReport,
  SessionListResult,
  PrintClockOutReportInput,
  AuthResult,
  CatalogDistributor,
  ImportResult,
  SyncStatus,
  DeviceConfig,
  ReportDateRange,
  SalesSummaryReport,
  ProductSalesReport,
  CategorySalesReport,
  TaxReport,
  ComparisonReport,
  CashierSalesReport,
  HourlySalesReport,
  ReportExportRequest,
  BusinessInfoInput,
  ProvisionMerchantResult
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
  getInventoryItemTypes: () => Promise<string[]>
  getInventoryTaxCodes: () => Promise<InventoryTaxCode[]>
  getItemTypes: () => Promise<ItemType[]>
  createItemType: (input: CreateItemTypeInput) => Promise<ItemType>
  updateItemType: (input: UpdateItemTypeInput) => Promise<ItemType>
  deleteItemType: (id: number) => Promise<void>
  getDepartments: () => Promise<ItemType[]>
  createDepartment: (input: CreateItemTypeInput) => Promise<ItemType>
  updateDepartment: (input: UpdateItemTypeInput) => Promise<ItemType>
  deleteDepartment: (id: number) => Promise<void>
  getTaxCodes: () => Promise<TaxCode[]>
  createTaxCode: (input: CreateTaxCodeInput) => Promise<TaxCode>
  updateTaxCode: (input: UpdateTaxCodeInput) => Promise<TaxCode>
  deleteTaxCode: (id: number) => Promise<void>
  applyTaxToAll: (taxRate: number) => Promise<{ updated: number }>
  getDistributors: () => Promise<Distributor[]>
  createDistributor: (input: CreateDistributorInput) => Promise<Distributor>
  updateDistributor: (input: UpdateDistributorInput) => Promise<Distributor>
  deleteDistributor: (distributorNumber: number) => Promise<void>
  getSalesRepsByDistributor: (distributorNumber: number) => Promise<SalesRep[]>
  createSalesRep: (input: CreateSalesRepInput) => Promise<SalesRep>
  updateSalesRep: (input: UpdateSalesRepInput) => Promise<SalesRep>
  deleteSalesRep: (salesRepId: number) => Promise<void>

  // Supabase Auth
  authLogin: (email: string, password: string) => Promise<AuthResult>
  authLogout: () => Promise<void>
  authCheckSession: () => Promise<AuthResult | null>
  authSetSession: (accessToken: string, refreshToken: string) => Promise<{ email: string }>
  authSetPassword: (password: string) => Promise<AuthResult>
  onDeepLink: (
    callback: (payload: { accessToken: string; refreshToken: string; type: string | null }) => void
  ) => void
  consumePendingDeepLink: () => Promise<string | null>

  // Catalog
  getCatalogDistributors: () => Promise<CatalogDistributor[]>
  importCatalogItems: (distributorIds: number[]) => Promise<ImportResult>

  // Merchant Config
  getMerchantConfig: () => Promise<MerchantConfig | null>
  activateMerchant: (
    apiUsername: string,
    apiPassword: string,
    merchantId: string
  ) => Promise<MerchantConfig>
  deactivateMerchant: () => Promise<void>

  // Cashiers
  getCashiers: () => Promise<Cashier[]>
  createCashier: (input: CreateCashierInput) => Promise<Cashier>
  validatePin: (pin: string) => Promise<Cashier | null>
  updateCashier: (input: UpdateCashierInput) => Promise<Cashier>
  deleteCashier: (id: number) => Promise<void>

  // Finix Payments
  finixListDevices: () => Promise<FinixDevice[]>
  finixCreateDevice: (input: FinixCreateDeviceInput) => Promise<FinixDevice>
  finixChargeCard: (input: FinixCardInput) => Promise<FinixChargeResult>
  finixChargeTerminal: (input: FinixTerminalChargeInput) => Promise<FinixChargeResult>
  finixVoidAuthorization: (authorizationId: string) => Promise<void>
  finixRefundTransfer: (transferId: string, amountCents: number) => Promise<void>
  finixProvisionMerchant: (input: BusinessInfoInput) => Promise<ProvisionMerchantResult>

  // Transactions
  saveTransaction: (input: SaveTransactionInput) => Promise<SavedTransaction>
  getRecentTransactions: (limit?: number) => Promise<SavedTransaction[]>
  getTransactionByNumber: (txnNumber: string) => Promise<TransactionDetail | null>
  saveRefundTransaction: (input: SaveRefundInput) => Promise<SavedTransaction>
  listTransactions: (filter: TransactionListFilter) => Promise<TransactionListResult>

  // Held Transactions
  saveHeldTransaction: (input: SaveHeldTransactionInput) => Promise<HeldTransaction>
  getHeldTransactions: () => Promise<HeldTransaction[]>
  deleteHeldTransaction: (id: number) => Promise<void>
  clearAllHeldTransactions: () => Promise<void>

  // Cash Drawer
  getCashDrawerConfig: () => Promise<
    { type: 'usb'; printerName: string } | { type: 'tcp'; ip: string; port: number } | null
  >
  saveCashDrawerConfig: (
    config: { type: 'usb'; printerName: string } | { type: 'tcp'; ip: string; port: number }
  ) => Promise<void>
  openCashDrawer: () => Promise<void>
  printReceipt: (input: PrintReceiptInput) => Promise<void>
  getReceiptConfig: () => Promise<ReceiptConfig>
  saveReceiptConfig: (config: ReceiptConfig) => Promise<void>
  getReceiptPrinterConfig: () => Promise<ReceiptPrinterConfig | null>
  saveReceiptPrinterConfig: (config: ReceiptPrinterConfig) => Promise<void>
  listReceiptPrinters: () => Promise<string[]>
  getPrinterStatus: (
    printerName?: string
  ) => Promise<{ connected: boolean; printerName: string | null }>

  // Cloud Sync
  getSyncStatus: () => Promise<SyncStatus>
  getDeviceConfig: () => Promise<DeviceConfig | null>
  onConnectivityChanged: (callback: (online: boolean) => void) => void

  // Sessions
  getActiveSession: () => Promise<Session | null>
  createSession: (input: CreateSessionInput) => Promise<Session>
  closeSession: (input: CloseSessionInput) => Promise<Session>
  listSessions: (limit?: number, offset?: number) => Promise<SessionListResult>
  getSessionReport: (sessionId: number) => Promise<ClockOutReport>
  printClockOutReport: (input: PrintClockOutReportInput) => Promise<void>

  // Reports
  getReportSalesSummary: (range: ReportDateRange) => Promise<SalesSummaryReport>
  getReportProductSales: (
    range: ReportDateRange,
    sortBy?: 'revenue' | 'quantity',
    limit?: number
  ) => Promise<ProductSalesReport>
  getReportCategorySales: (range: ReportDateRange) => Promise<CategorySalesReport>
  getReportTaxSummary: (range: ReportDateRange) => Promise<TaxReport>
  getReportComparison: (
    rangeA: ReportDateRange,
    rangeB: ReportDateRange
  ) => Promise<ComparisonReport>
  getReportCashierSales: (range: ReportDateRange) => Promise<CashierSalesReport>
  getReportHourlySales: (range: ReportDateRange) => Promise<HourlySalesReport>
  exportReport: (request: ReportExportRequest) => Promise<string | null>

  // Auto-updater
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => void
  onUpdateNotAvailable: (callback: () => void) => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void
  onUpdateError: (callback: (err: { message: string }) => void) => void
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api?: AppApi
  }
}
