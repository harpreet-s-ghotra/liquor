import { describe, expect, it } from 'vitest'
import {
  formatCostInput,
  formatCurrency,
  formatCurrencyFromCents,
  normalizeCurrencyForInput,
  normalizeDecimalInput,
  parseCurrencyDigitsToDollars,
  parseDecimalInput
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

  describe('normalizeDecimalInput', () => {
    it('passes through integers untouched', () => {
      expect(normalizeDecimalInput('12')).toBe('12')
    })

    it('keeps a partial decimal entry like "12."', () => {
      expect(normalizeDecimalInput('12.')).toBe('12.')
    })

    it('clamps fractional digits to maxDecimals', () => {
      expect(normalizeDecimalInput('12.34567')).toBe('12.345')
      expect(normalizeDecimalInput('12.3456', 2)).toBe('12.34')
    })

    it('strips letters and stray punctuation', () => {
      expect(normalizeDecimalInput('$12.34abc')).toBe('12.34')
    })

    it('collapses multiple decimal points', () => {
      expect(normalizeDecimalInput('12.3.4')).toBe('12.34')
    })

    it('returns empty for non-numeric input', () => {
      expect(normalizeDecimalInput('abc')).toBe('')
    })
  })

  describe('parseDecimalInput', () => {
    it('rounds to the requested number of decimals', () => {
      expect(parseDecimalInput('12.3456', 3)).toBe(12.346)
      expect(parseDecimalInput('12.3456', 2)).toBe(12.35)
    })

    it('returns NaN on empty / non-numeric input', () => {
      expect(parseDecimalInput('')).toBeNaN()
      expect(parseDecimalInput('abc')).toBeNaN()
    })
  })

  describe('formatCostInput', () => {
    it('returns empty for zero', () => {
      expect(formatCostInput(0)).toBe('')
    })

    it('returns empty for non-finite input', () => {
      expect(formatCostInput(Number.NaN)).toBe('')
    })

    it('preserves up to 3 decimals', () => {
      expect(formatCostInput(12.345)).toBe('12.345')
    })

    it('strips trailing zeros after the decimal point', () => {
      expect(formatCostInput(12.3)).toBe('12.3')
      expect(formatCostInput(12.0)).toBe('12')
    })

    it('does not eat zeros to the left of the decimal point', () => {
      expect(formatCostInput(100)).toBe('100')
      expect(formatCostInput(100.0)).toBe('100')
    })

    it('respects custom decimals override', () => {
      // Cost stored as 12.3456 — caller can opt into 4dp display.
      expect(formatCostInput(12.3456, 4)).toBe('12.3456')
    })
  })
})
