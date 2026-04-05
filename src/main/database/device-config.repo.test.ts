import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { setDatabase } from './connection'
import { applySchema } from './schema'
import { getDeviceConfig, saveDeviceConfig, clearDeviceConfig } from './device-config.repo'

function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}

describe('device-config.repo', () => {
  beforeEach(() => {
    createTestDb()
  })

  it('returns null when no config exists', () => {
    expect(getDeviceConfig()).toBeNull()
  })

  it('saves and retrieves device config', () => {
    const config = saveDeviceConfig({
      device_id: 'uuid-1',
      device_name: 'Register 1',
      device_fingerprint: 'fp-abc123'
    })
    expect(config.device_id).toBe('uuid-1')
    expect(config.device_name).toBe('Register 1')
    expect(config.device_fingerprint).toBe('fp-abc123')
    expect(config.registered_at).toBeTruthy()
  })

  it('replaces existing config on second save', () => {
    saveDeviceConfig({ device_id: 'uuid-1', device_name: 'Register 1', device_fingerprint: 'fp-1' })
    const updated = saveDeviceConfig({
      device_id: 'uuid-1',
      device_name: 'Register 1 Updated',
      device_fingerprint: 'fp-1'
    })
    expect(updated.device_name).toBe('Register 1 Updated')
    // Only one row should exist
    expect(getDeviceConfig()?.device_name).toBe('Register 1 Updated')
  })

  it('preserves registered_at on update', () => {
    const original = saveDeviceConfig({
      device_id: 'uuid-1',
      device_name: 'Register 1',
      device_fingerprint: 'fp-1'
    })
    const updated = saveDeviceConfig({
      device_id: 'uuid-1',
      device_name: 'Register 1 New Name',
      device_fingerprint: 'fp-1'
    })
    expect(updated.registered_at).toBe(original.registered_at)
  })

  it('clears device config', () => {
    saveDeviceConfig({ device_id: 'uuid-1', device_name: 'Register 1', device_fingerprint: 'fp-1' })
    clearDeviceConfig()
    expect(getDeviceConfig()).toBeNull()
  })

  it('clear is idempotent on empty table', () => {
    expect(() => clearDeviceConfig()).not.toThrow()
  })
})
