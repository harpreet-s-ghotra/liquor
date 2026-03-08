/**
 * Database module barrel - re-exports everything that main/index.ts needs.
 *
 * Internal modules:
 *   connection.ts    - singleton DB handle, ensureColumn helper
 *   schema.ts        - initializeDatabase (DDL + migrations)
 *   seed.ts          - initial data seeding
 *   products.repo.ts - product / inventory queries & writes
 *   departments.repo.ts - department CRUD
 *   tax-codes.repo.ts   - tax code CRUD
 *   vendors.repo.ts     - vendor CRUD
 */

// Schema / lifecycle
export { initializeDatabase } from './schema'

// Products & inventory
export {
  getProducts,
  getInventoryProducts,
  getInventoryDepartments,
  getInventoryTaxCodes,
  searchInventoryProducts,
  getInventoryProductDetail,
  saveInventoryItem
} from './products.repo'

// Departments
export {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from './departments.repo'

// Tax codes
export { getTaxCodes, createTaxCode, updateTaxCode, deleteTaxCode } from './tax-codes.repo'

// Vendors
export { getVendors, createVendor, updateVendor, deleteVendor } from './vendors.repo'

// Merchant config
export { getMerchantConfig, saveMerchantConfig, clearMerchantConfig } from './merchant-config.repo'

// Cashiers
export {
  getCashiers,
  createCashier,
  validatePin,
  updateCashier,
  deleteCashier
} from './cashiers.repo'

// Re-export shared types so existing consumers (main/index.ts) don't break
export type {
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
  SaveMerchantConfigInput,
  Cashier,
  CreateCashierInput,
  UpdateCashierInput
} from '../../shared/types'
