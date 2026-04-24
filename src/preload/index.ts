import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
// Side-effect import: initializes the __electronLog bridge so that
// electron-log/renderer in the renderer process can forward to the main file
// transport. The module's default export is the init function, not a logger —
// do not attempt to call log.info/error here.
import 'electron-log/preload'
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
  InitialSyncStatus,
  TransactionBackfillStatus,
  LocalTransactionHistoryStats,
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
  ProvisionMerchantResult,
  Register,
  MerchantStatus,
  ReorderDistributorRow,
  ReorderProductsResult,
  ReorderQuery,
  SkuExistenceResult,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderDetail,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemsInput,
  ReceivePurchaseOrderItemInput,
  TelemetryEventInput
} from '../shared/types'

const PERF_SAMPLE_RATE = 0.1
const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer)
const TELEMETRY_DEBUG_CONSOLE = import.meta.env.DEV

function logTelemetryDebug(event: {
  type: 'error' | 'performance' | 'behavior' | 'system'
  name: string
  payload?: Record<string, unknown>
}): void {
  if (!TELEMETRY_DEBUG_CONSOLE) return
  console.debug('[telemetry]', event.type, event.name, event.payload ?? {})
}

function fireAndForgetTelemetry(payload: {
  type: 'error' | 'performance' | 'behavior' | 'system'
  name: string
  payload?: Record<string, unknown>
  sampleRate?: number
}): void {
  logTelemetryDebug(payload)
  void rawInvoke('telemetry:track', payload).catch(() => {
    // Never break renderer flow on telemetry failures.
  })
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (channel === 'telemetry:track') {
    const eventArg = args[0]
    if (
      eventArg &&
      typeof eventArg === 'object' &&
      'type' in eventArg &&
      'name' in eventArg &&
      typeof (eventArg as { type: unknown }).type === 'string' &&
      typeof (eventArg as { name: unknown }).name === 'string'
    ) {
      logTelemetryDebug(
        eventArg as {
          type: 'error' | 'performance' | 'behavior' | 'system'
          name: string
          payload?: Record<string, unknown>
        }
      )
    }
    return rawInvoke(channel, ...args) as Promise<T>
  }

  const startedAt = performance.now()
  try {
    const result = (await rawInvoke(channel, ...args)) as T
    const durationMs = Math.round((performance.now() - startedAt) * 1000) / 1000
    if (Math.random() < PERF_SAMPLE_RATE) {
      fireAndForgetTelemetry({
        type: 'performance',
        name: 'ipc_call',
        payload: {
          channel,
          duration_ms: durationMs,
          success: true
        },
        sampleRate: 1
      })
    }
    return result
  } catch (error) {
    const durationMs = Math.round((performance.now() - startedAt) * 1000) / 1000
    const message = error instanceof Error ? error.message : String(error)
    fireAndForgetTelemetry({
      type: 'error',
      name: 'ipc_call_failed',
      payload: {
        channel,
        duration_ms: durationMs,
        message
      },
      sampleRate: 1
    })
    throw error
  }
}

;(ipcRenderer as typeof ipcRenderer & { invoke: typeof invoke }).invoke = invoke

