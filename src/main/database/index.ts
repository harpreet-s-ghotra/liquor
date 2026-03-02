import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'
import type {
  Product,
  InventoryProduct,
  InventorySalesHistory,
  SpecialPricingRule,
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
} from '../../shared/types'
import {
  SKU_PATTERN,
  SKU_MAX_LENGTH,
  NAME_MAX_LENGTH,
  DEPARTMENT_NAME_MAX_LENGTH,
  TAX_CODE_MAX_LENGTH
} from '../../shared/constants'

// Re-export shared types so existing consumers don't break
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
  UpdateVendorInput
} from '../../shared/types'

let database: Database.Database | null = null

function ensureColumn(tableName: string, columnName: string, columnDefinition: string): void {
  const db = ensureDatabase()
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>

  if (columns.some((column) => column.name === columnName)) {
    return
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`)
}

function ensureDatabase(): Database.Database {
  if (!database) {
    throw new Error('Database has not been initialized')
  }

  return database
}

export function initializeDatabase(userDataPath: string): void {
  const dataDir = join(userDataPath, 'data')
  mkdirSync(dataDir, { recursive: true })

  const dbPath = join(dataDir, 'liquor-pos.db')
  database = new Database(dbPath)

  database.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      vendor_number INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL,
      quantity INTEGER DEFAULT 0,
      barcode TEXT,
      tax_rate REAL DEFAULT 0,
      dept_id TEXT,
      category_id INTEGER,
      category_name TEXT,
      retail_price REAL,
      in_stock INTEGER,
      tax_1 REAL,
      tax_2 REAL,
      vendor_number INTEGER,
      bottles_per_case INTEGER DEFAULT 12,
      special_pricing_enabled INTEGER DEFAULT 0,
      special_price REAL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_number) REFERENCES vendors(vendor_number)
    );

    CREATE TABLE IF NOT EXISTS product_alt_skus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      alt_sku TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, alt_sku),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS special_pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_number TEXT UNIQUE NOT NULL,
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tax_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      rate REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  ensureColumn('products', 'dept_id', 'dept_id TEXT')
  ensureColumn('products', 'category_id', 'category_id INTEGER')
  ensureColumn('products', 'category_name', 'category_name TEXT')
  ensureColumn('products', 'retail_price', 'retail_price REAL')
  ensureColumn('products', 'in_stock', 'in_stock INTEGER')
  ensureColumn('products', 'tax_1', 'tax_1 REAL')
  ensureColumn('products', 'tax_2', 'tax_2 REAL')
  ensureColumn('products', 'vendor_number', 'vendor_number INTEGER')
  ensureColumn('products', 'bottles_per_case', 'bottles_per_case INTEGER DEFAULT 12')
  ensureColumn('products', 'special_pricing_enabled', 'special_pricing_enabled INTEGER DEFAULT 0')
  ensureColumn('products', 'special_price', 'special_price REAL')

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_vendor_number ON products(vendor_number);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_product_id ON product_alt_skus(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_alt_sku ON product_alt_skus(alt_sku);
    CREATE INDEX IF NOT EXISTS idx_special_pricing_product_id ON special_pricing(product_id);
  `)

  database.exec(`
    UPDATE products
    SET
      retail_price = COALESCE(retail_price, price),
      in_stock = COALESCE(in_stock, quantity),
      tax_1 = COALESCE(tax_1, tax_rate),
      tax_2 = COALESCE(tax_2, 0),
      category_name = COALESCE(category_name, category),
      bottles_per_case = COALESCE(bottles_per_case, 12)
  `)

  const vendorCount = database.prepare('SELECT COUNT(*) AS count FROM vendors').get() as {
    count: number
  }

  if (vendorCount.count === 0) {
    database
      .prepare(
        `
        INSERT INTO vendors (vendor_name, contact_name)
        VALUES ('Default Vendor', 'Unassigned')
        `
      )
      .run()
  }

  const productCount = database.prepare('SELECT COUNT(*) AS count FROM products').get() as {
    count: number
  }

  if (productCount.count === 0) {
    const insertProduct = database.prepare(
      `
      INSERT INTO products (
        sku,
        name,
        description,
        category,
        price,
        cost,
        quantity,
        barcode,
        tax_rate,
        dept_id,
        category_id,
        category_name,
        retail_price,
        in_stock,
        tax_1,
        tax_2,
        vendor_number,
        bottles_per_case
      )
      VALUES (
        @sku,
        @name,
        @description,
        @category,
        @price,
        @cost,
        @quantity,
        @barcode,
        @tax_rate,
        @dept_id,
        @category_id,
        @category_name,
        @retail_price,
        @in_stock,
        @tax_1,
        @tax_2,
        @vendor_number,
        @bottles_per_case
      )
      `
    )

    const seedProducts = [
      {
        sku: 'WINE-001',
        name: 'Cabernet Sauvignon 750ml',
        description: 'Dry red wine',
        category: 'Wine',
        price: 19.99,
        cost: 12.5,
        quantity: 24,
        barcode: '000111222333',
        tax_rate: 0.13,
        dept_id: 'WINE',
        category_id: 10,
        category_name: 'Wine',
        retail_price: 19.99,
        in_stock: 24,
        tax_1: 0.13,
        tax_2: 0,
        vendor_number: 1,
        bottles_per_case: 12
      },
      {
        sku: 'BEER-001',
        name: 'Craft IPA 6-Pack',
        description: 'Hoppy India Pale Ale',
        category: 'Beer',
        price: 13.49,
        cost: 8.25,
        quantity: 40,
        barcode: '000111222334',
        tax_rate: 0.13,
        dept_id: 'BEER',
        category_id: 20,
        category_name: 'Beer',
        retail_price: 13.49,
        in_stock: 40,
        tax_1: 0.13,
        tax_2: 0,
        vendor_number: 1,
        bottles_per_case: 6
      },
      {
        sku: 'SPIRIT-001',
        name: 'Premium Vodka 1L',
        description: 'Imported vodka',
        category: 'Spirits',
        price: 32.99,
        cost: 21,
        quantity: 18,
        barcode: '000111222335',
        tax_rate: 0.13,
        dept_id: 'SPIRITS',
        category_id: 30,
        category_name: 'Spirits',
        retail_price: 32.99,
        in_stock: 18,
        tax_1: 0.13,
        tax_2: 0,
        vendor_number: 1,
        bottles_per_case: 12
      },
      {
        sku: 'COOLER-001',
        name: 'Vodka Soda 473ml',
        description: 'Ready-to-drink cooler',
        category: 'Coolers',
        price: 4.25,
        cost: 2.5,
        quantity: 96,
        barcode: '000111222336',
        tax_rate: 0.13,
        dept_id: 'COOLERS',
        category_id: 40,
        category_name: 'Coolers',
        retail_price: 4.25,
        in_stock: 96,
        tax_1: 0.13,
        tax_2: 0,
        vendor_number: 1,
        bottles_per_case: 12
      },
      {
        sku: 'MIXER-001',
        name: 'Tonic Water 1L',
        description: 'Carbonated mixer',
        category: 'Mixers',
        price: 2.99,
        cost: 1.6,
        quantity: 52,
        barcode: '000111222337',
        tax_rate: 0.13,
        dept_id: 'MIXERS',
        category_id: 50,
        category_name: 'Mixers',
        retail_price: 2.99,
        in_stock: 52,
        tax_1: 0.13,
        tax_2: 0,
        vendor_number: 1,
        bottles_per_case: 12
      }
    ]

    const insertMany = database.transaction((items: typeof seedProducts) => {
      for (const item of items) {
        insertProduct.run(item)
      }
    })

    insertMany(seedProducts)
  }
}

