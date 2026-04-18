import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import type { MerchantConfig, SaveMerchantConfigInput } from '../../shared/types'
import type { MerchantSettingsSyncPayload } from '../services/sync/types'

function parseExtras(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function buildSettingsSyncPayload(): MerchantSettingsSyncPayload | null {
  const row = getDb()
    .prepare(
      `SELECT
         merchant_id,
         store_name,
         receipt_header,
         receipt_footer,
         theme,
         settings_extras_json,
         updated_at
       FROM merchant_config
       WHERE id = 1
       LIMIT 1`
    )
    .get() as
    | {
        merchant_id: string
        store_name: string | null
        receipt_header: string | null
        receipt_footer: string | null
        theme: string | null
        settings_extras_json: string | null
        updated_at: string
      }
    | undefined

  if (!row?.merchant_id) return null

  return {
    settings: {
      merchant_id: row.merchant_id,
      store_name: row.store_name,
      receipt_header: row.receipt_header,
      receipt_footer: row.receipt_footer,
      theme: row.theme,
      extras_json: parseExtras(row.settings_extras_json),
      updated_at: row.updated_at
    }
  }
}

function enqueueSettingsSync(): void {
  const device = getDeviceConfig()
  if (!device) return

  const payload = buildSettingsSyncPayload()
  if (!payload) return

  try {
    enqueueSyncItem({
      entity_type: 'settings',
      entity_id: 'merchant-config',
      operation: 'UPDATE',
      payload: JSON.stringify(payload),
      device_id: device.device_id
    })
  } catch {
    // Local save already succeeded — enqueue failure is non-blocking
  }
}

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
    `INSERT OR REPLACE INTO merchant_config (
       id,
       finix_api_username,
       finix_api_password,
       merchant_id,
       merchant_name,
       store_name,
       receipt_header,
       receipt_footer,
       theme,
       settings_extras_json,
       activated_at,
       updated_at
     )
     VALUES (
       1,
       ?, ?, ?, ?, ?, ?, ?, ?, ?,
       COALESCE((SELECT activated_at FROM merchant_config WHERE id = 1), CURRENT_TIMESTAMP),
       CURRENT_TIMESTAMP
     )`
  ).run(
    input.finix_api_username,
    input.finix_api_password,
    input.merchant_id,
    input.merchant_name,
    input.store_name ?? null,
    input.receipt_header ?? null,
    input.receipt_footer ?? null,
    input.theme ?? null,
    input.settings_extras_json ?? '{}'
  )

  enqueueSettingsSync()

  return getMerchantConfig()!
}

/**
 * Remove the merchant config (deactivate this POS terminal).
 */
export function clearMerchantConfig(): void {
  const db = getDb()
  db.prepare('DELETE FROM merchant_config WHERE id = 1').run()
}
