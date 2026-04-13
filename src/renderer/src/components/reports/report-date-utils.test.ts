import { describe, it, expect } from 'vitest'
import { computeRange } from './report-date-utils'
import type { DatePreset } from './report-date-utils'

describe('computeRange', () => {
  it('returns ISO date strings for today', () => {
    const result = computeRange('today')
    expect(result.preset).toBe('today')
    expect(result.from).toContain('T')
    expect(result.to).toContain('T')
    const from = new Date(result.from)
    const to = new Date(result.to)
    expect(from.getHours()).toBe(0)
    expect(to.getHours()).toBe(23)
  })

  it('returns yesterday range', () => {
    const result = computeRange('yesterday')
    expect(result.preset).toBe('yesterday')
    const from = new Date(result.from)
    const to = new Date(result.to)
    const now = new Date()
    expect(from.getDate()).toBe(
      now.getDate() - 1 || new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    )
    expect(to.getHours()).toBe(23)
  })

  it('returns this-week range starting on Sunday', () => {
    const result = computeRange('this-week')
    expect(result.preset).toBe('this-week')
    const from = new Date(result.from)
    expect(from.getDay()).toBe(0)
  })

  it('returns this-month range starting on the 1st', () => {
    const result = computeRange('this-month')
    expect(result.preset).toBe('this-month')
    const from = new Date(result.from)
    expect(from.getDate()).toBe(1)
  })

  it('returns this-quarter range', () => {
    const result = computeRange('this-quarter')
    expect(result.preset).toBe('this-quarter')
    const from = new Date(result.from)
    expect([0, 3, 6, 9]).toContain(from.getMonth())
  })

  it('returns this-year range starting Jan 1', () => {
    const result = computeRange('this-year')
    expect(result.preset).toBe('this-year')
    const from = new Date(result.from)
    expect(from.getMonth()).toBe(0)
    expect(from.getDate()).toBe(1)
  })

  it('returns last-month range', () => {
    const result = computeRange('last-month')
    expect(result.preset).toBe('last-month')
    const from = new Date(result.from)
    const to = new Date(result.to)
    expect(from.getDate()).toBe(1)
    expect(to.getDate()).toBeGreaterThanOrEqual(28)
  })

  it('returns last-quarter range', () => {
    const result = computeRange('last-quarter')
    expect(result.preset).toBe('last-quarter')
    const from = new Date(result.from)
    expect([0, 3, 6, 9]).toContain(from.getMonth())
  })

  it('returns last-year range', () => {
    const result = computeRange('last-year')
    expect(result.preset).toBe('last-year')
    const from = new Date(result.from)
    const to = new Date(result.to)
    const now = new Date()
    expect(from.getFullYear()).toBe(now.getFullYear() - 1)
    expect(to.getMonth()).toBe(11)
    expect(to.getDate()).toBe(31)
  })

  it('returns today range for custom preset', () => {
    const result = computeRange('custom')
    expect(result.preset).toBe('custom')
    const from = new Date(result.from)
    expect(from.getHours()).toBe(0)
  })

  it('handles all presets without error', () => {
    const presets: DatePreset[] = [
      'today',
      'yesterday',
      'this-week',
      'this-month',
      'this-quarter',
      'this-year',
      'last-month',
      'last-quarter',
      'last-year',
      'custom'
    ]
    for (const preset of presets) {
      const result = computeRange(preset)
      expect(result.from).toBeTruthy()
      expect(result.to).toBeTruthy()
      expect(new Date(result.from).getTime()).toBeLessThanOrEqual(new Date(result.to).getTime())
    }
  })
})
