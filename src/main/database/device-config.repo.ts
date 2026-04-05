import { getDb } from './connection'
import type { DeviceConfig, SaveDeviceConfigInput } from '../../shared/types'

/**
 * Get the device registration config (singleton row).
 */
export function getDeviceConfig(): DeviceConfig | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM device_config WHERE id = 1').get()
  return (row as DeviceConfig) ?? null
}

/**
 * Save or replace the device registration config.
 */
export function saveDeviceConfig(input: SaveDeviceConfigInput): DeviceConfig {
  const db = getDb()
  db.prepare(
    `INSERT OR REPLACE INTO device_config (id, device_id, device_name, device_fingerprint, registered_at)
     VALUES (1, ?, ?, ?, COALESCE((SELECT registered_at FROM device_config WHERE id = 1), CURRENT_TIMESTAMP))`
  ).run(input.device_id, input.device_name, input.device_fingerprint)
  return getDeviceConfig()!
}

/**
 * Remove device registration (for re-registration).
 */
export function clearDeviceConfig(): void {
  const db = getDb()
  db.prepare('DELETE FROM device_config WHERE id = 1').run()
}