export function getProducts(): Product[] {
  return ensureDatabase()
    .prepare(
      `
      SELECT
        id,
        sku,
        name,
        category,
        COALESCE(retail_price, price) AS price,
        COALESCE(in_stock, quantity) AS quantity,
        COALESCE(tax_1, tax_rate) AS tax_rate
      FROM products
      WHERE is_active = 1
      ORDER BY name
      `
    )
    .all() as Product[]
}

export function getInventoryProducts(): InventoryProduct[] {
  return ensureDatabase()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.dept_id,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price) AS retail_price,
        COALESCE(products.in_stock, products.quantity, 0) AS in_stock,
        COALESCE(products.tax_1, products.tax_rate, 0) AS tax_1,
        COALESCE(products.tax_2, 0) AS tax_2,
        products.vendor_number,
        vendors.vendor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active
      FROM products
      LEFT JOIN vendors ON vendors.vendor_number = products.vendor_number
      ORDER BY products.id
      `
    )
    .all() as InventoryProduct[]
}

function normalizeTaxRate(value: number): number {
  return Number(value.toFixed(4))
}

export function getInventoryDepartments(): string[] {
  return ensureDatabase()
    .prepare(
      `
      SELECT name
      FROM departments
      ORDER BY name
      `
    )
    .all()
    .map((row) => String((row as { name: string }).name))
}

export function getInventoryTaxCodes(): InventoryTaxCode[] {
  return ensureDatabase()
    .prepare(
      `
      SELECT code, rate
      FROM tax_codes
      ORDER BY rate
      `
    )
    .all() as InventoryTaxCode[]
}

export function searchInventoryProducts(query: string): InventoryProduct[] {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return getInventoryProducts()
  }

  return ensureDatabase()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.dept_id,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price) AS retail_price,
        COALESCE(products.in_stock, products.quantity, 0) AS in_stock,
        COALESCE(products.tax_1, products.tax_rate, 0) AS tax_1,
        COALESCE(products.tax_2, 0) AS tax_2,
        products.vendor_number,
        vendors.vendor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active
      FROM products
      LEFT JOIN vendors ON vendors.vendor_number = products.vendor_number
      WHERE products.sku LIKE @likeQuery OR products.name LIKE @likeQuery
      ORDER BY products.id
      `
    )
    .all({ likeQuery: `%${normalizedQuery}%` }) as InventoryProduct[]
}

