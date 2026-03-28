import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { ensureColumn, setDatabase } from './connection'
import { seedData } from './seed'

/**
 * Check whether a table exists in the database.
 */
function tableExists(database: InstanceType<typeof Database>, name: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { name: string } | undefined
  return row != null
}

/**
 * Check whether a column exists on a table.
 */
function columnExists(
  database: InstanceType<typeof Database>,
  table: string,
  column: string
): boolean {
  const cols = database.pragma(`table_info(${table})`) as Array<{ name: string }>
  return cols.some((c) => c.name === column)
}

/**
 * One-time migration: rename vendors -> distributors + create sales_reps.
 * Runs only when the old vendors table exists and the new distributors table does not.
 */
function migrateVendorsToDistributors(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'vendors') || tableExists(database, 'distributors')) return

  // Rename table + columns
  database.exec(`ALTER TABLE vendors RENAME TO distributors`)
  database.exec(`ALTER TABLE distributors RENAME COLUMN vendor_number TO distributor_number`)
  database.exec(`ALTER TABLE distributors RENAME COLUMN vendor_name TO distributor_name`)

  // Rename FK column in products
  if (columnExists(database, 'products', 'vendor_number')) {
    database.exec(`ALTER TABLE products RENAME COLUMN vendor_number TO distributor_number`)
  }

  // Drop old index and recreate with new name
  database.exec(`DROP INDEX IF EXISTS idx_products_vendor_number`)
  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_products_distributor_number ON products(distributor_number)`
  )

  // Add new license columns to distributors
  if (!columnExists(database, 'distributors', 'license_id')) {
    database.exec(`ALTER TABLE distributors ADD COLUMN license_id TEXT`)
  }
  if (!columnExists(database, 'distributors', 'serial_number')) {
    database.exec(`ALTER TABLE distributors ADD COLUMN serial_number TEXT`)
  }
  if (!columnExists(database, 'distributors', 'premises_name')) {
    database.exec(`ALTER TABLE distributors ADD COLUMN premises_name TEXT`)
  }
  if (!columnExists(database, 'distributors', 'premises_address')) {
    database.exec(`ALTER TABLE distributors ADD COLUMN premises_address TEXT`)
  }

  // Create sales_reps table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sales_reps (
      sales_rep_id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_number INTEGER NOT NULL,
      rep_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (distributor_number) REFERENCES distributors(distributor_number)
    )
  `)

  database.exec(
    `CREATE INDEX IF NOT EXISTS idx_sales_reps_distributor ON sales_reps(distributor_number)`
  )

  // Migrate existing contact data to sales_reps (one rep per distributor that had contact info)
  if (columnExists(database, 'distributors', 'contact_name')) {
    database.exec(`
      INSERT INTO sales_reps (distributor_number, rep_name, phone, email)
      SELECT distributor_number, contact_name, phone, email
      FROM distributors
      WHERE contact_name IS NOT NULL AND contact_name != ''
    `)

    // Drop old contact columns
    database.exec(`ALTER TABLE distributors DROP COLUMN contact_name`)
    database.exec(`ALTER TABLE distributors DROP COLUMN phone`)
    database.exec(`ALTER TABLE distributors DROP COLUMN email`)
  }
}

/**
 * Apply schema DDL and column migrations to any Database instance.
 * Used by initializeDatabase (production) and test helpers (in-memory).
 */
