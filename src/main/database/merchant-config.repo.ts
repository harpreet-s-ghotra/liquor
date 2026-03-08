import { getDb } from './connection'
import type { MerchantConfig, SaveMerchantConfigInput } from '../../shared/types'

/**
 * Get the current merchant activation config (singleton row).
 */
export function getMerchantConfig(): MerchantConfig | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM merchant_config WHERE id = 1').get()
  return (row as MerchantConfig) ?? null
}

/**
 * Save or update the merchant activation config.
 * Uses INSERT OR REPLACE to enforce the singleton constraint.
 */
export function saveMerchantConfig(input: SaveMerchantConfigInput): MerchantConfig {
  const db = getDb()
  db.prepare(
    `INSERT OR REPLACE INTO merchant_config (id, stax_api_key, merchant_id, merchant_name, activated_at, updated_at)
     VALUES (1, ?, ?, ?, COALESCE((SELECT activated_at FROM merchant_config WHERE id = 1), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`
  ).run(input.stax_api_key, input.merchant_id, input.merchant_name)

  return getMerchantConfig()!
}

/**
 * Remove the merchant config (deactivate this POS terminal).
 */
export function clearMerchantConfig(): void {
  const db = getDb()
  db.prepare('DELETE FROM merchant_config WHERE id = 1').run()
}
