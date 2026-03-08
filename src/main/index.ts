import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  getInventoryDepartments,
  getInventoryProductDetail,
  getInventoryProducts,
  getInventoryTaxCodes,
  getProducts,
  initializeDatabase,
  saveInventoryItem,
  searchInventoryProducts,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getTaxCodes,
  createTaxCode,
  updateTaxCode,
  deleteTaxCode,
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  getMerchantConfig,
  saveMerchantConfig,
  clearMerchantConfig,
  getCashiers,
  createCashier,
  validatePin,
  updateCashier,
  deleteCashier
} from './database'
import { validateApiKey } from './services/stax'

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
  initializeDatabase(app.getPath('userData'))

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

  ipcMain.handle('inventory:departments:list', async () => {
    try {
      return getInventoryDepartments()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list departments')
    }
  })

  ipcMain.handle('inventory:tax-codes:list', async () => {
    try {
      return getInventoryTaxCodes()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list tax codes')
    }
  })

  // Department CRUD
  ipcMain.handle('departments:list', async () => {
    try {
      return getDepartments()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list departments')
    }
  })

  ipcMain.handle('departments:create', async (_, input) => {
    try {
      return createDepartment(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create department')
    }
  })

  ipcMain.handle('departments:update', async (_, input) => {
    try {
      return updateDepartment(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update department')
    }
  })

  ipcMain.handle('departments:delete', async (_, id: number) => {
    try {
      return deleteDepartment(id)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete department')
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

  // Vendor CRUD
  ipcMain.handle('vendors:list', async () => {
    try {
      return getVendors()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to list vendors')
    }
  })

  ipcMain.handle('vendors:create', async (_, input) => {
    try {
      return createVendor(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create vendor')
    }
  })

  ipcMain.handle('vendors:update', async (_, input) => {
    try {
      return updateVendor(input)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update vendor')
    }
  })

  ipcMain.handle('vendors:delete', async (_, vendorNumber: number) => {
    try {
      return deleteVendor(vendorNumber)
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete vendor')
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
      const staxInfo = await validateApiKey(apiKey)
      return saveMerchantConfig({
        stax_api_key: apiKey,
        merchant_id: staxInfo.merchant_id,
        merchant_name: staxInfo.company_name
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

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
