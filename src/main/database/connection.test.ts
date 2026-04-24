import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeActiveMerchantDb, getDb, setActiveMerchantDb, setDatabase } from './connection'
import { initializeDatabase, applySchema } from './schema'

function insertProduct(sku: string): void {
  getDb()
    .prepare(
      `INSERT INTO products (sku, name, category, price, cost, retail_price, in_stock, is_active)
       VALUES (?, ?, 'General', 0, 1, 1, 1, 1)`
    )
    .run(sku, `${sku} Product`)
}

describe('merchant database lifecycle', () => {
  let userDataPath = ''

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'liquor-pos-merchants-'))
    initializeDatabase(userDataPath)
  })

  afterEach(() => {
    closeActiveMerchantDb()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  it('switches between merchant databases without leaking rows', () => {
    setActiveMerchantDb('merchant-a')
    insertProduct('A-001')

    setActiveMerchantDb('merchant-b')
    const merchantBRows = getDb()
      .prepare(`SELECT COUNT(*) AS count FROM products WHERE sku = 'A-001'`)
      .get() as { count: number }

    expect(merchantBRows.count).toBe(0)

    insertProduct('B-001')

    setActiveMerchantDb('merchant-a')
    const merchantARows = getDb().prepare(`SELECT sku FROM products ORDER BY sku`).all() as Array<{
      sku: string
    }>

    expect(merchantARows).toEqual([{ sku: 'A-001' }])
  })

  it('migrates the legacy shared database into the first matching merchant account', () => {
    const legacyDbPath = join(userDataPath, 'data', 'liquor-pos.db')
    mkdirSync(join(userDataPath, 'data'), { recursive: true })

    const legacyDb = new Database(legacyDbPath)
    legacyDb.pragma('foreign_keys = ON')
    // applySchema uses ensureColumn, which pulls the module-level db singleton.
    // Point the singleton at the legacy handle so the test seed matches prod DDL.
    setDatabase(legacyDb)
    applySchema(legacyDb)
    legacyDb
      .prepare(
        `INSERT INTO merchant_config (
           id,
           finix_api_username,
           finix_api_password,
           merchant_id,
           merchant_name,
           settings_extras_json,
           activated_at,
           updated_at
         ) VALUES (1, '', '', 'FINIX-123', 'Legacy Merchant', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .run()
    legacyDb
      .prepare(
        `INSERT INTO products (sku, name, category, price, cost, retail_price, in_stock, is_active)
         VALUES ('LEGACY-001', 'Legacy Product', 'General', 0, 1, 1, 1, 1)`
      )
      .run()
    legacyDb.close()

    setActiveMerchantDb('merchant-account-123', 'FINIX-123')

    const migratedProduct = getDb()
      .prepare(`SELECT sku FROM products WHERE sku = 'LEGACY-001'`)
      .get() as { sku: string } | undefined
    const targetDbPath = join(userDataPath, 'merchants', 'merchant-account-123', 'database.sqlite')

    expect(migratedProduct?.sku).toBe('LEGACY-001')
    expect(existsSync(legacyDbPath)).toBe(false)
    expect(existsSync(targetDbPath)).toBe(true)
  })
})
