/**
 * Database module barrel - re-exports everything that main/index.ts needs.
 *
 * Internal modules:
 *   connection.ts    - singleton DB handle, ensureColumn helper
 *   schema.ts        - initializeDatabase (DDL + migrations)
 *   seed.ts          - initial data seeding
 *   products.repo.ts - product / inventory queries & writes
 *   departments.repo.ts - department CRUD (legacy, unused)
 *   item-types.repo.ts  - item type CRUD
 *   tax-codes.repo.ts   - tax code CRUD
 *   distributors.repo.ts - distributor CRUD
 *   sales-reps.repo.ts  - sales rep CRUD
 *   transactions.repo.ts - transaction saving & history
 *   sessions.repo.ts     - register session CRUD & clock-out reports
 */

// Schema / lifecycle
export { initializeDatabase } from './schema'

// Products & inventory
export {
  getProducts,
  hasAnyActiveProduct,
  searchProducts,
  getInventoryProducts,
  getInventoryItemTypes,
  getInventoryTaxCodes,
  searchInventoryProducts,
  getInventoryProductDetail,
  saveInventoryItem,
  deleteInventoryItem,
  getActiveSpecialPricing,
  applyTaxToAllProducts,
  getReorderProducts,
  getDistributorsWithReorderable,
  setProductDiscontinued,
  getUnpricedInventoryProducts,
  findProductBySku,
  toggleFavorite,
  getDistinctSizes
} from './products.repo'

// Item Types
export { getItemTypes, createItemType, updateItemType, deleteItemType } from './item-types.repo'

// Tax codes
export { getTaxCodes, createTaxCode, updateTaxCode, deleteTaxCode } from './tax-codes.repo'

// Distributors
export {
  getDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor
} from './distributors.repo'

// Sales Reps
export {
  getSalesRepsByDistributor,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep
} from './sales-reps.repo'

// Transactions
export {
  saveTransaction,
  getRecentTransactions,
  getProductSalesHistory,
  getTransactionByNumber,
  saveRefundTransaction,
  listTransactions,
  backfillTransactionDeviceId,
  getLocalTransactionHistoryStats
} from './transactions.repo'

// Held transactions
export {
  saveHeldTransaction,
  getHeldTransactions,
  deleteHeldTransaction,
  clearAllHeldTransactions
} from './held-transactions.repo'

// Merchant config
export {
  clearMerchantConfig,
  getCardSurcharge,
  getMerchantConfig,
  saveMerchantConfig,
  setCardSurcharge
} from './merchant-config.repo'

// Cashiers
export {
  getCashiers,
  createCashier,
  validatePin,
  updateCashier,
  deleteCashier
} from './cashiers.repo'

// Sessions
export {
  createSession,
  getActiveSession,
  closeSession,
  listSessions,
  generateClockOutReport
} from './sessions.repo'

// Device Config
export { getDeviceConfig, saveDeviceConfig, clearDeviceConfig } from './device-config.repo'

// Purchase Orders
export {
  getPurchaseOrders,
  getPurchaseOrderDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderItems,
  markPurchaseOrderFullyReceived,
  receivePurchaseOrderItem,
  addPurchaseOrderItem,
  removePurchaseOrderItem,
  deletePurchaseOrder
} from './purchase-orders.repo'

// Reports
export {
  getSalesSummary,
  getProductSales,
  getCategorySales,
  getTaxSummary,
  getComparisonData,
  getCashierSales,
  getHourlySales,
  getTransactionList
} from './reports.repo'

// Sync Queue
export {
  enqueueSyncItem,
  getPendingItems,
  markInFlight,
  markDone,
  markFailed,
  retryFailed,
  getQueueStats,
  recoverInFlight
} from './sync-queue.repo'

// Inventory Deltas
export {
  recordDelta,
  getInventoryDeltaById,
  getInventoryDeltaSyncPayload,
  getUnsyncedDeltas,
  markDeltaSynced,
  getDeltasByProduct
} from './inventory-deltas.repo'

// Re-export shared types so existing consumers (main/index.ts) don't break
export type {
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
  SaveMerchantConfigInput,
  Cashier,
  CreateCashierInput,
  UpdateCashierInput,
  SaveTransactionInput,
  SavedTransaction,
  TransactionHistoryItem,
  Session,
  CreateSessionInput,
  CloseSessionInput,
  ClockOutReport,
  SessionListResult,
  PrintClockOutReportInput,
  DeviceConfig,
  SaveDeviceConfigInput,
  SyncQueueItem,
  SyncQueueInsert,
  SyncQueueStats
} from '../../shared/types'
