import { describe, expect, it } from 'vitest'
import { normalizeTimestamp, toSqliteFormat } from './utils'

describe('database utils', () => {
  it('normalizeTimestamp converts SQLite timestamps to ISO format', () => {
    expect(normalizeTimestamp('2026-01-02 03:04:05')).toBe('2026-01-02T03:04:05Z')
  })

  it('normalizeTimestamp leaves ISO timestamps unchanged', () => {
    expect(normalizeTimestamp('2026-01-02T03:04:05Z')).toBe('2026-01-02T03:04:05Z')
  })

  it('toSqliteFormat removes timezone markers and milliseconds', () => {
    expect(toSqliteFormat('2026-01-02T03:04:05.678Z')).toBe('2026-01-02 03:04:05')
  })
})
