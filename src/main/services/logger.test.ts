import { describe, expect, it } from 'vitest'
import { redact } from '../../shared/redact'

describe('redact', () => {
  it('masks sensitive keys at the top level', () => {
    const input = { user: 'alice', password: 'secret123', token: 'abc.def' }
    const output = redact(input)
    expect(output).toEqual({ user: 'alice', password: '[REDACTED]', token: '[REDACTED]' })
  })

  it('masks sensitive keys in nested objects', () => {
    const input = {
      payload: {
        card_number: '4111111111111111',
        billing: { pin: '1234', city: 'NYC' }
      }
    }
    const output = redact(input) as {
      payload: { card_number: string; billing: { pin: string; city: string } }
    }
    expect(output.payload.card_number).toBe('[REDACTED]')
    expect(output.payload.billing.pin).toBe('[REDACTED]')
    expect(output.payload.billing.city).toBe('NYC')
  })

  it('masks sensitive keys inside arrays', () => {
    const input = { entries: [{ bearer: 'xyz' }, { name: 'ok' }] }
    const output = redact(input) as { entries: Array<{ bearer?: string; name?: string }> }
    expect(output.entries[0].bearer).toBe('[REDACTED]')
    expect(output.entries[1].name).toBe('ok')
  })

  it('handles primitives without mutation', () => {
    expect(redact(null)).toBe(null)
    expect(redact(42)).toBe(42)
    expect(redact('plain')).toBe('plain')
    expect(redact(true)).toBe(true)
  })

  it('is case-insensitive on key matching', () => {
    const input = { Password: 'a', BEARER: 'b', CVV: 'c' }
    const output = redact(input) as Record<string, string>
    expect(output.Password).toBe('[REDACTED]')
    expect(output.BEARER).toBe('[REDACTED]')
    expect(output.CVV).toBe('[REDACTED]')
  })

  it('caps recursion at depth 8 to avoid pathological cycles', () => {
    // Build a deeply nested object; beyond depth 8 redaction stops but no throw.
    let deep: Record<string, unknown> = { password: 'raw' }
    for (let i = 0; i < 12; i++) {
      deep = { nested: deep }
    }
    expect(() => redact(deep)).not.toThrow()
  })
})