// Custom APIs for renderer
const api = {
  getProducts: (): Promise<Product[]> => ipcRenderer.invoke('products:list'),
  hasAnyProduct: (): Promise<boolean> => ipcRenderer.invoke('products:has-any'),
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
  listSizesInUse: (): Promise<string[]> => ipcRenderer.invoke('inventory:list-sizes-in-use'),

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
  applyTaxToAll: (taxCodeId: number): Promise<{ updated: number }> =>
    ipcRenderer.invoke('inventory:apply-tax-to-all', taxCodeId),

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
  authFullSignOut: (): Promise<{ drained: number; remaining: number }> =>
    ipcRenderer.invoke('auth:full-sign-out'),
  authCheckSession: (): Promise<AuthResult | null> => ipcRenderer.invoke('auth:check-session'),
  authSetSession: (accessToken: string, refreshToken: string): Promise<{ email: string }> =>
    ipcRenderer.invoke('auth:set-session', accessToken, refreshToken),
  authSetPassword: (password: string): Promise<AuthResult> =>
    ipcRenderer.invoke('auth:set-password', password),
  onDeepLink: (
    callback: (payload: { accessToken: string; refreshToken: string; type: string | null }) => void
  ) => ipcRenderer.on('auth:deep-link', (_event, payload) => callback(payload)),
  consumePendingDeepLink: (): Promise<string | null> =>
    ipcRenderer.invoke('auth:consume-pending-deep-link'),

  // Catalog
  getCatalogDistributors: (): Promise<CatalogDistributor[]> =>
    ipcRenderer.invoke('catalog:distributors'),
  importCatalogItems: (distributorIds: number[]): Promise<ImportResult> =>
    ipcRenderer.invoke('catalog:import', distributorIds),

  // Merchant Config
  getMerchantConfig: (): Promise<MerchantConfig | null> =>
    ipcRenderer.invoke('merchant:get-config'),
  activateMerchant: (
    apiUsername: string,
    apiPassword: string,
    merchantId: string
  ): Promise<MerchantConfig> =>
    ipcRenderer.invoke('merchant:activate', apiUsername, apiPassword, merchantId),
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

  // Finix Payments
  finixListDevices: (): Promise<FinixDevice[]> => ipcRenderer.invoke('finix:devices:list'),
  finixCreateDevice: (input: FinixCreateDeviceInput): Promise<FinixDevice> =>
    ipcRenderer.invoke('finix:device:create', input),
  finixChargeCard: (input: FinixCardInput): Promise<FinixChargeResult> =>
    ipcRenderer.invoke('finix:charge:card', input),
  finixChargeTerminal: (input: FinixTerminalChargeInput): Promise<FinixChargeResult> =>
    ipcRenderer.invoke('finix:charge:terminal', input),
  finixVoidAuthorization: (authorizationId: string): Promise<void> =>
    ipcRenderer.invoke('finix:void:authorization', authorizationId),
  finixRefundTransfer: (transferId: string, amountCents: number): Promise<void> =>
    ipcRenderer.invoke('finix:refund:transfer', transferId, amountCents),
  finixProvisionMerchant: (input: BusinessInfoInput): Promise<ProvisionMerchantResult> =>
    ipcRenderer.invoke('finix:provision-merchant', input),

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
  getReceiptPrinterConfig: (): Promise<ReceiptPrinterConfig | null> =>
    ipcRenderer.invoke('peripheral:get-receipt-printer-config'),
  saveReceiptPrinterConfig: (config: ReceiptPrinterConfig): Promise<void> =>
    ipcRenderer.invoke('peripheral:save-receipt-printer-config', config),
  listReceiptPrinters: (): Promise<string[]> =>
    ipcRenderer.invoke('peripheral:list-receipt-printers'),
  getPrinterStatus: (
    printerName?: string
  ): Promise<{ connected: boolean; printerName: string | null }> =>
    ipcRenderer.invoke('peripheral:get-printer-status', printerName),

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
  getInitialSyncStatus: (): Promise<InitialSyncStatus> =>
    ipcRenderer.invoke('sync:get-initial-status'),
  retryInitialSync: (): Promise<void> => ipcRenderer.invoke('sync:retry-initial-sync'),
  getDeviceConfig: (): Promise<DeviceConfig | null> => ipcRenderer.invoke('sync:get-device-config'),
  onConnectivityChanged: (callback: (online: boolean) => void) =>
    ipcRenderer.on('sync:connectivity-changed', (_event, online) => callback(online)),
  onInitialSyncStatusChanged: (callback: (status: InitialSyncStatus) => void) =>
    ipcRenderer.on('sync:initial-status-changed', (_event, status) => callback(status)),

  // Transaction history / backfill
  getLocalHistoryStats: (): Promise<LocalTransactionHistoryStats> =>
    ipcRenderer.invoke('history:get-stats'),
  getBackfillStatus: (): Promise<TransactionBackfillStatus> =>
    ipcRenderer.invoke('history:get-backfill-status'),
  triggerBackfill: (days: number): Promise<{ started: boolean; days: number }> =>
    ipcRenderer.invoke('history:trigger-backfill', days),
  onBackfillStatusChanged: (
    callback: (status: TransactionBackfillStatus) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: TransactionBackfillStatus
    ): void => {
      callback(status)
    }
    ipcRenderer.on('history:backfill-status-changed', listener)
    return (): void => {
      ipcRenderer.removeListener('history:backfill-status-changed', listener)
    }
  },

  // Reports
  getReportSalesSummary: (range: ReportDateRange): Promise<SalesSummaryReport> =>
    ipcRenderer.invoke('reports:sales-summary', range),
  getReportProductSales: (
    range: ReportDateRange,
    sortBy?: 'revenue' | 'quantity',
    limit?: number
  ): Promise<ProductSalesReport> =>
    ipcRenderer.invoke('reports:product-sales', range, sortBy, limit),
  getReportCategorySales: (range: ReportDateRange): Promise<CategorySalesReport> =>
    ipcRenderer.invoke('reports:category-sales', range),
  getReportTaxSummary: (range: ReportDateRange): Promise<TaxReport> =>
    ipcRenderer.invoke('reports:tax-summary', range),
  getReportComparison: (
    rangeA: ReportDateRange,
    rangeB: ReportDateRange
  ): Promise<ComparisonReport> => ipcRenderer.invoke('reports:comparison', rangeA, rangeB),
  getReportCashierSales: (range: ReportDateRange): Promise<CashierSalesReport> =>
    ipcRenderer.invoke('reports:cashier-sales', range),
  getReportHourlySales: (range: ReportDateRange): Promise<HourlySalesReport> =>
    ipcRenderer.invoke('reports:hourly-sales', range),
  exportReport: (request: ReportExportRequest): Promise<string | null> =>
    ipcRenderer.invoke('reports:export', request),

  // Auto-updater
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: { version: string; releaseDate: string }
    ): void => callback(info)
    ipcRenderer.on('updater:update-available', handler)
    return () => ipcRenderer.removeListener('updater:update-available', handler)
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('updater:update-not-available', handler)
    return () => ipcRenderer.removeListener('updater:update-not-available', handler)
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string }): void =>
      callback(info)
    ipcRenderer.on('updater:update-downloaded', handler)
    return () => ipcRenderer.removeListener('updater:update-downloaded', handler)
  },
  onUpdateError: (callback: (err: { message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, err: { message: string }): void =>
      callback(err)
    ipcRenderer.on('updater:error', handler)
    return () => ipcRenderer.removeListener('updater:error', handler)
  },
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('updater:check'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),

  // Manager — Registers
  listRegisters: (): Promise<Register[]> => ipcRenderer.invoke('registers:list'),
  renameRegister: (id: string, newName: string): Promise<void> =>
    ipcRenderer.invoke('registers:rename', id, newName),
  deleteRegister: (id: string): Promise<void> => ipcRenderer.invoke('registers:delete', id),

  // Manager — Reorder
  getReorderProducts: (query: ReorderQuery): Promise<ReorderProductsResult> =>
    ipcRenderer.invoke('inventory:reorder-products', query),
  getReorderDistributors: (): Promise<ReorderDistributorRow[]> =>
    ipcRenderer.invoke('inventory:reorder-distributors'),
  setProductDiscontinued: (id: number, discontinued: boolean): Promise<void> =>
    ipcRenderer.invoke('inventory:set-discontinued', id, discontinued),
  getUnpricedProducts: (): Promise<InventoryProduct[]> =>
    ipcRenderer.invoke('inventory:unpriced-products'),
  findProductBySku: (sku: string): Promise<Product | null> =>
    ipcRenderer.invoke('inventory:find-by-sku', sku),
  checkSkuExists: (sku: string): Promise<SkuExistenceResult> =>
    ipcRenderer.invoke('inventory:check-sku-exists', sku),
  pullProductBySku: (sku: string): Promise<InventoryProductDetail | null> =>
    ipcRenderer.invoke('inventory:pull-product-by-sku', sku),
  toggleFavorite: (productId: number): Promise<void> =>
    ipcRenderer.invoke('inventory:toggle-favorite', productId),
  getDistinctSizes: (): Promise<string[]> => ipcRenderer.invoke('inventory:distinct-sizes'),

  // Manager — Merchant Status
  getFinixMerchantStatus: (): Promise<MerchantStatus> =>
    ipcRenderer.invoke('finix:merchant-status'),

  // Purchase Orders
  getPurchaseOrders: (): Promise<PurchaseOrder[]> => ipcRenderer.invoke('purchase-orders:list'),
  getPurchaseOrderDetail: (poId: number): Promise<PurchaseOrderDetail | null> =>
    ipcRenderer.invoke('purchase-orders:detail', poId),
  createPurchaseOrder: (input: CreatePurchaseOrderInput): Promise<PurchaseOrderDetail> =>
    ipcRenderer.invoke('purchase-orders:create', input),
  updatePurchaseOrder: (input: UpdatePurchaseOrderInput): Promise<PurchaseOrder> =>
    ipcRenderer.invoke('purchase-orders:update', input),
  updatePurchaseOrderItems: (input: UpdatePurchaseOrderItemsInput): Promise<PurchaseOrderDetail> =>
    ipcRenderer.invoke('purchase-orders:update-items', input),
  markPurchaseOrderReceived: (poId: number): Promise<PurchaseOrderDetail> =>
    ipcRenderer.invoke('purchase-orders:mark-received', poId),
  receivePurchaseOrderItem: (input: ReceivePurchaseOrderItemInput): Promise<PurchaseOrderItem> =>
    ipcRenderer.invoke('purchase-orders:receive-item', input),
  addPurchaseOrderItem: (
    poId: number,
    productId: number,
    quantityOrdered: number
  ): Promise<PurchaseOrderItem> =>
    ipcRenderer.invoke('purchase-orders:add-item', poId, productId, quantityOrdered),
  removePurchaseOrderItem: (poId: number, itemId: number): Promise<void> =>
    ipcRenderer.invoke('purchase-orders:remove-item', poId, itemId),
  deletePurchaseOrder: (poId: number): Promise<void> =>
    ipcRenderer.invoke('purchase-orders:delete', poId),

  // Zoom
  getZoomFactor: (): Promise<number> => ipcRenderer.invoke('zoom:get'),
  setZoomFactor: (factor: number): Promise<void> => ipcRenderer.invoke('zoom:set', factor),

  trackEvent: (event: TelemetryEventInput): Promise<void> => invoke('telemetry:track', event)
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
