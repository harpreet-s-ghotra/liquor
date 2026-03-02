import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { ensureColumn, setDatabase } from './connection'
import { seedData } from './seed'

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

  // ── Tables ──

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

  // ── Column migrations ──

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

  // ── Indexes ──

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_vendor_number ON products(vendor_number);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_product_id ON product_alt_skus(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_alt_sku ON product_alt_skus(alt_sku);
    CREATE INDEX IF NOT EXISTS idx_special_pricing_product_id ON special_pricing(product_id);
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

  // ── Seed initial data ──

  seedData(database)
}
