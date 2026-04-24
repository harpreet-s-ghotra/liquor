import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { migrateLegacyDbIfPresent } from './migrate-legacy'

let database: Database.Database | null = null
let databaseRoot: string | null = null
let activeMerchantAccountId: string | null = null

type DatabaseInitializer = (db: Database.Database) => void

let databaseInitializer: DatabaseInitializer | null = null

export function registerDatabaseInitializer(initializer: DatabaseInitializer): void {
  databaseInitializer = initializer
}

export function configureDatabaseRoot(userDataPath: string): void {
  databaseRoot = userDataPath
}

export function getActiveMerchantAccountId(): string | null {
  return activeMerchantAccountId
}

export function closeActiveMerchantDb(): void {
  if (database) {
    database.close()
    database = null
  }
  activeMerchantAccountId = null
}

export function setActiveMerchantDb(
  merchantAccountId: string,
  finixMerchantId?: string | null
): string {
  if (activeMerchantAccountId === merchantAccountId && database) {
    return getMerchantDbPath(merchantAccountId)
  }

  if (!databaseRoot) {
    throw new Error('Database root has not been configured')
  }

  // Sole owner of DB lifecycle: close prior, open next, hand to initializer.
  closeActiveMerchantDb()

  const migratedPath = migrateLegacyDbIfPresent({
    userDataPath: databaseRoot,
    merchantAccountId,
    finixMerchantId
  })
  const dbPath = migratedPath ?? getMerchantDbPath(merchantAccountId)

  mkdirSync(join(databaseRoot, 'merchants', merchantAccountId), { recursive: true })

  const nextDb = new Database(dbPath)
  nextDb.pragma('foreign_keys = ON')
  database = nextDb
  activeMerchantAccountId = merchantAccountId
  databaseInitializer?.(nextDb)

  return dbPath
}

function getMerchantDbPath(merchantAccountId: string): string {
  if (!databaseRoot) {
    throw new Error('Database root has not been configured')
  }

  return join(databaseRoot, 'merchants', merchantAccountId, 'database.sqlite')
}

/**
 * Set the active database instance directly. Only used by tests — production
 * code should go through setActiveMerchantDb, which owns the full lifecycle.
 */
export function setDatabase(db: Database.Database): void {
  if (database && database !== db) {
    database.close()
  }
  database = db
}

/**
 * Return the active database instance or throw if not yet initialized.
 */
export function getDb(): Database.Database {
  if (!database) {
    throw new Error('Database has not been initialized')
  }
  return database
}

/**
 * Add a column to a table if it doesn't already exist (used for migrations).
 */
export function ensureColumn(
  tableName: string,
  columnName: string,
  columnDefinition: string
): void {
  const db = getDb()
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>

  if (columns.some((column) => column.name === columnName)) {
    return
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`)
}
