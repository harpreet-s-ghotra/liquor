/**
 * Currency formatting and parsing utilities for the POS renderer.
 */

/** Format a dollar amount with thousands separators (e.g. 1234.5 → "$1,234.50") */
export const formatCurrency = (value: number): string => {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