export function applySchema(database: InstanceType<typeof Database>): void {
  // ── Migration: vendors -> distributors (existing DBs only) ──
  migrateVendorsToDistributors(database)

  // ── Tables ──

  database.exec(`
    CREATE TABLE IF NOT EXISTS distributors (
      distributor_number INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_name TEXT NOT NULL,
      license_id TEXT,
      serial_number TEXT,
      premises_name TEXT,
      premises_address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_reps (
      sales_rep_id INTEGER PRIMARY KEY AUTOINCREMENT,
      distributor_number INTEGER NOT NULL,
      rep_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (distributor_number) REFERENCES distributors(distributor_number)
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
      distributor_number INTEGER,
      bottles_per_case INTEGER DEFAULT 12,
      case_discount_price REAL,
      special_pricing_enabled INTEGER DEFAULT 0,
      special_price REAL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (distributor_number) REFERENCES distributors(distributor_number)
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
      stax_transaction_id TEXT,
      card_last_four TEXT,
      card_type TEXT,
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

    CREATE TABLE IF NOT EXISTS merchant_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      stax_api_key TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cashiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS held_transactions (
      id                           INTEGER PRIMARY KEY AUTOINCREMENT,
      hold_number                  INTEGER NOT NULL,
      cart_snapshot                TEXT NOT NULL,
      transaction_discount_percent REAL NOT NULL DEFAULT 0,
      subtotal                     REAL NOT NULL,
      total                        REAL NOT NULL,
      item_count                   INTEGER NOT NULL,
      held_at                      DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // ── Column migrations ──

  ensureColumn('transactions', 'stax_transaction_id', 'stax_transaction_id TEXT')
  ensureColumn('transactions', 'card_last_four', 'card_last_four TEXT')
  ensureColumn('transactions', 'card_type', 'card_type TEXT')
  ensureColumn('transactions', 'original_transaction_id', 'original_transaction_id INTEGER')

  ensureColumn('products', 'dept_id', 'dept_id TEXT')
  ensureColumn('products', 'category_id', 'category_id INTEGER')
  ensureColumn('products', 'category_name', 'category_name TEXT')
  ensureColumn('products', 'retail_price', 'retail_price REAL')
  ensureColumn('products', 'in_stock', 'in_stock INTEGER')
  ensureColumn('products', 'tax_1', 'tax_1 REAL')
  ensureColumn('products', 'tax_2', 'tax_2 REAL')
  ensureColumn('products', 'distributor_number', 'distributor_number INTEGER')
  ensureColumn('products', 'bottles_per_case', 'bottles_per_case INTEGER DEFAULT 12')
  ensureColumn('products', 'case_discount_price', 'case_discount_price REAL')
  ensureColumn('products', 'special_pricing_enabled', 'special_pricing_enabled INTEGER DEFAULT 0')
  ensureColumn('products', 'special_price', 'special_price REAL')
  ensureColumn('products', 'is_active', 'is_active INTEGER NOT NULL DEFAULT 1')

  // Special pricing column migrations
  ensureColumn('special_pricing', 'pricing_type', "pricing_type TEXT DEFAULT 'group'")

  // Department column migrations
  ensureColumn('departments', 'description', 'description TEXT')
  ensureColumn('departments', 'default_profit_margin', 'default_profit_margin REAL DEFAULT 0')
  ensureColumn('departments', 'default_tax_rate', 'default_tax_rate REAL DEFAULT 0')

  // Distributor license columns (for existing distributors tables created before license fields)
  ensureColumn('distributors', 'license_id', 'license_id TEXT')
  ensureColumn('distributors', 'serial_number', 'serial_number TEXT')
  ensureColumn('distributors', 'premises_name', 'premises_name TEXT')
  ensureColumn('distributors', 'premises_address', 'premises_address TEXT')

  // ── Indexes ──

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_distributor_number ON products(distributor_number);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_product_id ON product_alt_skus(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_alt_sku ON product_alt_skus(alt_sku);
    CREATE INDEX IF NOT EXISTS idx_special_pricing_product_id ON special_pricing(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_reps_distributor ON sales_reps(distributor_number);
  `)

  // ── Backfill nullable columns ──

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
}

/**
 * Create (or open) the SQLite database, run DDL migrations, and seed initial
 * data when the tables are empty.
 */
export function initializeDatabase(userDataPath: string): void {
  const dataDir = join(userDataPath, 'data')
  mkdirSync(dataDir, { recursive: true })

  const dbPath = join(dataDir, 'liquor-pos.db')
  const database = new Database(dbPath)

  // Publish the instance so every repository can access it via getDb()
  setDatabase(database)

  applySchema(database)

  // ── Seed initial data ──

  seedData(database)
}
