import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'

type ProductRow = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  quantity: number
  tax_rate: number
}

let database: Database.Database | null = null

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
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  `)

  const productCount = database.prepare('SELECT COUNT(*) AS count FROM products').get() as {
    count: number
  }

  if (productCount.count === 0) {
    const insertProduct = database.prepare(
      `
      INSERT INTO products (sku, name, description, category, price, cost, quantity, barcode, tax_rate)
      VALUES (@sku, @name, @description, @category, @price, @cost, @quantity, @barcode, @tax_rate)
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
        tax_rate: 0.13
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
        tax_rate: 0.13
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
        tax_rate: 0.13
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
        tax_rate: 0.13
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
        tax_rate: 0.13
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

export function getProducts(): ProductRow[] {
  return ensureDatabase()
    .prepare(
      'SELECT id, sku, name, category, price, quantity, tax_rate FROM products WHERE is_active = 1 ORDER BY name'
    )
    .all() as ProductRow[]
}
