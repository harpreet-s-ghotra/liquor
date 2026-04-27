import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase, getDb } from './connection'
import { applySchema } from './schema'
import {
  getCardSurcharge,
  getMerchantConfig,
  saveMerchantConfig,
  setCardSurcharge
} from './merchant-config.repo'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

function seedConfig(): void {
  saveMerchantConfig({
    finix_api_username: 'US-test',
    finix_api_password: 'pw',
    merchant_id: 'MU-test',
    merchant_name: 'Test Liquor'
  })
}

describe('card surcharge config', () => {
  beforeEach(createTestDb)

  it('returns the default disabled surcharge before any save', () => {
    seedConfig()
    expect(getCardSurcharge()).toEqual({ enabled: false, percent: 0 })
  })

  it('round-trips enabled + percent through extras_json', () => {
    seedConfig()
    setCardSurcharge({ enabled: true, percent: 3.5 })
    expect(getCardSurcharge()).toEqual({ enabled: true, percent: 3.5 })

    // Verify it was persisted into the JSON column, not a phantom in-memory cache
    const row = getDb()
      .prepare('SELECT settings_extras_json FROM merchant_config WHERE id = 1')
      .get() as { settings_extras_json: string }
    const parsed = JSON.parse(row.settings_extras_json)
    expect(parsed.card_surcharge).toEqual({ enabled: true, percent: 3.5 })
  })

  it('rejects negative percent', () => {
    seedConfig()
    expect(() => setCardSurcharge({ enabled: true, percent: -1 })).toThrow(/0 or higher/)
  })

  it('rejects percent above 10%', () => {
    seedConfig()
    expect(() => setCardSurcharge({ enabled: true, percent: 25 })).toThrow(/10%/)
  })

  it('preserves other extras keys when updating surcharge', () => {
    seedConfig()
    // Manually plant another key in extras_json
    getDb()
      .prepare('UPDATE merchant_config SET settings_extras_json = ? WHERE id = 1')
      .run(JSON.stringify({ unrelated: 'keep-me' }))

    setCardSurcharge({ enabled: true, percent: 2 })

    const row = getDb()
      .prepare('SELECT settings_extras_json FROM merchant_config WHERE id = 1')
      .get() as { settings_extras_json: string }
    const parsed = JSON.parse(row.settings_extras_json)
    expect(parsed.unrelated).toBe('keep-me')
    expect(parsed.card_surcharge).toEqual({ enabled: true, percent: 2 })
  })

  it('throws when no merchant_config row exists', () => {
    // No seedConfig — table is empty
    expect(() => setCardSurcharge({ enabled: true, percent: 1 })).toThrow(
      'Merchant config not initialized'
    )
  })

  it('does not affect getMerchantConfig identity', () => {
    seedConfig()
    setCardSurcharge({ enabled: true, percent: 4 })
    const cfg = getMerchantConfig()
    expect(cfg?.merchant_id).toBe('MU-test')
  })
})
