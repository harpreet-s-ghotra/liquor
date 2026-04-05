/**
 * Device registration service.
 *
 * Generates a stable machine fingerprint and registers this POS terminal
 * with Supabase so it can be identified across sync operations.
 */

import { createHash } from 'crypto'
import { hostname } from 'os'
import { app } from 'electron'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDeviceConfig, saveDeviceConfig } from '../database/device-config.repo'

/**
 * Generate a stable fingerprint for this machine using userData path + hostname.
 * This is deterministic across app restarts on the same machine.
 */
function generateFingerprint(): string {
  const raw = `${app.getPath('userData')}:${hostname()}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * Register (or re-register) this device with the Supabase cloud.
 * Upserts by (merchant_id, device_fingerprint) so the same machine
 * always gets the same device record.
 *
 * Returns the cloud-assigned device UUID.
 */
export async function registerDevice(
  supabase: SupabaseClient,
  merchantCloudId: string
): Promise<string> {
  // Check if already registered locally
  const existing = getDeviceConfig()
  if (existing) {
    // Update last_seen_at in cloud
    await supabase
      .from('registers')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', existing.device_id)
    return existing.device_id
  }

  const fingerprint = generateFingerprint()
  const deviceName = `Register (${hostname()})`

  const { data, error } = await supabase
    .from('registers')
    .upsert(
      {
        merchant_id: merchantCloudId,
        device_name: deviceName,
        device_fingerprint: fingerprint,
        last_seen_at: new Date().toISOString()
      },
      { onConflict: 'merchant_id,device_fingerprint' }
    )
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Device registration failed: ${error?.message ?? 'unknown error'}`)
  }

  const deviceId = data.id as string

  saveDeviceConfig({
    device_id: deviceId,
    device_name: deviceName,
    device_fingerprint: fingerprint
  })

  return deviceId
}