export function getInventoryProductDetail(itemNumber: number): InventoryProductDetail | null {
  const product = ensureDatabase()
    .prepare(
      `
      SELECT
        products.id AS item_number,
        products.sku,
        products.name AS item_name,
        products.dept_id,
        products.category_id,
        products.category_name,
        COALESCE(products.cost, 0) AS cost,
        COALESCE(products.retail_price, products.price) AS retail_price,
        COALESCE(products.in_stock, products.quantity, 0) AS in_stock,
        COALESCE(products.tax_1, products.tax_rate, 0) AS tax_1,
        COALESCE(products.tax_2, 0) AS tax_2,
        products.vendor_number,
        vendors.vendor_name,
        COALESCE(products.bottles_per_case, 12) AS bottles_per_case,
        products.barcode,
        products.description,
        COALESCE(products.special_pricing_enabled, 0) AS special_pricing_enabled,
        products.special_price,
        products.is_active
      FROM products
      LEFT JOIN vendors ON vendors.vendor_number = products.vendor_number
      WHERE products.id = ?
      `
    )
    .get(itemNumber) as InventoryProduct | undefined

  if (!product) {
    return null
  }

  const additionalSkus = ensureDatabase()
    .prepare(
      `
      SELECT alt_sku
      FROM product_alt_skus
      WHERE product_id = ?
      ORDER BY alt_sku
      `
    )
    .all(itemNumber) as Array<{ alt_sku: string }>

  const taxRates = Array.from(
    new Set(
      [product.tax_1, product.tax_2]
        .filter((taxRate) => Number.isFinite(taxRate) && taxRate >= 0)
        .map((taxRate) => normalizeTaxRate(taxRate))
    )
  )

  const salesHistory = ensureDatabase()
    .prepare(
      `
      SELECT
        transaction_items.transaction_id,
        transactions.created_at,
        transaction_items.quantity,
        transaction_items.unit_price,
        transaction_items.total_price
      FROM transaction_items
      INNER JOIN transactions ON transactions.id = transaction_items.transaction_id
      WHERE transaction_items.product_id = ?
      ORDER BY transactions.created_at DESC
      LIMIT 20
      `
    )
    .all(itemNumber) as InventorySalesHistory[]

  const specialPricing = ensureDatabase()
    .prepare(
      `
      SELECT quantity, price, duration_days
      FROM special_pricing
      WHERE product_id = ?
      ORDER BY quantity
      `
    )
    .all(itemNumber) as SpecialPricingRule[]

  return {
    ...product,
    tax_rates: taxRates,
    additional_skus: additionalSkus.map((item) => item.alt_sku),
    sales_history: salesHistory,
    special_pricing: specialPricing
  }
}

