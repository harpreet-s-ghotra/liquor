/**
 * Currency formatting and parsing utilities for the POS renderer.
 */

/** Format a dollar amount with thousands separators (e.g. 1234.5 → "$1,234.50") */
export const formatCurrency = (value: number, decimals = 2): string => {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

/** Format a cents-based integer to dollars with thousands separators (e.g. 125000 → "$1,250.00") */
export const formatCurrencyFromCents = (cents: number): string => formatCurrency(cents / 100)

/** Format an integer with thousands separators (e.g. 12345 → "12,345"). Counts, quantities. */
export const formatInteger = (value: number): string => Math.round(value).toLocaleString('en-US')

/**
 * Parse a raw digit-only (or "$1.23"-style) string into a dollar amount.
 * Strips all non-digit characters, interprets the remaining digits as cents.
 * Returns NaN when the string contains no digits.
 */
export const parseCurrencyDigitsToDollars = (rawValue: string): number => {
  const digitOnlyValue = rawValue.replace(/\D/g, '')
  if (!digitOnlyValue) {
    return Number.NaN
  }
  return Number.parseInt(digitOnlyValue, 10) / 100
}

/**
 * Normalize a raw input string into a formatted currency display value.
 * Strips non-digits, then converts cents to a "$X.XX" string.
 * Returns an empty string when no digits are present.
 */
export const normalizeCurrencyForInput = (rawValue: string): string => {
  const digitOnlyValue = rawValue.replace(/\D/g, '')
  if (!digitOnlyValue) {
    return ''
  }
  return formatCurrencyFromCents(Number.parseInt(digitOnlyValue, 10))
}

/**
 * Lightweight 3-decimal numeric input normaliser for cost-style fields.
 * Accepts a free-form decimal string (e.g. user typing "12.345"); strips
 * everything except digits and a single decimal point and clamps the
 * fractional part to at most 3 digits. Empty input → empty string.
 *
 * Distinct from `normalizeCurrencyForInput`, which treats input as cents.
 */
export const normalizeDecimalInput = (rawValue: string, maxDecimals = 3): string => {
  const cleaned = rawValue.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  const intPart = cleaned.slice(0, firstDot)
  const fracPart = cleaned
    .slice(firstDot + 1)
    .replace(/\./g, '')
    .slice(0, maxDecimals)
  return `${intPart}.${fracPart}`
}

/** Parse a free-form decimal cost input back into a number, rounded to `decimals`. */
export const parseDecimalInput = (rawValue: string, decimals = 3): number => {
  const value = Number.parseFloat(rawValue)
  if (!Number.isFinite(value)) return Number.NaN
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Render a numeric value (e.g. cost from the DB) as the free-form decimal
 * string the cost input accepts. Trims trailing zeros after the decimal point
 * but never strips digits left of the point — so 100.000 → "100", 12.300 →
 * "12.3", 12.345 → "12.345", 0 → "".
 */
export const formatCostInput = (value: number, decimals = 3): string => {
  if (!Number.isFinite(value) || value === 0) return ''
  const fixed = value.toFixed(decimals)
  if (!fixed.includes('.')) return fixed
  return fixed.replace(/\.?0+$/, '')
}
