import { getDb } from './connection'
import { getDeviceConfig } from './device-config.repo'
import { enqueueSyncItem } from './sync-queue.repo'
import type {
  CardSurchargeConfig,
  MerchantConfig,
  SaveMerchantConfigInput
} from '../../shared/types'
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
       merchant_account_id,
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
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       COALESCE((SELECT activated_at FROM merchant_config WHERE id = 1), CURRENT_TIMESTAMP),
       CURRENT_TIMESTAMP
     )`
  ).run(
    input.merchant_account_id ?? getMerchantConfig()?.merchant_account_id ?? '',
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

const DEFAULT_SURCHARGE: CardSurchargeConfig = { enabled: false, percent: 0 }
const MAX_SURCHARGE_PERCENT = 10

function readExtras(): Record<string, unknown> {
  const row = getDb()
    .prepare('SELECT settings_extras_json FROM merchant_config WHERE id = 1 LIMIT 1')
    .get() as { settings_extras_json: string | null } | undefined
  return parseExtras(row?.settings_extras_json)
}

function writeExtras(next: Record<string, unknown>): void {
  const db = getDb()
  const result = db
    .prepare(
      `UPDATE merchant_config
       SET settings_extras_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`
    )
    .run(JSON.stringify(next))
  if (result.changes === 0) {
    throw new Error('Merchant config not initialized')
  }
}

export function getCardSurcharge(): CardSurchargeConfig {
  const extras = readExtras()
  const raw = extras.card_surcharge
  if (!raw || typeof raw !== 'object') return DEFAULT_SURCHARGE
  const obj = raw as Record<string, unknown>
  const percent = Number(obj.percent)
  return {
    enabled: obj.enabled === true,
    percent: Number.isFinite(percent) && percent >= 0 ? percent : 0
  }
}

export function setCardSurcharge(input: CardSurchargeConfig): CardSurchargeConfig {
  if (!Number.isFinite(input.percent) || input.percent < 0) {
    throw new Error('Surcharge percent must be 0 or higher')
  }
  if (input.percent > MAX_SURCHARGE_PERCENT) {
    throw new Error(`Surcharge percent must be ${MAX_SURCHARGE_PERCENT}% or less`)
  }

  const extras = readExtras()
  const next = {
    ...extras,
    card_surcharge: { enabled: !!input.enabled, percent: Number(input.percent.toFixed(3)) }
  }
  writeExtras(next)
  enqueueSettingsSync()
  return getCardSurcharge()
}

const MAX_DELIVERY_SERVICES = 24
const MAX_DELIVERY_SERVICE_NAME_LENGTH = 40

/**
 * Read the manager-configured delivery service names. Stored under
 * `delivery_services` inside `settings_extras_json` so no schema bump is
 * required. Names are returned in stored order so the manager controls the
 * tile layout shown in the Account payment modal.
 */
export function getDeliveryServices(): string[] {
  const extras = readExtras()
  const raw = extras.delivery_services
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_DELIVERY_SERVICES)
}

export function setDeliveryServices(input: string[]): string[] {
  if (!Array.isArray(input)) {
    throw new Error('Delivery services must be a list of names')
  }
  const cleaned: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (trimmed.length > MAX_DELIVERY_SERVICE_NAME_LENGTH) {
      throw new Error(
        `Delivery service name must be ${MAX_DELIVERY_SERVICE_NAME_LENGTH} characters or fewer`
      )
    }
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cleaned.push(trimmed)
    if (cleaned.length >= MAX_DELIVERY_SERVICES) break
  }

  const extras = readExtras()
  const next = { ...extras, delivery_services: cleaned }
  writeExtras(next)
  enqueueSettingsSync()
  return getDeliveryServices()
}

/**
 * Remove the merchant config (deactivate this POS terminal).
 */
export function clearMerchantConfig(): void {
  const db = getDb()
  db.prepare('DELETE FROM merchant_config WHERE id = 1').run()
}
