import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Product,
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
  UpdateVendorInput
} from '../shared/types'

// Custom APIs for renderer
const api = {
  getProducts: (): Promise<Product[]> => ipcRenderer.invoke('products:list'),
  getInventoryProducts: (): Promise<InventoryProduct[]> =>
    ipcRenderer.invoke('inventory:products:list'),
  searchInventoryProducts: (query: string): Promise<InventoryProduct[]> =>
    ipcRenderer.invoke('inventory:products:search', query),
  getInventoryProductDetail: (itemNumber: number): Promise<InventoryProductDetail | null> =>
    ipcRenderer.invoke('inventory:products:detail', itemNumber),
  saveInventoryItem: (payload: SaveInventoryItemInput): Promise<InventoryProductDetail> =>
    ipcRenderer.invoke('inventory:products:save', payload),
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
    ipcRenderer.invoke('vendors:delete', vendorNumber)
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