export function saveInventoryItem(input: SaveInventoryItemInput): InventoryProductDetail {
  const db = ensureDatabase()

  const normalizedSku = input.sku.trim()
  const normalizedName = input.item_name.trim()
  const normalizedDept = input.dept_id.trim()

  if (!normalizedSku) {
    throw new Error('SKU is required')
  }

  if (!SKU_PATTERN.test(normalizedSku)) {
    throw new Error('SKU must contain only letters, numbers, and hyphens')
  }

  if (!normalizedName) {
    throw new Error('Name is required')
  }

  if (!normalizedDept) {
    throw new Error('Department is required')
  }

  if (normalizedSku.length > SKU_MAX_LENGTH) {
    throw new Error(`SKU must be ${SKU_MAX_LENGTH} characters or less`)
  }

  if (normalizedName.length > NAME_MAX_LENGTH) {
    throw new Error(`Name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  if (!Number.isFinite(input.cost) || input.cost < 0) {
    throw new Error('Cost must be a non-negative number')
  }

  if (!Number.isFinite(input.retail_price) || input.retail_price < 0) {
    throw new Error('Price must be a non-negative number')
  }

  if (!Number.isInteger(input.in_stock)) {
    throw new Error('In stock must be an integer')
  }

  if (!Array.isArray(input.tax_rates) || input.tax_rates.length === 0) {
    throw new Error('At least one tax code must be selected')
  }

  if (
    input.special_pricing.some(
      (rule) =>
        !Number.isInteger(rule.quantity) ||
        rule.quantity < 1 ||
        !Number.isFinite(rule.price) ||
        rule.price < 0 ||
        !Number.isInteger(rule.duration_days) ||
        rule.duration_days < 1
    )
  ) {
    throw new Error('Special pricing rules must have valid quantity, price, and duration')
  }

  const allowedDepartments = new Set(getInventoryDepartments())
  const deptParts = normalizedDept
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
  if (deptParts.length === 0) {
    throw new Error('Department is required')
  }
  for (const part of deptParts) {
    if (!allowedDepartments.has(part)) {
      throw new Error('Department must be selected from available departments')
    }
  }

  const allowedTaxRates = new Set(getInventoryTaxCodes().map((code) => normalizeTaxRate(code.rate)))
  const normalizedTaxRates = Array.from(
    new Set(
      input.tax_rates
        .filter((taxRate) => Number.isFinite(taxRate) && taxRate >= 0)
        .map((taxRate) => normalizeTaxRate(taxRate))
    )
  )

  if (normalizedTaxRates.length === 0) {
    throw new Error('At least one tax code must be selected')
  }

  if (normalizedTaxRates.some((taxRate) => !allowedTaxRates.has(taxRate))) {
    throw new Error('Tax codes must be selected from available backend tax codes')
  }

  const duplicateSku = db
    .prepare(
      `
      SELECT id
      FROM products
      WHERE sku = @sku
        AND (@item_number IS NULL OR id != @item_number)
      LIMIT 1
      `
    )
    .get({ sku: normalizedSku, item_number: input.item_number ?? null }) as
    | { id: number }
    | undefined

  if (duplicateSku) {
    throw new Error('SKU already exists')
  }

  const normalizedAdditionalSkus = Array.from(
    new Set(
      input.additional_skus.map((sku) => sku.trim()).filter((sku) => sku && sku !== normalizedSku)
    )
  )

  const tx = db.transaction((payload: SaveInventoryItemInput) => {
    const primaryTaxRate = normalizedTaxRates[0] ?? 0
    const secondaryTaxRate = normalizedTaxRates[1] ?? 0
    const hasSpecialPricing = payload.special_pricing.length > 0

    const statementPayload = {
      sku: normalizedSku,
      name: normalizedName,
      dept_id: normalizedDept,
      cost: payload.cost,
      retail_price: payload.retail_price,
      in_stock: payload.in_stock,
      tax_1: primaryTaxRate,
      tax_2: secondaryTaxRate,
      special_pricing_enabled: hasSpecialPricing ? 1 : 0,
      special_price: hasSpecialPricing ? payload.special_pricing[0].price : null,
      category: deptParts[0],
      quantity: payload.in_stock,
      vendor_number: payload.vendor_number
    }

    let productId = payload.item_number

    if (productId) {
      db.prepare(
        `
        UPDATE products
        SET
          sku = @sku,
          name = @name,
          dept_id = @dept_id,
          category = @category,
          cost = @cost,
          price = @retail_price,
          retail_price = @retail_price,
          quantity = @quantity,
          in_stock = @in_stock,
          tax_rate = @tax_1,
          tax_1 = @tax_1,
          tax_2 = @tax_2,
          special_pricing_enabled = @special_pricing_enabled,
          special_price = @special_price,
          vendor_number = @vendor_number,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
        `
      ).run({ ...statementPayload, id: productId })
    } else {
      const result = db
        .prepare(
          `
          INSERT INTO products (
            sku,
            name,
            category,
            price,
            cost,
            quantity,
            tax_rate,
            dept_id,
            retail_price,
            in_stock,
            tax_1,
            tax_2,
            special_pricing_enabled,
            special_price,
            vendor_number
          )
          VALUES (
            @sku,
            @name,
            @category,
            @retail_price,
            @cost,
            @quantity,
            @tax_1,
            @dept_id,
            @retail_price,
            @in_stock,
            @tax_1,
            @tax_2,
            @special_pricing_enabled,
            @special_price,
            @vendor_number
          )
          `
        )
        .run(statementPayload)

      productId = Number(result.lastInsertRowid)
    }

    db.prepare('DELETE FROM product_alt_skus WHERE product_id = ?').run(productId)

    const insertAltSku = db.prepare(
      `
      INSERT INTO product_alt_skus (product_id, alt_sku)
      VALUES (?, ?)
      `
    )

    for (const additionalSku of normalizedAdditionalSkus) {
      insertAltSku.run(productId, additionalSku)
    }

    // Save special pricing rules
    db.prepare('DELETE FROM special_pricing WHERE product_id = ?').run(productId)

    const insertPricingRule = db.prepare(
      `
      INSERT INTO special_pricing (product_id, quantity, price, duration_days)
      VALUES (?, ?, ?, ?)
      `
    )

    for (const rule of payload.special_pricing) {
      insertPricingRule.run(productId, rule.quantity, rule.price, rule.duration_days)
    }

    return productId
  })

  const productId = tx(input)
  const detail = getInventoryProductDetail(productId)

  if (!detail) {
    throw new Error('Failed to load saved inventory item')
  }

  return detail
}

// ── Department CRUD ──

export function getDepartments(): Department[] {
  return ensureDatabase()
    .prepare('SELECT id, name FROM departments ORDER BY name')
    .all() as Department[]
}

export function createDepartment(input: CreateDepartmentInput): Department {
  const db = ensureDatabase()
  const name = input.name.trim()

  if (!name) {
    throw new Error('Department name is required')
  }

  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name) as
    | { id: number }
    | undefined

  if (existing) {
    throw new Error('Department already exists')
  }

  const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name)
  return { id: Number(result.lastInsertRowid), name }
}

export function updateDepartment(input: UpdateDepartmentInput): Department {
  const db = ensureDatabase()
  const name = input.name.trim()

  if (!name) {
    throw new Error('Department name is required')
  }

  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    throw new Error(`Department name must be ${DEPARTMENT_NAME_MAX_LENGTH} characters or less`)
  }

  const duplicate = db
    .prepare('SELECT id FROM departments WHERE name = ? AND id != ?')
    .get(name, input.id) as { id: number } | undefined

  if (duplicate) {
    throw new Error('Department already exists')
  }

  const current = db.prepare('SELECT name FROM departments WHERE id = ?').get(input.id) as
    | { name: string }
    | undefined

  if (!current) {
    throw new Error('Department not found')
  }

  db.prepare('UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    name,
    input.id
  )

  // Update products that reference the old department name
  db.prepare('UPDATE products SET dept_id = ? WHERE dept_id = ?').run(name, current.name)

  return { id: input.id, name }
}

export function deleteDepartment(id: number): void {
  const db = ensureDatabase()

  const dept = db.prepare('SELECT name FROM departments WHERE id = ?').get(id) as
    | { name: string }
    | undefined

  if (!dept) {
    throw new Error('Department not found')
  }

  const productCount = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE dept_id = ?')
    .get(dept.name) as { count: number }

  if (productCount.count > 0) {
    throw new Error('Cannot delete department that is assigned to products')
  }

  db.prepare('DELETE FROM departments WHERE id = ?').run(id)
}

// ── Tax Code CRUD ──

export function getTaxCodes(): TaxCode[] {
  return ensureDatabase()
    .prepare('SELECT id, code, rate FROM tax_codes ORDER BY rate')
    .all() as TaxCode[]
}

export function createTaxCode(input: CreateTaxCodeInput): TaxCode {
  const db = ensureDatabase()
  const code = input.code.trim()

  if (!code) {
    throw new Error('Tax code name is required')
  }

  if (code.length > TAX_CODE_MAX_LENGTH) {
    throw new Error(`Tax code name must be ${TAX_CODE_MAX_LENGTH} characters or less`)
  }

  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1) {
    throw new Error('Tax rate must be between 0 and 1')
  }

  const existing = db.prepare('SELECT id FROM tax_codes WHERE code = ?').get(code) as
    | { id: number }
    | undefined

  if (existing) {
    throw new Error('Tax code already exists')
  }

  const rate = normalizeTaxRate(input.rate)
  const result = db.prepare('INSERT INTO tax_codes (code, rate) VALUES (?, ?)').run(code, rate)
  return { id: Number(result.lastInsertRowid), code, rate }
}

export function updateTaxCode(input: UpdateTaxCodeInput): TaxCode {
  const db = ensureDatabase()
  const code = input.code.trim()

  if (!code) {
    throw new Error('Tax code name is required')
  }

  if (code.length > TAX_CODE_MAX_LENGTH) {
    throw new Error(`Tax code name must be ${TAX_CODE_MAX_LENGTH} characters or less`)
  }

  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1) {
    throw new Error('Tax rate must be between 0 and 1')
  }

  const duplicate = db
    .prepare('SELECT id FROM tax_codes WHERE code = ? AND id != ?')
    .get(code, input.id) as { id: number } | undefined

  if (duplicate) {
    throw new Error('Tax code already exists')
  }

  const rate = normalizeTaxRate(input.rate)
  db.prepare(
    'UPDATE tax_codes SET code = ?, rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(code, rate, input.id)

  return { id: input.id, code, rate }
}

export function deleteTaxCode(id: number): void {
  const db = ensureDatabase()

  const taxCode = db.prepare('SELECT id FROM tax_codes WHERE id = ?').get(id) as
    | { id: number }
    | undefined

  if (!taxCode) {
    throw new Error('Tax code not found')
  }

  db.prepare('DELETE FROM tax_codes WHERE id = ?').run(id)
}

// ── Vendor CRUD ──

export function getVendors(): Vendor[] {
  return ensureDatabase()
    .prepare(
      `
      SELECT vendor_number, vendor_name, contact_name, phone, email, is_active
      FROM vendors
      ORDER BY vendor_name
      `
    )
    .all() as Vendor[]
}

export function createVendor(input: CreateVendorInput): Vendor {
  const db = ensureDatabase()
  const vendorName = input.vendor_name.trim()

  if (!vendorName) {
    throw new Error('Vendor name is required')
  }

  if (vendorName.length > NAME_MAX_LENGTH) {
    throw new Error(`Vendor name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const result = db
    .prepare(
      `
      INSERT INTO vendors (vendor_name, contact_name, phone, email)
      VALUES (?, ?, ?, ?)
      `
    )
    .run(vendorName, input.contact_name ?? null, input.phone ?? null, input.email ?? null)

  return {
    vendor_number: Number(result.lastInsertRowid),
    vendor_name: vendorName,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    is_active: 1
  }
}

export function updateVendor(input: UpdateVendorInput): Vendor {
  const db = ensureDatabase()
  const vendorName = input.vendor_name.trim()

  if (!vendorName) {
    throw new Error('Vendor name is required')
  }

  if (vendorName.length > NAME_MAX_LENGTH) {
    throw new Error(`Vendor name must be ${NAME_MAX_LENGTH} characters or less`)
  }

  const existing = db
    .prepare('SELECT vendor_number FROM vendors WHERE vendor_number = ?')
    .get(input.vendor_number) as { vendor_number: number } | undefined

  if (!existing) {
    throw new Error('Vendor not found')
  }

  db.prepare(
    `
    UPDATE vendors
    SET vendor_name = ?, contact_name = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE vendor_number = ?
    `
  ).run(
    vendorName,
    input.contact_name ?? null,
    input.phone ?? null,
    input.email ?? null,
    input.vendor_number
  )

  return {
    vendor_number: input.vendor_number,
    vendor_name: vendorName,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    is_active: 1
  }
}

export function deleteVendor(vendorNumber: number): void {
  const db = ensureDatabase()

  const existing = db
    .prepare('SELECT vendor_number FROM vendors WHERE vendor_number = ?')
    .get(vendorNumber) as { vendor_number: number } | undefined

  if (!existing) {
    throw new Error('Vendor not found')
  }

  const productCount = db
    .prepare('SELECT COUNT(*) AS count FROM products WHERE vendor_number = ?')
    .get(vendorNumber) as { count: number }

  if (productCount.count > 0) {
    throw new Error('Cannot delete vendor that is assigned to products')
  }

  db.prepare('DELETE FROM vendors WHERE vendor_number = ?').run(vendorNumber)
}
