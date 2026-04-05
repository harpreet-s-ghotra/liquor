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
  applyTaxToAllProducts
} from './database'
import {
  validateApiKey,
  getTerminalRegisters,
  chargeTerminal,
  chargeWithCard
} from './services/stax'
import {
  initializeSupabaseService,
  supabaseSignIn,
  supabaseSignOut,
  supabaseCheckSession,
  supabaseSetSession,
  supabaseSetPassword,
  getCatalogDistributors,
  getCatalogProductsByDistributors
} from './services/supabase'
import { getDb } from './database/connection'
import {
  openCashDrawer,
  getCashDrawerConfig,
  saveCashDrawerConfig,
  getReceiptConfig,
  saveReceiptConfig,
  checkPrinterConnected
} from './services/cash-drawer'
import type { CashDrawerConfig } from './services/cash-drawer'
import { printReceipt, printClockOutReport } from './services/receipt-printer'
import {
  startConnectivityMonitor,
  stopConnectivityMonitor,
  isOnline,
  onConnectivityChange
} from './services/connectivity'
import { registerDevice } from './services/device-registration'
import { getSupabaseClient, getMerchantCloudId } from './services/supabase'
import { getLastSyncedAt, startSyncWorker, stopSyncWorker } from './services/sync-worker'
import { runInitialSync } from './services/sync/initial-sync'
import { getDeviceConfig } from './database/device-config.repo'
import { getQueueStats } from './database/sync-queue.repo'
import type {
  DirectChargeInput,
  TerminalChargeInput,
  SaveTransactionInput,
  SaveRefundInput,
  SaveHeldTransactionInput,
  SearchProductFilters,
  TransactionListFilter,
  PrintReceiptInput,
  ReceiptConfig,
  CreateSessionInput,
  CloseSessionInput,
  PrintClockOutReportInput
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

  ipcMain.handle('merchant:activate', async (_, apiKey: string) => {
    try {
      const paymentInfo = await validateApiKey(apiKey)
      return saveMerchantConfig({
        payment_processing_api_key: apiKey,
        merchant_id: paymentInfo.merchant_id,
        merchant_name: paymentInfo.company_name
      })
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to activate merchant')
    }
  })

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
      return createCashier(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create cashier')
    }
  })

  ipcMain.handle('cashiers:validate-pin', async (_, pin: string) => {
    try {
      return validatePin(pin)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to validate PIN')
    }
  })

  ipcMain.handle('cashiers:update', async (_, input) => {
    try {
      return updateCashier(input)
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

  // Stax Terminal Payments
  ipcMain.handle('stax:terminal:registers', async () => {
    try {
      const config = getMerchantConfig()
      if (!config) {
        throw new Error('Merchant not activated — cannot list terminals')
      }
      return await getTerminalRegisters(config.payment_processing_api_key)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to get terminals')
    }
  })

  ipcMain.handle('stax:terminal:charge', async (_, input: TerminalChargeInput) => {
    try {
      const config = getMerchantConfig()
      if (!config) {
        throw new Error('Merchant not activated — cannot process payments')
      }
      return await chargeTerminal(config.payment_processing_api_key, input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Payment failed')
    }
  })

  // Direct API charge — Phase A (pre-hardware testing, keyed-entry)
  ipcMain.handle('stax:charge:direct', async (_, input: DirectChargeInput) => {
    try {
      const config = getMerchantConfig()
      if (!config) {
        throw new Error('Merchant not activated — cannot process payments')
      }
      return await chargeWithCard(config.payment_processing_api_key, input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Payment failed')
    }
  })

  // Cash Drawer
  ipcMain.handle('peripheral:get-drawer-config', () => {
    return getCashDrawerConfig()
  })

  ipcMain.handle('peripheral:save-drawer-config', (_, config: CashDrawerConfig) => {
    saveCashDrawerConfig(config)
  })

  ipcMain.handle('peripheral:open-cash-drawer', async () => {
    const config = getCashDrawerConfig()
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

  ipcMain.handle('peripheral:get-printer-status', async () => {
    const config = getCashDrawerConfig()
    if (!config || config.type !== 'usb') {
      return { connected: false, printerName: null }
    }
    const connected = await checkPrinterConnected(config.printerName)
    return { connected, printerName: config.printerName }
  })

  // ── Cloud Sync IPC ──

  ipcMain.handle('inventory:apply-tax-to-all', async (_, taxRate: number) => {
    try {
      const updated = applyTaxToAllProducts(taxRate)
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

  ipcMain.handle('sync:get-device-config', async () => {
    return getDeviceConfig()
  })

  createWindow()

  // Forward connectivity changes to the renderer
  onConnectivityChange((online) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('sync:connectivity-changed', online)
  })

  // Start sync worker after a short delay to let auth settle
  setTimeout(async () => {
    try {
      const merchantCloudId = await getMerchantCloudId()
      if (!merchantCloudId) return // Not authenticated or no merchant record

      const client = getSupabaseClient()
      const deviceId = await registerDevice(client, merchantCloudId)
      startSyncWorker(client, merchantCloudId, deviceId)

      // Run initial product reconciliation after the worker is started so the
      // queue is already draining while we pull remote rows.
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

function handleDeepLink(url: string): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  try {
    // Tokens are in the URL fragment, e.g. #access_token=x&refresh_token=y&type=invite
    const hash = url.split('#')[1] ?? ''
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type') // 'invite' | 'recovery' | 'signup'
    if (accessToken && refreshToken) {
      win.webContents.send('auth:deep-link', { accessToken, refreshToken, type })
    }
  } catch {
    // malformed URL — ignore
  }
}

// Register liquorpos:// as the app's URL scheme
app.setAsDefaultProtocolClient('liquorpos')

// macOS: app already running — fired when user clicks the link
app.on('open-url', (event, url) => {
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
