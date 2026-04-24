import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('applySchema size backfill', () => {
  it('normalizes existing product sizes idempotently', () => {
    createTestDb()

    getDb()
      .prepare(
        `INSERT INTO products (sku, name, category, price, cost, retail_price, in_stock, size, is_active)
         VALUES ('SIZE-001', 'Sized Item', 'General', 0, 1, 2, 3, '750ml', 1)`
      )
      .run()

    applySchema(getDb())

    const firstPass = getDb().prepare(`SELECT size FROM products WHERE sku = 'SIZE-001'`).get() as {
      size: string | null
    }

    expect(firstPass.size).toBe('750ML')

    applySchema(getDb())

    const secondPass = getDb()
      .prepare(`SELECT size FROM products WHERE sku = 'SIZE-001'`)
      .get() as { size: string | null }

    expect(secondPass.size).toBe('750ML')
  })
})
