import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
  ReceiptConfig
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
  getInventoryTaxCodes: (): Promise<InventoryTaxCode[]> =>
    ipcRenderer.invoke('inventory:tax-codes:list'),

  // Department CRUD
  getDepartments: (): Promise<Department[]> => ipcRenderer.invoke('departments:list'),
  createDepartment: (input: CreateDepartmentInput): Promise<Department> =>
    ipcRenderer.invoke('departments:create', input),
  updateDepartment: (input: UpdateDepartmentInput): Promise<Department> =>
    ipcRenderer.invoke('departments:update', input),
  deleteDepartment: (id: number): Promise<void> => ipcRenderer.invoke('departments:delete', id),

  // Tax Code CRUD
  getTaxCodes: (): Promise<TaxCode[]> => ipcRenderer.invoke('tax-codes:list'),
  createTaxCode: (input: CreateTaxCodeInput): Promise<TaxCode> =>
    ipcRenderer.invoke('tax-codes:create', input),
  updateTaxCode: (input: UpdateTaxCodeInput): Promise<TaxCode> =>
    ipcRenderer.invoke('tax-codes:update', input),
  deleteTaxCode: (id: number): Promise<void> => ipcRenderer.invoke('tax-codes:delete', id),

  // Vendor CRUD
  getVendors: (): Promise<Vendor[]> => ipcRenderer.invoke('vendors:list'),
  createVendor: (input: CreateVendorInput): Promise<Vendor> =>
    ipcRenderer.invoke('vendors:create', input),
  updateVendor: (input: UpdateVendorInput): Promise<Vendor> =>
    ipcRenderer.invoke('vendors:update', input),
  deleteVendor: (vendorNumber: number): Promise<void> =>
    ipcRenderer.invoke('vendors:delete', vendorNumber),

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
    ipcRenderer.invoke('peripheral:get-printer-status')
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
