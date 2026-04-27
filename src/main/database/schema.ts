import Database from 'better-sqlite3'
import { ensureColumn, configureDatabaseRoot, registerDatabaseInitializer } from './connection'
import { seedData } from './seed'
import { scoped } from '../services/logger'
import { normalizeSize } from '../../shared/utils/size'

const log = scoped('schema')

registerDatabaseInitializer((database) => {
  applySchema(database)
  seedData(database)
})

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

function getTableSql(database: InstanceType<typeof Database>, table: string): string | null {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { sql: string } | undefined
  return row?.sql ?? null
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
/**
 * One-time migration: rename stax_api_key -> payment_processing_api_key in merchant_config.
 */
function migrateStaxApiKey(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'merchant_config')) return
  if (!columnExists(database, 'merchant_config', 'stax_api_key')) return
  database.exec(
    `ALTER TABLE merchant_config RENAME COLUMN stax_api_key TO payment_processing_api_key`
  )
}

/**
 * One-time migration: replace payment_processing_api_key with finix_api_username + finix_api_password.
 * Runs only when the old column exists and the new one does not yet.
 */
function migratePaymentApiKeyToFinix(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'merchant_config')) return
  if (!columnExists(database, 'merchant_config', 'payment_processing_api_key')) return
  if (columnExists(database, 'merchant_config', 'finix_api_username')) return
  // Add new Finix credential columns
  database.exec(
    `ALTER TABLE merchant_config ADD COLUMN finix_api_username TEXT NOT NULL DEFAULT ''`
  )
  database.exec(
    `ALTER TABLE merchant_config ADD COLUMN finix_api_password TEXT NOT NULL DEFAULT ''`
  )
  // Drop the old single-key column (SQLite 3.35+)
  database.exec(`ALTER TABLE merchant_config DROP COLUMN payment_processing_api_key`)
}

function migrateMerchantAccountId(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'merchant_config')) return
  if (columnExists(database, 'merchant_config', 'merchant_account_id')) return
  database.exec(
    `ALTER TABLE merchant_config ADD COLUMN merchant_account_id TEXT NOT NULL DEFAULT ''`
  )
}

/**
 * One-time migration: move old transaction gateway references to Finix fields.
 */
function migrateTransactionGatewayColumns(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'transactions')) return
  if (!columnExists(database, 'transactions', 'stax_transaction_id')) return

  if (!columnExists(database, 'transactions', 'finix_authorization_id')) {
    database.exec(
      `ALTER TABLE transactions RENAME COLUMN stax_transaction_id TO finix_authorization_id`
    )
  } else {
    database.exec(`
      UPDATE transactions
      SET finix_authorization_id = COALESCE(finix_authorization_id, stax_transaction_id)
      WHERE stax_transaction_id IS NOT NULL AND TRIM(stax_transaction_id) != ''
    `)
    database.exec(`ALTER TABLE transactions DROP COLUMN stax_transaction_id`)
  }
}

/**
 * One-time migration: rename departments -> item_types.
 */
function migrateDepartmentsToItemTypes(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'departments')) return

  // New schema reintroduces departments as a first-class table for cloud sync.
  // If this is the new departments table, skip the legacy rename migration.
  if (columnExists(database, 'departments', 'tax_code_id')) return

  if (tableExists(database, 'item_types')) {
    // item_types already exists — move any departments rows that are missing
    database.exec(`
      INSERT OR IGNORE INTO item_types (name, description, default_profit_margin, default_tax_rate)
      SELECT name, description, default_profit_margin, default_tax_rate
      FROM departments
    `)
    return
  }
  database.exec(`ALTER TABLE departments RENAME TO item_types`)
}

/**
 * One-time migration: copy products.dept_id into products.item_type where item_type is NULL,
 * then NULL out dept_id.
 */
function migrateDeptIdToItemType(database: InstanceType<typeof Database>): void {
  if (!columnExists(database, 'products', 'dept_id')) return
  if (!columnExists(database, 'products', 'item_type')) return
  database.exec(`
    UPDATE products
    SET item_type = COALESCE(NULLIF(TRIM(item_type), ''), TRIM(dept_id)),
        dept_id = NULL
    WHERE dept_id IS NOT NULL AND TRIM(dept_id) != ''
  `)
}

function migrateInventoryDeltaReasons(database: InstanceType<typeof Database>): void {
  const sql = getTableSql(database, 'inventory_deltas')
  if (!sql || sql.includes('receiving_correction')) return

  database.exec(`
    ALTER TABLE inventory_deltas RENAME TO inventory_deltas_old;

    CREATE TABLE inventory_deltas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_sku TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('sale', 'refund', 'manual_adjustment', 'receiving', 'receiving_correction')),
      reference_id TEXT,
      device_id TEXT,
      synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    INSERT INTO inventory_deltas (
      id,
      product_id,
      product_sku,
      delta,
      reason,
      reference_id,
      device_id,
      synced_at,
      created_at
    )
    SELECT
      id,
      product_id,
      product_sku,
      delta,
      reason,
      reference_id,
      device_id,
      synced_at,
      created_at
    FROM inventory_deltas_old;

    DROP TABLE inventory_deltas_old;
  `)
}

