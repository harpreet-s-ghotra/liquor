import Database from 'better-sqlite3'

let database: Database.Database | null = null

/**
 * Set the active database instance (called by schema.initializeDatabase).
 */
export function setDatabase(db: Database.Database): void {
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
