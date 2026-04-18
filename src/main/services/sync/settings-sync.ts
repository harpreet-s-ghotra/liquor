import type { SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../../database/connection'
import type { CloudMerchantSettingsPayload, MerchantSettingsSyncPayload } from './types'

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

function parseExtras(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function hasBusinessValues(settings: MerchantSettingsSyncPayload['settings']): boolean {
  if (settings.store_name && settings.store_name.trim()) return true
  if (settings.receipt_header && settings.receipt_header.trim()) return true
  if (settings.receipt_footer && settings.receipt_footer.trim()) return true
  if (settings.theme && settings.theme.trim()) return true
  return Object.keys(settings.extras_json).length > 0
}

function getLocalSettingsSyncPayload(): MerchantSettingsSyncPayload | null {
  const row = getDb()
    .prepare(
      `SELECT
         merchant_id,
         store_name,
         receipt_header,
         receipt_footer,
         theme,
         settings_extras_json,
         COALESCE(updated_at, CURRENT_TIMESTAMP) AS updated_at
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
      store_name: row.store_name ?? null,
      receipt_header: row.receipt_header ?? null,
      receipt_footer: row.receipt_footer ?? null,
      theme: row.theme ?? null,
      extras_json: parseExtras(row.settings_extras_json),
      updated_at: row.updated_at
    }
  }
}

export async function uploadSettings(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: MerchantSettingsSyncPayload
): Promise<void> {
  const { settings } = payload

  const cloudPayload: CloudMerchantSettingsPayload = {
    merchant_id: merchantId,
    store_name: settings.store_name,
    receipt_header: settings.receipt_header,
    receipt_footer: settings.receipt_footer,
    theme: settings.theme,
    extras_json: settings.extras_json,
    device_id: deviceId,
    updated_at: settings.updated_at
  }

  const { error } = await supabase
    .from('merchant_business_settings')
    .upsert(cloudPayload, { onConflict: 'merchant_id' })

  if (error) {
    throw new Error(`Settings upload failed: ${error.message}`)
  }
}

export async function applyRemoteSettingsChange(
  _supabase: SupabaseClient,
  _merchantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any
): Promise<void> {
  const db = getDb()
  const local = db.prepare('SELECT updated_at FROM merchant_config WHERE id = 1 LIMIT 1').get() as
    | { updated_at: string }
    | undefined

  if (local && toTimestamp(local.updated_at) >= toTimestamp(row.updated_at)) {
    return
  }

  db.prepare(
    `UPDATE merchant_config
     SET store_name = ?,
         receipt_header = ?,
         receipt_footer = ?,
         theme = ?,
         settings_extras_json = ?,
         updated_at = ?
     WHERE id = 1`
  ).run(
    (row.store_name as string | null) ?? null,
    (row.receipt_header as string | null) ?? null,
    (row.receipt_footer as string | null) ?? null,
    (row.theme as string | null) ?? null,
    JSON.stringify((row.extras_json as Record<string, unknown> | null) ?? {}),
    String(row.updated_at)
  )
}

export async function reconcileSettings(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string
): Promise<{ applied: number; uploaded: number; errors: string[] }> {
  const result = { applied: 0, uploaded: 0, errors: [] as string[] }

  const { data: remote, error } = await supabase
    .from('merchant_business_settings')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (error) {
    result.errors.push(`Remote settings fetch failed: ${error.message}`)
    return result
  }

  const local = getLocalSettingsSyncPayload()

  if (remote) {
    try {
      await applyRemoteSettingsChange(supabase, merchantId, remote)
      result.applied = 1
    } catch (err) {
      result.errors.push(
        `Apply failed for settings: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  if (!local) return result

  const shouldUploadWhenMissing = !remote && hasBusinessValues(local.settings)
  const shouldUploadWhenNewer =
    remote &&
    toTimestamp(local.settings.updated_at) > toTimestamp(remote.updated_at as string | null) &&
    hasBusinessValues(local.settings)

  if (shouldUploadWhenMissing || shouldUploadWhenNewer) {
    try {
      await uploadSettings(supabase, merchantId, deviceId, local)
      result.uploaded = 1
    } catch (err) {
      result.errors.push(
        `Upload failed for settings: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
