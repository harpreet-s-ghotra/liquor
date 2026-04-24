import { describe, expect, it } from 'vitest'
import { normalizeSize } from './size'

describe('normalizeSize', () => {
  it('normalizes canonical units and spacing', () => {
    expect(normalizeSize('750ml')).toBe('750ML')
    expect(normalizeSize(' 1.75 L ')).toBe('1.75L')
    expect(normalizeSize('1.5LT')).toBe('1.5L')
    expect(normalizeSize('700 mL')).toBe('700ML')
    expect(normalizeSize('12oz')).toBe('12OZ')
  })

  it('preserves free-form values while uppercasing', () => {
    expect(normalizeSize('Single')).toBe('SINGLE')
    expect(normalizeSize('233ml')).toBe('233ML')
  })

  it('returns null for empty values', () => {
    expect(normalizeSize('')).toBeNull()
    expect(normalizeSize('   ')).toBeNull()
    expect(normalizeSize(null)).toBeNull()
    expect(normalizeSize(undefined)).toBeNull()
  })
})
