import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  getInventoryItemTypes,
  getInventoryProductDetail,
  getInventoryProducts,
  getInventoryTaxCodes,
  getProducts,
  searchProducts,
  initializeDatabase,
  saveInventoryItem,
  deleteInventoryItem,
  searchInventoryProducts,
  getActiveSpecialPricing,
  getItemTypes,
  createItemType,
  updateItemType,
  deleteItemType,
  getTaxCodes,
  createTaxCode,
  updateTaxCode,
  deleteTaxCode,
  getDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor,
  getSalesRepsByDistributor,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep,
  getMerchantConfig,
  saveMerchantConfig,
  clearMerchantConfig,
  getCashiers,
  createCashier,
  validatePin,
  updateCashier,
  deleteCashier,
  saveTransaction,
  getRecentTransactions,
  getTransactionByNumber,
  saveRefundTransaction,
  backfillTransactionDeviceId,
  listTransactions,
  saveHeldTransaction,
  getHeldTransactions,
  deleteHeldTransaction,
  clearAllHeldTransactions,
  createSession,
  getActiveSession,
  closeSession,
  listSessions,
  generateClockOutReport,
  applyTaxToAllProducts,
  getSalesSummary,
  getProductSales,
  getCategorySales,
  getTaxSummary,
  getComparisonData,
  getCashierSales,
  getHourlySales,
  getTransactionList,
  getLowStockProducts,
  getUnpricedInventoryProducts,
  findProductBySku,
  toggleFavorite,
  getDistinctSizes
} from './database'
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderItemInput
} from '../shared/types'
import {
  getPurchaseOrders,
  getPurchaseOrderDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  receivePurchaseOrderItem,
  addPurchaseOrderItem,
  removePurchaseOrderItem,
  deletePurchaseOrder
} from './database'
import {
  verifyMerchant,
  listDevices,
  createDevice,
  chargeWithCard,
  chargeTerminal,
  voidAuthorization,
  refundTransfer
} from './services/finix'
import {
  initializeSupabaseService,
  supabaseSignIn,
  supabaseSignOut,
  supabaseCheckSession,
  supabaseSetSession,
  supabaseSetPassword,
  getCatalogDistributors,
  getCatalogProductsByDistributors,
  provisionFinixMerchant
} from './services/supabase'
import { getDb } from './database/connection'
import {
  openCashDrawer,
  getCashDrawerConfig,
  getEffectiveCashDrawerConfig,
  saveCashDrawerConfig,
  getReceiptConfig,
  saveReceiptConfig,
  getReceiptPrinterConfig,
  saveReceiptPrinterConfig,
  listReceiptPrinters,
  checkPrinterConnected
} from './services/cash-drawer'
import type { CashDrawerConfig } from './services/cash-drawer'
import { printReceipt, printClockOutReport } from './services/receipt-printer'
import { exportToPdf, exportToCsv } from './services/report-export'
import {
  startConnectivityMonitor,
  stopConnectivityMonitor,
  isOnline,
  onConnectivityChange
} from './services/connectivity'
import { registerDevice } from './services/device-registration'
import { listRegisters, renameRegister, deleteRegister } from './services/register-management'
import { getSupabaseClient, getMerchantCloudId } from './services/supabase'
import { getLastSyncedAt, startSyncWorker, stopSyncWorker } from './services/sync-worker'
import {
  runInitialSync,
  getInitialSyncStatus,
  setInitialSyncStatusCallback
} from './services/sync/initial-sync'
import { getDeviceConfig } from './database/device-config.repo'
import { getQueueStats } from './database/sync-queue.repo'
import { initAutoUpdater, checkForUpdates, installUpdate } from './services/auto-updater'
import type {
  FinixCardInput,
  FinixTerminalChargeInput,
  FinixCreateDeviceInput,
  SaveTransactionInput,
  SaveRefundInput,
  SaveHeldTransactionInput,
  SearchProductFilters,
  TransactionListFilter,
  PrintReceiptInput,
  ReceiptConfig,
  ReceiptPrinterConfig,
  CreateSessionInput,
  CloseSessionInput,
  PrintClockOutReportInput,
  ReportDateRange,
  ReportExportRequest,
  BusinessInfoInput
} from '../shared/types'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const userData = app.getPath('userData')
  initializeDatabase(userData)
  initializeSupabaseService(userData)
  startConnectivityMonitor()
  initAutoUpdater()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('products:list', async () => {
    try {
      return getProducts()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list products')
    }
  })

  ipcMain.handle('products:active-special-pricing', async () => {
    try {
      return getActiveSpecialPricing()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get active special pricing')
    }
  })

  ipcMain.handle('products:search', async (_, query: string, filters?: SearchProductFilters) => {
    try {
      return searchProducts(query, filters)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to search products')
    }
  })

  ipcMain.handle('inventory:products:list', async () => {
    try {
      return getInventoryProducts()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list inventory products')
    }
  })

  ipcMain.handle('inventory:products:search', async (_, query: string) => {
    try {
      return searchInventoryProducts(query)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to search inventory products')
    }
  })

  ipcMain.handle('inventory:products:detail', async (_, itemNumber: number) => {
    try {
      return getInventoryProductDetail(itemNumber)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get product detail')
    }
  })

  ipcMain.handle('inventory:products:save', async (_, payload) => {
    try {
      return saveInventoryItem(payload)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save inventory item')
    }
  })

  ipcMain.handle('inventory:products:delete', async (_, itemNumber: number) => {
    try {
      deleteInventoryItem(itemNumber)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete inventory item')
    }
  })

  ipcMain.handle('inventory:departments:list', async () => {
    try {
      return getInventoryItemTypes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list item types')
    }
  })

  ipcMain.handle('inventory:item-types:list', async () => {
    try {
      return getInventoryItemTypes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list item types')
    }
  })

  ipcMain.handle('inventory:tax-codes:list', async () => {
    try {
      return getInventoryTaxCodes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list tax codes')
    }
  })

  // Department CRUD (legacy aliases — forward to item-types)
  ipcMain.handle('item-types:list', async () => {
    try {
      return getItemTypes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list item types')
    }
  })

  ipcMain.handle('item-types:create', async (_, input) => {
    try {
      return createItemType(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create item type')
    }
  })

  ipcMain.handle('item-types:update', async (_, input) => {
    try {
      return updateItemType(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update item type')
    }
  })

  ipcMain.handle('item-types:delete', async (_, id: number) => {
    try {
      return deleteItemType(id)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete item type')
    }
  })

  ipcMain.handle('departments:list', async () => {
    try {
      return getItemTypes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list item types')
    }
  })

  ipcMain.handle('departments:create', async (_, input) => {
    try {
      return createItemType(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create item type')
    }
  })

  ipcMain.handle('departments:update', async (_, input) => {
    try {
      return updateItemType(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update item type')
    }
  })

  ipcMain.handle('departments:delete', async (_, id: number) => {
    try {
      return deleteItemType(id)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete item type')
    }
  })

  // Tax Code CRUD
  ipcMain.handle('tax-codes:list', async () => {
    try {
      return getTaxCodes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list tax codes')
    }
  })

  ipcMain.handle('tax-codes:create', async (_, input) => {
    try {
      return createTaxCode(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create tax code')
    }
  })

  ipcMain.handle('tax-codes:update', async (_, input) => {
    try {
      return updateTaxCode(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update tax code')
    }
  })

  ipcMain.handle('tax-codes:delete', async (_, id: number) => {
    try {
      return deleteTaxCode(id)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete tax code')
    }
  })

  // Distributor CRUD
  ipcMain.handle('distributors:list', async () => {
    try {
      return getDistributors()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list distributors')
    }
  })

  ipcMain.handle('distributors:create', async (_, input) => {
    try {
      return createDistributor(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create distributor')
    }
  })

  ipcMain.handle('distributors:update', async (_, input) => {
    try {
      return updateDistributor(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update distributor')
    }
  })

  ipcMain.handle('distributors:delete', async (_, distributorNumber: number) => {
    try {
      return deleteDistributor(distributorNumber)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete distributor')
    }
  })

  // Sales Rep CRUD
  ipcMain.handle('sales-reps:list-by-distributor', async (_, distributorNumber: number) => {
    try {
      return getSalesRepsByDistributor(distributorNumber)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list sales reps')
    }
  })

  ipcMain.handle('sales-reps:create', async (_, input) => {
    try {
      return createSalesRep(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create sales rep')
    }
  })

  ipcMain.handle('sales-reps:update', async (_, input) => {
    try {
      return updateSalesRep(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update sales rep')
    }
  })

  ipcMain.handle('sales-reps:delete', async (_, salesRepId: number) => {
    try {
      return deleteSalesRep(salesRepId)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete sales rep')
    }
  })

  // Merchant Config
  ipcMain.handle('merchant:get-config', async () => {
    try {
      return getMerchantConfig()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get merchant config')
    }
  })

  ipcMain.handle(
    'merchant:activate',
    async (_, apiUsername: string, apiPassword: string, merchantId: string) => {
      try {
        const merchantInfo = await verifyMerchant(apiUsername, apiPassword, merchantId)
        return saveMerchantConfig({
          finix_api_username: apiUsername,
          finix_api_password: apiPassword,
          merchant_id: merchantInfo.merchant_id,
          merchant_name: merchantInfo.merchant_name
        })
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to activate merchant')
      }
    }
  )

  ipcMain.handle('merchant:deactivate', async () => {
    try {
      return clearMerchantConfig()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to deactivate merchant')
    }
  })

  // Supabase Auth
  ipcMain.handle('auth:login', async (_, email: string, password: string) => {
    try {
      return await supabaseSignIn(email, password)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Sign in failed')
    }
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      await supabaseSignOut()
      clearMerchantConfig()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Sign out failed')
    }
  })

  ipcMain.handle('auth:check-session', async () => {
    try {
      return await supabaseCheckSession()
    } catch {
      return null
    }
  })

  // Catalog
  ipcMain.handle('catalog:distributors', async () => {
    try {
      return await getCatalogDistributors()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch catalog distributors')
    }
  })

  ipcMain.handle('catalog:import', async (_, distributorIds: number[]) => {
    try {
      const [catalogProducts, allCatalogDistributors] = await Promise.all([
        getCatalogProductsByDistributors(distributorIds),
        getCatalogDistributors()
      ])

      const selectedDistributors = allCatalogDistributors.filter((d) =>
        distributorIds.includes(d.distributor_id)
      )

      const db = getDb()
      let importedCount = 0
      let distributorsCreated = 0
      const distributorMap = new Map<number, number>()

      const importTx = db.transaction(() => {
        // Ensure a local distributor record exists for each selected catalog distributor
        for (const catDist of selectedDistributors) {
          const existing = db
            .prepare('SELECT distributor_number FROM distributors WHERE distributor_name = ?')
            .get(catDist.distributor_name) as { distributor_number: number } | undefined

          if (existing) {
            distributorMap.set(catDist.distributor_id, existing.distributor_number)
          } else {
            const result = db
              .prepare('INSERT INTO distributors (distributor_name, license_id) VALUES (?, ?)')
              .run(catDist.distributor_name, catDist.distributor_permit_id ?? null)
            distributorMap.set(catDist.distributor_id, Number(result.lastInsertRowid))
            distributorsCreated++
          }
        }

        const insertProduct = db.prepare(`
          INSERT INTO products (
            sku, name, category, price, cost, case_cost, retail_price, in_stock,
            distributor_number, bottles_per_case, brand_name, proof, alcohol_pct,
            vintage, ttb_id, item_type, size, category_name, is_active
          ) VALUES (?, ?, ?, 0, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `)

        const existsCheck = db.prepare(`
          SELECT id FROM products
          WHERE distributor_number = ? AND name = ? AND (size = ? OR (size IS NULL AND ? IS NULL))
          LIMIT 1
        `)

        const skuExists = db.prepare(`SELECT id FROM products WHERE sku = ? LIMIT 1`)

        for (const product of catalogProducts) {
          const localDistributorNumber = distributorMap.get(product.distributor_id)
          if (localDistributorNumber === undefined) continue

          // Skip products with no meaningful name
          const name = product.prod_name?.trim()
          if (!name || name === '(unnamed)') continue

          const size =
            product.item_size && product.unit_of_measure
              ? `${product.item_size}${product.unit_of_measure}`
              : (product.item_size ?? null)

          // Composite dedup: skip if (distributor, name, size) already exists
          const duplicate = existsCheck.get(localDistributorNumber, name, size, size)
          if (duplicate) continue

          // Strict ttb_id validation: must be purely numeric and >= 8 digits
          const trimmedTtbId = product.ttb_id?.trim()
          const isValidTtbId = !!trimmedTtbId && /^\d{8,}$/.test(trimmedTtbId)

          let sku = isValidTtbId ? trimmedTtbId! : `CAT-${product.id}`

          // Guard against SKU collision (e.g. same TTB ID across distributors)
          if (skuExists.get(sku)) {
            sku = `CAT-${product.id}`
          }

          insertProduct.run(
            sku,
            name,
            product.beverage_type ?? 'General',
            product.bot_price ?? null,
            product.case_price ?? null,
            localDistributorNumber,
            product.bottles_per_case ?? 12,
            product.brand_name ?? null,
            product.proof ?? null,
            product.alcohol_pct ?? null,
            product.vintage ?? null,
            isValidTtbId ? trimmedTtbId : null,
            product.item_type ?? null,
            size,
            product.beverage_type ?? null
          )
          importedCount++
        }

        // Hydrate item_types table from imported product item_type values
        db.prepare(
          `
          INSERT OR IGNORE INTO item_types (name, description, default_profit_margin, default_tax_rate)
          SELECT DISTINCT TRIM(item_type), NULL, 0, 0
          FROM products
          WHERE item_type IS NOT NULL AND TRIM(item_type) != ''
        `
        ).run()

        // Apply each item_type's default_tax_rate to products that have no tax set yet
        db.prepare(
          `
          UPDATE products
          SET tax_1 = (
            SELECT it.default_tax_rate / 100.0
            FROM item_types it
            WHERE TRIM(it.name) = TRIM(products.item_type)
            LIMIT 1
          )
          WHERE is_active = 1
            AND (tax_1 IS NULL OR tax_1 = 0)
            AND item_type IS NOT NULL
        `
        ).run()

        // Fall back to the merchant's default tax code for any product still
        // without a tax rate. Keeps imports consistent with "Apply to all items".
        db.prepare(
          `
          UPDATE products
          SET tax_1 = (SELECT rate FROM tax_codes WHERE is_default = 1 LIMIT 1)
          WHERE is_active = 1
            AND (tax_1 IS NULL OR tax_1 = 0)
            AND EXISTS (SELECT 1 FROM tax_codes WHERE is_default = 1)
        `
        ).run()
      })

      importTx()
      return { imported: importedCount, distributors_created: distributorsCreated }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to import catalog items')
    }
  })

  // Cashiers
  ipcMain.handle('cashiers:list', async () => {
    try {
      return getCashiers()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list cashiers')
    }
  })

  ipcMain.handle('cashiers:create', async (_, input) => {
    try {
      return await createCashier(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create cashier')
    }
  })

  ipcMain.handle('cashiers:validate-pin', async (_, pin: string) => {
    try {
      return await validatePin(pin)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to validate PIN')
    }
  })

  ipcMain.handle('cashiers:update', async (_, input) => {
    try {
      return await updateCashier(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update cashier')
    }
  })

  ipcMain.handle('cashiers:delete', async (_, id: number) => {
    try {
      return deleteCashier(id)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete cashier')
    }
  })

  // Transactions
  ipcMain.handle('transactions:save', async (_, input: SaveTransactionInput) => {
    try {
      return saveTransaction(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save transaction')
    }
  })

  ipcMain.handle('transactions:recent', async (_, limit?: number) => {
    try {
      return getRecentTransactions(limit)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get transactions')
    }
  })

  ipcMain.handle('transactions:get-by-number', async (_, txnNumber: string) => {
    try {
      return getTransactionByNumber(txnNumber)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get transaction')
    }
  })

  ipcMain.handle('transactions:save-refund', async (_, input: SaveRefundInput) => {
    try {
      return saveRefundTransaction(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save refund')
    }
  })

  ipcMain.handle('transactions:list', async (_, filter: TransactionListFilter) => {
    try {
      return listTransactions(filter)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list transactions')
    }
  })

  // Held Transactions
  ipcMain.handle('held-transactions:save', async (_, input: SaveHeldTransactionInput) => {
    try {
      return saveHeldTransaction(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save held transaction')
    }
  })

  ipcMain.handle('held-transactions:list', async () => {
    try {
      return getHeldTransactions()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list held transactions')
    }
  })

  ipcMain.handle('held-transactions:delete', async (_, id: number) => {
    try {
      deleteHeldTransaction(id)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete held transaction')
    }
  })

  ipcMain.handle('held-transactions:clear-all', async () => {
    try {
      clearAllHeldTransactions()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to clear held transactions')
    }
  })

  // Sessions
  ipcMain.handle('sessions:get-active', async () => {
    try {
      return getActiveSession()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get active session')
    }
  })

  ipcMain.handle('sessions:create', async (_, input: CreateSessionInput) => {
    try {
      return createSession(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create session')
    }
  })

  ipcMain.handle('sessions:close', async (_, input: CloseSessionInput) => {
    try {
      return closeSession(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to close session')
    }
  })

  ipcMain.handle('sessions:list', async (_, limit?: number, offset?: number) => {
    try {
      return listSessions(limit ?? 25, offset ?? 0)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list sessions')
    }
  })

  ipcMain.handle('sessions:report', async (_, sessionId: number) => {
    try {
      return generateClockOutReport(sessionId)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to generate report')
    }
  })

  ipcMain.handle('sessions:print-report', async (_, input: PrintClockOutReportInput) => {
    try {
      await printClockOutReport(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to print report')
    }
  })

  // Finix Payments
  ipcMain.handle('finix:devices:list', async () => {
    try {
      const config = getMerchantConfig()
      if (!config) throw new Error('Merchant not activated — cannot list devices')
      return await listDevices(
        config.finix_api_username,
        config.finix_api_password,
        config.merchant_id
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list devices')
    }
  })

  ipcMain.handle('finix:device:create', async (_, input: FinixCreateDeviceInput) => {
    try {
      const config = getMerchantConfig()
      if (!config) throw new Error('Merchant not activated — cannot create device')
      return await createDevice(
        config.finix_api_username,
        config.finix_api_password,
        config.merchant_id,
        input
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create device')
    }
  })

  // Phase A: manual card entry
  ipcMain.handle('finix:charge:card', async (_, input: FinixCardInput) => {
    try {
      const config = getMerchantConfig()
      if (!config) throw new Error('Merchant not activated — cannot process payments')
      return await chargeWithCard(
        config.finix_api_username,
        config.finix_api_password,
        config.merchant_id,
        input
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Payment failed')
    }
  })

  // Phase B: card-present via PAX terminal
  ipcMain.handle('finix:charge:terminal', async (_, input: FinixTerminalChargeInput) => {
    try {
      const config = getMerchantConfig()
      if (!config) throw new Error('Merchant not activated — cannot process payments')
      return await chargeTerminal(config.finix_api_username, config.finix_api_password, input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Payment failed')
    }
  })

  ipcMain.handle('finix:void:authorization', async (_, authorizationId: string) => {
    try {
      const config = getMerchantConfig()
      if (!config) throw new Error('Merchant not activated')
      await voidAuthorization(config.finix_api_username, config.finix_api_password, authorizationId)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to void authorization')
    }
  })

  ipcMain.handle('finix:refund:transfer', async (_, transferId: string, amountCents: number) => {
    try {
      const config = getMerchantConfig()
      if (!config) throw new Error('Merchant not activated')
      await refundTransfer(
        config.finix_api_username,
        config.finix_api_password,
        transferId,
        amountCents
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to refund transfer')
    }
  })

  ipcMain.handle('finix:provision-merchant', async (_, input: BusinessInfoInput) => {
    try {
      return await provisionFinixMerchant(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to provision merchant')
    }
  })

  // Auto-updater
  ipcMain.handle('updater:check', () => {
    checkForUpdates()
  })

  ipcMain.handle('updater:install', () => {
    installUpdate()
  })

  // Cash Drawer
  ipcMain.handle('peripheral:get-drawer-config', () => {
    return getCashDrawerConfig()
  })

  ipcMain.handle('peripheral:save-drawer-config', (_, config: CashDrawerConfig) => {
    saveCashDrawerConfig(config)
  })

  ipcMain.handle('peripheral:open-cash-drawer', async () => {
    const config = getEffectiveCashDrawerConfig()
    if (!config) {
      throw new Error('Cash drawer not configured — set an IP address in peripheral settings')
    }
    await openCashDrawer(config)
  })

  ipcMain.handle('peripheral:print-receipt', async (_, input: PrintReceiptInput) => {
    try {
      await printReceipt(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to print receipt')
    }
  })

  ipcMain.handle('peripheral:get-receipt-config', () => {
    return getReceiptConfig()
  })

  ipcMain.handle('peripheral:save-receipt-config', (_, config: ReceiptConfig) => {
    saveReceiptConfig(config)
  })

  ipcMain.handle('peripheral:get-receipt-printer-config', () => {
    return getReceiptPrinterConfig()
  })

  ipcMain.handle('peripheral:save-receipt-printer-config', (_, config: ReceiptPrinterConfig) => {
    saveReceiptPrinterConfig(config)
  })

  ipcMain.handle('peripheral:list-receipt-printers', async () => {
    return await listReceiptPrinters()
  })

  ipcMain.handle('peripheral:get-printer-status', async (_, printerName?: string) => {
    const resolvedPrinterName = printerName ?? getReceiptPrinterConfig()?.printerName ?? null
    if (!resolvedPrinterName) {
      return { connected: false, printerName: null }
    }
    const connected = await checkPrinterConnected(resolvedPrinterName)
    return { connected, printerName: resolvedPrinterName }
  })

  // ── Cloud Sync IPC ──

  ipcMain.handle('inventory:apply-tax-to-all', async (_, taxCodeId: number) => {
    try {
      const updated = applyTaxToAllProducts(taxCodeId)
      return { updated }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to apply tax')
    }
  })

  ipcMain.handle('sync:get-status', async () => {
    const stats = getQueueStats()
    return {
      online: isOnline(),
      pending_count: stats.pending + stats.in_flight,
      last_synced_at: getLastSyncedAt()
    }
  })

  ipcMain.handle('sync:get-initial-status', () => {
    return getInitialSyncStatus()
  })

  ipcMain.handle('sync:retry-initial-sync', async () => {
    try {
      const merchantCloudId = await getMerchantCloudId()
      if (!merchantCloudId) throw new Error('Not authenticated')
      const client = getSupabaseClient()
      runInitialSync(client, merchantCloudId).catch((err) => {
        console.error('[sync] Retry initial sync error:', err)
      })
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to retry initial sync')
    }
  })

  ipcMain.handle('sync:get-device-config', async () => {
    return getDeviceConfig()
  })

  // ── Reports IPC ──

  ipcMain.handle('reports:sales-summary', async (_, range: ReportDateRange) => {
    try {
      return getSalesSummary(range)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get sales summary')
    }
  })

  ipcMain.handle(
    'reports:product-sales',
    async (_, range: ReportDateRange, sortBy?: 'revenue' | 'quantity', limit?: number) => {
      try {
        return getProductSales(range, sortBy, limit)
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to get product sales')
      }
    }
  )

  ipcMain.handle('reports:category-sales', async (_, range: ReportDateRange) => {
    try {
      return getCategorySales(range)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get category sales')
    }
  })

  ipcMain.handle('reports:tax-summary', async (_, range: ReportDateRange) => {
    try {
      return getTaxSummary(range)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get tax summary')
    }
  })

  ipcMain.handle(
    'reports:comparison',
    async (_, rangeA: ReportDateRange, rangeB: ReportDateRange) => {
      try {
        return getComparisonData(rangeA, rangeB)
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to get comparison data')
      }
    }
  )

  ipcMain.handle('reports:cashier-sales', async (_, range: ReportDateRange) => {
    try {
      return getCashierSales(range)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get cashier sales')
    }
  })

  ipcMain.handle('reports:hourly-sales', async (_, range: ReportDateRange) => {
    try {
      return getHourlySales(range)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get hourly sales')
    }
  })

  ipcMain.handle('reports:export', async (_, request: ReportExportRequest) => {
    try {
      const merchantConfig = getMerchantConfig()
      const exportMetadata = {
        store_name:
          request.metadata?.store_name ??
          merchantConfig?.store_name ??
          merchantConfig?.merchant_name,
        merchant_name: request.metadata?.merchant_name ?? merchantConfig?.merchant_name,
        merchant_id: request.metadata?.merchant_id ?? merchantConfig?.merchant_id
      }

      let data
      switch (request.report_type) {
        case 'sales-summary':
          data = getSalesSummary(request.date_range)
          break
        case 'product-sales':
          data = getProductSales(request.date_range)
          break
        case 'category-sales':
          data = getCategorySales(request.date_range)
          break
        case 'tax-summary':
          data = getTaxSummary(request.date_range)
          break
        case 'transaction-list':
          data = getTransactionList(request.date_range)
          break
        case 'comparison':
          throw new Error('Use reports:comparison for comparison exports')
      }
      if (request.format === 'pdf') {
        return await exportToPdf(data, request.report_type, request.date_range, exportMetadata)
      } else {
        return await exportToCsv(data, request.report_type, request.date_range, exportMetadata)
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to export report')
    }
  })

  createWindow()

  // Forward connectivity changes to the renderer
  onConnectivityChange((online) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('sync:connectivity-changed', online)
  })

  // Push initial sync status changes to renderer
  setInitialSyncStatusCallback((status) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('sync:initial-status-changed', status)
  })

  // Start sync worker after a short delay to let auth settle
  setTimeout(async () => {
    try {
      const merchantCloudId = await getMerchantCloudId()
      if (!merchantCloudId) return // Not authenticated or no merchant record

      const client = getSupabaseClient()
      const deviceId = await registerDevice(client, merchantCloudId)
      startSyncWorker(client, merchantCloudId, deviceId)

      // Backfill device_id on transactions written before device registration
      backfillTransactionDeviceId(deviceId)

      // Run initial reconciliation for all entities after the worker is started
      // so the queue is already draining while we pull remote rows.
      runInitialSync(client, merchantCloudId).catch((err) => {
        console.error('[sync] Initial sync error:', err)
      })
    } catch (err) {
      console.error('[sync] Failed to start sync worker:', err)
    }
  }, 3000)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ── Deep link handler (email invite / password reset) ──
// Parses liquorpos://auth/callback#access_token=...&refresh_token=...
// and forwards to the renderer so it can show the set-password screen.

// Buffered deep-link URL for the cold-start race:
// open-url can fire before the window exists or before React has mounted.
// The renderer polls this via auth:consume-pending-deep-link on startup.
let pendingDeepLinkUrl: string | null = null

function handleDeepLink(url: string): void {
  console.log('[deep-link] handleDeepLink called with:', url)
  try {
    // Tokens are in the URL fragment, e.g. #access_token=x&refresh_token=y&type=invite
    const hash = url.split('#')[1] ?? ''
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type') // 'invite' | 'recovery' | 'signup'
    console.log(
      '[deep-link] parsed type:',
      type,
      'hasAccessToken:',
      !!accessToken,
      'hasRefreshToken:',
      !!refreshToken
    )

    // Always buffer the URL (success or error) so the renderer can handle it.
    pendingDeepLinkUrl = url

    if (!accessToken || !refreshToken) return // error URL — renderer will read the error

    // Also attempt an immediate push for the fully-running hot path.
    const win = BrowserWindow.getAllWindows()[0]
    console.log('[deep-link] window exists:', !!win)
    if (win) {
      win.webContents.send('auth:deep-link', { accessToken, refreshToken, type })
    }
  } catch (err) {
    console.error('[deep-link] error parsing URL:', err)
  }
}

// Register liquorpos:// as the app's URL scheme
app.setAsDefaultProtocolClient('liquorpos')

// macOS: app already running — fired when user clicks the link
app.on('open-url', (event, url) => {
  console.log('[deep-link] open-url event fired:', url)
  event.preventDefault()
  handleDeepLink(url)
})

// Windows/Linux: a second instance is launched with the URL as an argument
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith('liquorpos://'))
    if (url) handleDeepLink(url)
    // Focus the existing window
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

// IPC: renderer asks main to exchange tokens for a session
ipcMain.handle('auth:set-session', async (_, accessToken: string, refreshToken: string) => {
  try {
    return await supabaseSetSession(accessToken, refreshToken)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to set session')
  }
})

// IPC: renderer submits the new password after invite
ipcMain.handle('auth:set-password', async (_, password: string) => {
  try {
    return await supabaseSetPassword(password)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to set password')
  }
})

// Renderer calls this on startup to pick up any deep-link URL that arrived
// before the window was ready (cold-start race condition).
ipcMain.handle('auth:consume-pending-deep-link', () => {
  const url = pendingDeepLinkUrl
  pendingDeepLinkUrl = null
  return url
})

// ── Manager Modal IPC ──

// Registers (Supabase-backed)
ipcMain.handle('registers:list', async () => {
  try {
    const supabase = getSupabaseClient()
    const merchantCloudId = await getMerchantCloudId()
    if (!supabase || !merchantCloudId) throw new Error('Not connected to cloud')
    const rows = await listRegisters(supabase, merchantCloudId)
    const localConfig = getDeviceConfig()
    return rows.map((r) => ({ ...r, is_current: r.id === localConfig?.device_id }))
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to list registers')
  }
})

ipcMain.handle('registers:rename', async (_, id: string, newName: string) => {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Not connected to cloud')
    await renameRegister(supabase, id, newName)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to rename register')
  }
})

ipcMain.handle('registers:delete', async (_, id: string) => {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) throw new Error('Not connected to cloud')
    await deleteRegister(supabase, id)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete register')
  }
})

// Low-stock products
ipcMain.handle('inventory:low-stock', async (_, threshold: number) => {
  try {
    return getLowStockProducts(threshold)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to get low-stock products')
  }
})

// Unpriced products (active items with $0 price)
ipcMain.handle('inventory:unpriced-products', async () => {
  try {
    return getUnpricedInventoryProducts()
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to get unpriced products')
  }
})

// Find product by SKU/barcode/alt-SKU regardless of price (for scan fallback)
ipcMain.handle('inventory:find-by-sku', async (_, sku: string) => {
  try {
    return findProductBySku(sku)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to find product')
  }
})

// Toggle is_favorite flag on a product
ipcMain.handle('inventory:toggle-favorite', async (_, productId: number) => {
  try {
    toggleFavorite(productId)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to toggle favorite')
  }
})

// Get distinct sizes from local products table
ipcMain.handle('inventory:distinct-sizes', async () => {
  try {
    return getDistinctSizes()
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to get sizes')
  }
})

// Finix merchant status
ipcMain.handle('finix:merchant-status', async () => {
  try {
    const config = getMerchantConfig()
    if (!config) throw new Error('No merchant configured')
    return await verifyMerchant(
      config.finix_api_username,
      config.finix_api_password,
      config.merchant_id
    )
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to get merchant status')
  }
})

// ── Purchase Orders IPC ──

ipcMain.handle('purchase-orders:list', async () => {
  try {
    return getPurchaseOrders()
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to list purchase orders')
  }
})

ipcMain.handle('purchase-orders:detail', async (_, poId: number) => {
  try {
    return getPurchaseOrderDetail(poId)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to get purchase order')
  }
})

ipcMain.handle('purchase-orders:create', async (_, input: CreatePurchaseOrderInput) => {
  try {
    return createPurchaseOrder(input)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create purchase order')
  }
})

ipcMain.handle('purchase-orders:update', async (_, input: UpdatePurchaseOrderInput) => {
  try {
    return updatePurchaseOrder(input)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to update purchase order')
  }
})

ipcMain.handle('purchase-orders:receive-item', async (_, input: ReceivePurchaseOrderItemInput) => {
  try {
    return receivePurchaseOrderItem(input)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to receive item')
  }
})

ipcMain.handle(
  'purchase-orders:add-item',
  async (_, poId: number, productId: number, quantityOrdered: number) => {
    try {
      return addPurchaseOrderItem(poId, productId, quantityOrdered)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add item to order')
    }
  }
)

ipcMain.handle('purchase-orders:remove-item', async (_, poId: number, itemId: number) => {
  try {
    removePurchaseOrderItem(poId, itemId)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to remove item from order')
  }
})

ipcMain.handle('purchase-orders:delete', async (_, poId: number) => {
  try {
    deletePurchaseOrder(poId)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete purchase order')
  }
})

// Zoom — set/get via webContents so it matches Cmd+= / Cmd+- / Cmd+0
ipcMain.handle('zoom:get', (event) => event.sender.getZoomFactor())
ipcMain.handle('zoom:set', (event, factor: number) => {
  event.sender.setZoomFactor(Math.min(2.0, Math.max(0.5, factor)))
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopSyncWorker()
  stopConnectivityMonitor()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
