import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatCurrencyFromCents,
  normalizeCurrencyForInput,
  parseCurrencyDigitsToDollars
} from './currency'

describe('currency utilities', () => {
  describe('formatCurrency', () => {
    it('formats a whole dollar amount', () => {
      expect(formatCurrency(10)).toBe('$10.00')
    })

    it('formats a fractional amount', () => {
      expect(formatCurrency(12.5)).toBe('$12.50')
    })

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('rounds to two decimal places', () => {
      expect(formatCurrency(1.999)).toBe('$2.00')
    })
  })

  describe('formatCurrencyFromCents', () => {
    it('converts cents to dollar string', () => {
      expect(formatCurrencyFromCents(1250)).toBe('$12.50')
    })

    it('handles zero cents', () => {
      expect(formatCurrencyFromCents(0)).toBe('$0.00')
    })

    it('handles single-digit cents', () => {
      expect(formatCurrencyFromCents(5)).toBe('$0.05')
    })
  })

  describe('parseCurrencyDigitsToDollars', () => {
    it('parses a clean digit string as cents', () => {
      expect(parseCurrencyDigitsToDollars('1250')).toBe(12.5)
    })

    it('strips non-digit characters', () => {
      expect(parseCurrencyDigitsToDollars('$12.50')).toBe(12.5)
    })

    it('returns NaN for empty input', () => {
      expect(parseCurrencyDigitsToDollars('')).toBeNaN()
    })

    it('returns NaN when input has no digits', () => {
      expect(parseCurrencyDigitsToDollars('abc')).toBeNaN()
    })
  })

  describe('normalizeCurrencyForInput', () => {
    it('normalizes digit string to formatted currency', () => {
      expect(normalizeCurrencyForInput('1250')).toBe('$12.50')
    })

    it('strips non-digit chars and formats', () => {
      expect(normalizeCurrencyForInput('$12.50')).toBe('$12.50')
    })

    it('returns empty string for no digits', () => {
      expect(normalizeCurrencyForInput('')).toBe('')
    })

    it('returns empty for non-digit input', () => {
      expect(normalizeCurrencyForInput('abc')).toBe('')
    })

    it('handles single digit', () => {
      expect(normalizeCurrencyForInput('5')).toBe('$0.05')
    })
  })
})