function backfillProductSizes(database: InstanceType<typeof Database>): void {
  if (!tableExists(database, 'products') || !columnExists(database, 'products', 'size')) return

  const rows = database
    .prepare(`SELECT id, size FROM products WHERE size IS NOT NULL`)
    .all() as Array<{ id: number; size: string | null }>

  if (rows.length === 0) return

  const updateSize = database.prepare(`UPDATE products SET size = ? WHERE id = ?`)
  let updated = 0

  const tx = database.transaction(() => {
    for (const row of rows) {
      const normalized = normalizeSize(row.size)
      if (normalized === row.size) continue
      updateSize.run(normalized, row.id)
      updated += 1
    }
  })

  tx()
  log.info(`size backfill: ${updated} rows updated`)
}

/**
 * Strip diacritics (é→e, ñ→n) and collapse hyphens/punctuation to spaces.
 * Used as a custom SQLite function so LIKE queries match loosely.
 */
export function normalizeSearch(value: string | null): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_./]/g, ' ')
    .toLowerCase()
}

export function applySchema(database: InstanceType<typeof Database>): void {
  // Register custom search normalizer (strips diacritics + punctuation)
  database.function('normalize_search', { deterministic: true }, (val: unknown) =>
    normalizeSearch(val as string | null)
  )

  // ── Migrations ──
  migrateVendorsToDistributors(database)
  migrateStaxApiKey(database)
  migratePaymentApiKeyToFinix(database)
  migrateTransactionGatewayColumns(database)
  migrateDepartmentsToItemTypes(database)
  migrateDeptIdToItemType(database)
  migrateInventoryDeltaReasons(database)
  migrateMerchantAccountId(database)

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
      brand_name TEXT,
      proof REAL,
      alcohol_pct REAL,
      vintage TEXT,
      ttb_id TEXT,
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
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_number TEXT UNIQUE NOT NULL,
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL,
      total REAL NOT NULL,
      surcharge_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      finix_authorization_id TEXT,
      finix_transfer_id TEXT,
      card_last_four TEXT,
      card_type TEXT,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      backfilled INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_at_sale REAL,
      cost_basis_source TEXT DEFAULT 'fifo_layer',
      total_price REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transaction_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      card_last_four TEXT,
      card_type TEXT,
      finix_authorization_id TEXT,
      finix_transfer_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    CREATE TABLE IF NOT EXISTS product_cost_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      received_at DATETIME NOT NULL,
      quantity_received INTEGER NOT NULL,
      quantity_remaining INTEGER NOT NULL,
      cost_per_unit REAL NOT NULL,
      source TEXT,
      source_reference TEXT,
      device_id TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS item_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      tax_code_id TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
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
      merchant_account_id TEXT NOT NULL DEFAULT '',
      finix_api_username TEXT NOT NULL DEFAULT '',
      finix_api_password TEXT NOT NULL DEFAULT '',
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      store_name TEXT,
      receipt_header TEXT,
      receipt_footer TEXT,
      theme TEXT,
      settings_extras_json TEXT NOT NULL DEFAULT '{}',
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
      description                  TEXT,
      held_at                      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opened_by_cashier_id INTEGER NOT NULL,
      opened_by_cashier_name TEXT NOT NULL,
      closed_by_cashier_id INTEGER,
      closed_by_cashier_name TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (opened_by_cashier_id) REFERENCES cashiers(id),
      FOREIGN KEY (closed_by_cashier_id) REFERENCES cashiers(id)
    );

    CREATE TABLE IF NOT EXISTS device_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_fingerprint TEXT NOT NULL,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL,
      device_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_flight', 'failed', 'done'))
    );

    CREATE TABLE IF NOT EXISTS inventory_deltas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_sku TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('sale', 'refund', 'manual_adjustment', 'receiving', 'receiving_correction')),
      reference_id TEXT,
      device_id TEXT,
      synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      distributor_number INTEGER NOT NULL,
      distributor_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'submitted', 'received', 'cancelled')),
      notes TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      received_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (distributor_number) REFERENCES distributors(distributor_number)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_cost REAL NOT NULL,
      bottles_per_case INTEGER NOT NULL DEFAULT 1,
      quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
      quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
      line_total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      UNIQUE(po_id, product_id)
    );
  `)

  // ── Column migrations ──

  ensureColumn('transactions', 'finix_authorization_id', 'finix_authorization_id TEXT')
  ensureColumn('transactions', 'finix_transfer_id', 'finix_transfer_id TEXT')
  ensureColumn('transactions', 'card_last_four', 'card_last_four TEXT')
  ensureColumn('transactions', 'card_type', 'card_type TEXT')
  ensureColumn('transactions', 'original_transaction_id', 'original_transaction_id INTEGER')
  ensureColumn('transactions', 'session_id', 'session_id INTEGER')
  ensureColumn('transactions', 'device_id', 'device_id TEXT')
  ensureColumn('transactions', 'synced_at', 'synced_at DATETIME')
  ensureColumn('transactions', 'backfilled', 'backfilled INTEGER NOT NULL DEFAULT 0')
  ensureColumn('transactions', 'surcharge_amount', 'surcharge_amount REAL NOT NULL DEFAULT 0')
  ensureColumn('held_transactions', 'description', 'description TEXT')
  ensureColumn(
    'purchase_order_items',
    'bottles_per_case',
    'bottles_per_case INTEGER NOT NULL DEFAULT 1'
  )
  database.exec(`
    UPDATE purchase_order_items
    SET bottles_per_case = COALESCE(
      (
        SELECT CASE
          WHEN COALESCE(products.bottles_per_case, 0) > 0 THEN products.bottles_per_case
          ELSE 1
        END
        FROM products
        WHERE products.id = purchase_order_items.product_id
      ),
      1
    )
    WHERE COALESCE(bottles_per_case, 1) = 1
  `)
  ensureColumn('transaction_items', 'cost_at_sale', 'cost_at_sale REAL')
  ensureColumn(
    'transaction_items',
    'cost_basis_source',
    "cost_basis_source TEXT DEFAULT 'fifo_layer'"
  )
  ensureColumn(
    'merchant_config',
    'finix_api_username',
    "finix_api_username TEXT NOT NULL DEFAULT ''"
  )
  ensureColumn(
    'merchant_config',
    'finix_api_password',
    "finix_api_password TEXT NOT NULL DEFAULT ''"
  )

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
  ensureColumn('products', 'item_type', 'item_type TEXT')
  ensureColumn('products', 'size', 'size TEXT')
  ensureColumn('products', 'case_cost', 'case_cost REAL')
  ensureColumn('products', 'nysla_discounts', 'nysla_discounts TEXT')
  ensureColumn('products', 'brand_name', 'brand_name TEXT')
  ensureColumn('products', 'proof', 'proof REAL')

  backfillProductSizes(database)
  ensureColumn('products', 'alcohol_pct', 'alcohol_pct REAL')
  ensureColumn('products', 'vintage', 'vintage TEXT')
  ensureColumn('products', 'ttb_id', 'ttb_id TEXT')
  ensureColumn('products', 'display_name', 'display_name TEXT')

  // Reorder dashboard
  ensureColumn('products', 'reorder_point', 'reorder_point INTEGER DEFAULT 0')
  ensureColumn('products', 'is_discontinued', 'is_discontinued INTEGER DEFAULT 0')

  // Special pricing column migrations
  ensureColumn('special_pricing', 'pricing_type', "pricing_type TEXT DEFAULT 'group'")
  // Re-introduce optional expiry on special pricing rules. Rules with a past
  // expires_at are filtered out by the pricing engine. NULL = never expires.
  ensureColumn('special_pricing', 'expires_at', 'expires_at DATETIME')

  // Legacy duration_days column was dropped in 2026-04. We do not re-add it —
  // the new model uses an absolute expires_at timestamp instead.
  if (columnExists(database, 'special_pricing', 'duration_days')) {
    try {
      database.exec('ALTER TABLE special_pricing DROP COLUMN duration_days')
    } catch {
      // Older SQLite builds cannot drop columns; leave dormant.
    }
  }

  // Item type column migrations
  ensureColumn('item_types', 'description', 'description TEXT')
  ensureColumn('item_types', 'default_profit_margin', 'default_profit_margin REAL DEFAULT 0')
  ensureColumn('item_types', 'default_tax_rate', 'default_tax_rate REAL DEFAULT 0')

  // Distributor license columns (for existing distributors tables created before license fields)
  ensureColumn('distributors', 'license_id', 'license_id TEXT')
  ensureColumn('distributors', 'serial_number', 'serial_number TEXT')
  ensureColumn('distributors', 'premises_name', 'premises_name TEXT')
  ensureColumn('distributors', 'premises_address', 'premises_address TEXT')

  // Favorites
  ensureColumn('products', 'is_favorite', 'is_favorite INTEGER NOT NULL DEFAULT 0')

  // Departments (legacy table upgraded for cloud sync)
  ensureColumn('departments', 'tax_code_id', 'tax_code_id TEXT')
  ensureColumn('departments', 'is_deleted', 'is_deleted INTEGER NOT NULL DEFAULT 0')

  // Merchant business settings
  ensureColumn('merchant_config', 'store_name', 'store_name TEXT')
  ensureColumn('merchant_config', 'receipt_header', 'receipt_header TEXT')
  ensureColumn('merchant_config', 'receipt_footer', 'receipt_footer TEXT')
  ensureColumn('merchant_config', 'theme', 'theme TEXT')
  ensureColumn(
    'merchant_config',
    'settings_extras_json',
    "settings_extras_json TEXT NOT NULL DEFAULT '{}'"
  )

  // Cloud sync columns — products
  ensureColumn('products', 'cloud_id', 'cloud_id TEXT')
  ensureColumn('products', 'synced_at', 'synced_at DATETIME')
  ensureColumn('products', 'last_modified_by_device', 'last_modified_by_device TEXT')

  // Cloud sync columns — departments
  ensureColumn('departments', 'cloud_id', 'cloud_id TEXT')
  ensureColumn('departments', 'synced_at', 'synced_at DATETIME')
  ensureColumn('departments', 'last_modified_by_device', 'last_modified_by_device TEXT')

  // Cloud sync columns — item_types
  ensureColumn('item_types', 'cloud_id', 'cloud_id TEXT')
  ensureColumn('item_types', 'synced_at', 'synced_at DATETIME')
  ensureColumn('item_types', 'last_modified_by_device', 'last_modified_by_device TEXT')

  // Cloud sync columns — tax_codes
  ensureColumn('tax_codes', 'cloud_id', 'cloud_id TEXT')
  ensureColumn('tax_codes', 'synced_at', 'synced_at DATETIME')
  ensureColumn('tax_codes', 'last_modified_by_device', 'last_modified_by_device TEXT')
  // Default tax — marks the tax code applied to newly-created / imported items
  ensureColumn('tax_codes', 'is_default', 'is_default INTEGER NOT NULL DEFAULT 0')

  // Cloud sync columns — cashiers
  ensureColumn('cashiers', 'cloud_id', 'cloud_id TEXT')
  ensureColumn('cashiers', 'synced_at', 'synced_at DATETIME')
  ensureColumn('cashiers', 'last_modified_by_device', 'last_modified_by_device TEXT')

  // Cloud sync columns — distributors
  ensureColumn('distributors', 'cloud_id', 'cloud_id TEXT')
  ensureColumn('distributors', 'synced_at', 'synced_at DATETIME')
  ensureColumn('distributors', 'last_modified_by_device', 'last_modified_by_device TEXT')

  // ── Indexes ──

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_distributor_number ON products(distributor_number);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_product_id ON product_alt_skus(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_alt_skus_alt_sku ON product_alt_skus(alt_sku);
    CREATE INDEX IF NOT EXISTS idx_special_pricing_product_id ON special_pricing(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_reps_distributor ON sales_reps(distributor_number);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_session_id ON transactions(session_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_distributor ON purchase_orders(distributor_number);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(po_id);
    CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
    CREATE INDEX IF NOT EXISTS idx_cost_layers_product_remaining ON product_cost_layers(product_id, received_at);
    CREATE INDEX IF NOT EXISTS idx_transaction_payments_txn ON transaction_payments(transaction_id);
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

  // Legacy baseline for historical rows created before FIFO cost capture.
  database.exec(`
    UPDATE transaction_items
    SET
      cost_at_sale = quantity * COALESCE((SELECT cost FROM products WHERE products.id = transaction_items.product_id), 0),
      cost_basis_source = 'legacy_baseline'
    WHERE cost_at_sale IS NULL
  `)

  // Seed a baseline FIFO layer for legacy stock so historical inventory has a
  // defensible starting cost basis.
  database.exec(`
    INSERT INTO product_cost_layers (
      product_id,
      received_at,
      quantity_received,
      quantity_remaining,
      cost_per_unit,
      source,
      source_reference,
      device_id
    )
    SELECT
      p.id,
      COALESCE(p.updated_at, CURRENT_TIMESTAMP),
      COALESCE(p.in_stock, p.quantity, 0),
      COALESCE(p.in_stock, p.quantity, 0),
      COALESCE(p.cost, 0),
      'migration_seed',
      'w6-fifo-seed',
      p.last_modified_by_device
    FROM products p
    WHERE COALESCE(p.in_stock, p.quantity, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM product_cost_layers l
        WHERE l.product_id = p.id
      )
  `)
}

/**
 * Create (or open) the SQLite database, run DDL migrations, and seed initial
 * data when the tables are empty.
 */
export function initializeDatabase(userDataPath: string): void {
  configureDatabaseRoot(userDataPath)
}
