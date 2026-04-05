import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
  DirectChargeInput,
  TerminalChargeInput,
  TerminalChargeResult,
  TerminalRegister,
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
  DeviceConfig
} from '../shared/types'

// Custom APIs for renderer
const api = {
  getProducts: (): Promise<Product[]> => ipcRenderer.invoke('products:list'),
  searchProducts: (query: string, filters?: SearchProductFilters): Promise<Product[]> =>
    ipcRenderer.invoke('products:search', query, filters),
  getActiveSpecialPricing: (): Promise<ActiveSpecialPricingRule[]> =>
    ipcRenderer.invoke('products:active-special-pricing'),
  getInventoryProducts: (): Promise<InventoryProduct[]> =>
    ipcRenderer.invoke('inventory:products:list'),
  searchInventoryProducts: (query: string): Promise<InventoryProduct[]> =>
    ipcRenderer.invoke('inventory:products:search', query),
  getInventoryProductDetail: (itemNumber: number): Promise<InventoryProductDetail | null> =>
    ipcRenderer.invoke('inventory:products:detail', itemNumber),
  saveInventoryItem: (payload: SaveInventoryItemInput): Promise<InventoryProductDetail> =>
    ipcRenderer.invoke('inventory:products:save', payload),
  deleteInventoryItem: (itemNumber: number): Promise<void> =>
    ipcRenderer.invoke('inventory:products:delete', itemNumber),
  getInventoryDepartments: (): Promise<string[]> =>
    ipcRenderer.invoke('inventory:departments:list'),
  getInventoryItemTypes: (): Promise<string[]> => ipcRenderer.invoke('inventory:item-types:list'),
  getInventoryTaxCodes: (): Promise<InventoryTaxCode[]> =>
    ipcRenderer.invoke('inventory:tax-codes:list'),

  // Item Type CRUD
  getItemTypes: (): Promise<ItemType[]> => ipcRenderer.invoke('item-types:list'),
  createItemType: (input: CreateItemTypeInput): Promise<ItemType> =>
    ipcRenderer.invoke('item-types:create', input),
  updateItemType: (input: UpdateItemTypeInput): Promise<ItemType> =>
    ipcRenderer.invoke('item-types:update', input),
  deleteItemType: (id: number): Promise<void> => ipcRenderer.invoke('item-types:delete', id),

  // Legacy aliases (forward to item-types)
  getDepartments: (): Promise<ItemType[]> => ipcRenderer.invoke('departments:list'),
  createDepartment: (input: CreateItemTypeInput): Promise<ItemType> =>
    ipcRenderer.invoke('departments:create', input),
  updateDepartment: (input: UpdateItemTypeInput): Promise<ItemType> =>
    ipcRenderer.invoke('departments:update', input),
  deleteDepartment: (id: number): Promise<void> => ipcRenderer.invoke('departments:delete', id),

  // Tax Code CRUD
  getTaxCodes: (): Promise<TaxCode[]> => ipcRenderer.invoke('tax-codes:list'),
  createTaxCode: (input: CreateTaxCodeInput): Promise<TaxCode> =>
    ipcRenderer.invoke('tax-codes:create', input),
  updateTaxCode: (input: UpdateTaxCodeInput): Promise<TaxCode> =>
    ipcRenderer.invoke('tax-codes:update', input),
  deleteTaxCode: (id: number): Promise<void> => ipcRenderer.invoke('tax-codes:delete', id),
  applyTaxToAll: (taxRate: number): Promise<{ updated: number }> =>
    ipcRenderer.invoke('inventory:apply-tax-to-all', taxRate),

  // Distributor CRUD
  getDistributors: (): Promise<Distributor[]> => ipcRenderer.invoke('distributors:list'),
  createDistributor: (input: CreateDistributorInput): Promise<Distributor> =>
    ipcRenderer.invoke('distributors:create', input),
  updateDistributor: (input: UpdateDistributorInput): Promise<Distributor> =>
    ipcRenderer.invoke('distributors:update', input),
  deleteDistributor: (distributorNumber: number): Promise<void> =>
    ipcRenderer.invoke('distributors:delete', distributorNumber),

  // Sales Rep CRUD
  getSalesRepsByDistributor: (distributorNumber: number): Promise<SalesRep[]> =>
    ipcRenderer.invoke('sales-reps:list-by-distributor', distributorNumber),
  createSalesRep: (input: CreateSalesRepInput): Promise<SalesRep> =>
    ipcRenderer.invoke('sales-reps:create', input),
  updateSalesRep: (input: UpdateSalesRepInput): Promise<SalesRep> =>
    ipcRenderer.invoke('sales-reps:update', input),
  deleteSalesRep: (salesRepId: number): Promise<void> =>
    ipcRenderer.invoke('sales-reps:delete', salesRepId),

  // Supabase Auth
  authLogin: (email: string, password: string): Promise<AuthResult> =>
    ipcRenderer.invoke('auth:login', email, password),
  authLogout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
  authCheckSession: (): Promise<AuthResult | null> => ipcRenderer.invoke('auth:check-session'),
  authSetSession: (accessToken: string, refreshToken: string): Promise<{ email: string }> =>
    ipcRenderer.invoke('auth:set-session', accessToken, refreshToken),
  authSetPassword: (password: string): Promise<AuthResult> =>
    ipcRenderer.invoke('auth:set-password', password),
  onDeepLink: (
    callback: (payload: { accessToken: string; refreshToken: string; type: string | null }) => void
  ) => ipcRenderer.on('auth:deep-link', (_event, payload) => callback(payload)),

  // Catalog
  getCatalogDistributors: (): Promise<CatalogDistributor[]> =>
    ipcRenderer.invoke('catalog:distributors'),
  importCatalogItems: (distributorIds: number[]): Promise<ImportResult> =>
    ipcRenderer.invoke('catalog:import', distributorIds),

  // Merchant Config
  getMerchantConfig: (): Promise<MerchantConfig | null> =>
    ipcRenderer.invoke('merchant:get-config'),
  activateMerchant: (apiKey: string): Promise<MerchantConfig> =>
    ipcRenderer.invoke('merchant:activate', apiKey),
  deactivateMerchant: (): Promise<void> => ipcRenderer.invoke('merchant:deactivate'),

  // Cashiers
  getCashiers: (): Promise<Cashier[]> => ipcRenderer.invoke('cashiers:list'),
  createCashier: (input: CreateCashierInput): Promise<Cashier> =>
    ipcRenderer.invoke('cashiers:create', input),
  validatePin: (pin: string): Promise<Cashier | null> =>
    ipcRenderer.invoke('cashiers:validate-pin', pin),
  updateCashier: (input: UpdateCashierInput): Promise<Cashier> =>
    ipcRenderer.invoke('cashiers:update', input),
  deleteCashier: (id: number): Promise<void> => ipcRenderer.invoke('cashiers:delete', id),

  // Stax Terminal Payments
  getTerminalRegisters: (): Promise<TerminalRegister[]> =>
    ipcRenderer.invoke('stax:terminal:registers'),
  chargeTerminal: (input: TerminalChargeInput): Promise<TerminalChargeResult> =>
    ipcRenderer.invoke('stax:terminal:charge', input),
  chargeWithCard: (input: DirectChargeInput): Promise<TerminalChargeResult> =>
    ipcRenderer.invoke('stax:charge:direct', input),

  // Transactions
  saveTransaction: (input: SaveTransactionInput): Promise<SavedTransaction> =>
    ipcRenderer.invoke('transactions:save', input),
  getRecentTransactions: (limit?: number): Promise<SavedTransaction[]> =>
    ipcRenderer.invoke('transactions:recent', limit),
  getTransactionByNumber: (txnNumber: string): Promise<TransactionDetail | null> =>
    ipcRenderer.invoke('transactions:get-by-number', txnNumber),
  saveRefundTransaction: (input: SaveRefundInput): Promise<SavedTransaction> =>
    ipcRenderer.invoke('transactions:save-refund', input),
  listTransactions: (filter: TransactionListFilter): Promise<TransactionListResult> =>
    ipcRenderer.invoke('transactions:list', filter),

  // Held Transactions
  saveHeldTransaction: (input: SaveHeldTransactionInput): Promise<HeldTransaction> =>
    ipcRenderer.invoke('held-transactions:save', input),
  getHeldTransactions: (): Promise<HeldTransaction[]> =>
    ipcRenderer.invoke('held-transactions:list'),
  deleteHeldTransaction: (id: number): Promise<void> =>
    ipcRenderer.invoke('held-transactions:delete', id),
  clearAllHeldTransactions: (): Promise<void> => ipcRenderer.invoke('held-transactions:clear-all'),

  // Cash Drawer
  getCashDrawerConfig: (): Promise<
    { type: 'usb'; printerName: string } | { type: 'tcp'; ip: string; port: number } | null
  > => ipcRenderer.invoke('peripheral:get-drawer-config'),
  saveCashDrawerConfig: (
    config: { type: 'usb'; printerName: string } | { type: 'tcp'; ip: string; port: number }
  ): Promise<void> => ipcRenderer.invoke('peripheral:save-drawer-config', config),
  openCashDrawer: (): Promise<void> => ipcRenderer.invoke('peripheral:open-cash-drawer'),
  printReceipt: (input: PrintReceiptInput): Promise<void> =>
    ipcRenderer.invoke('peripheral:print-receipt', input),
  getReceiptConfig: (): Promise<ReceiptConfig> =>
    ipcRenderer.invoke('peripheral:get-receipt-config'),
  saveReceiptConfig: (config: ReceiptConfig): Promise<void> =>
    ipcRenderer.invoke('peripheral:save-receipt-config', config),
  getPrinterStatus: (): Promise<{ connected: boolean; printerName: string | null }> =>
    ipcRenderer.invoke('peripheral:get-printer-status'),

  // Sessions
  getActiveSession: (): Promise<Session | null> => ipcRenderer.invoke('sessions:get-active'),
  createSession: (input: CreateSessionInput): Promise<Session> =>
    ipcRenderer.invoke('sessions:create', input),
  closeSession: (input: CloseSessionInput): Promise<Session> =>
    ipcRenderer.invoke('sessions:close', input),
  listSessions: (limit?: number, offset?: number): Promise<SessionListResult> =>
    ipcRenderer.invoke('sessions:list', limit, offset),
  getSessionReport: (sessionId: number): Promise<ClockOutReport> =>
    ipcRenderer.invoke('sessions:report', sessionId),
  printClockOutReport: (input: PrintClockOutReportInput): Promise<void> =>
    ipcRenderer.invoke('sessions:print-report', input),

  // Cloud Sync
  getSyncStatus: (): Promise<SyncStatus> => ipcRenderer.invoke('sync:get-status'),
  getDeviceConfig: (): Promise<DeviceConfig | null> => ipcRenderer.invoke('sync:get-device-config'),
  onConnectivityChanged: (callback: (online: boolean) => void) =>
    ipcRenderer.on('sync:connectivity-changed', (_event, online) => callback(online))
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
