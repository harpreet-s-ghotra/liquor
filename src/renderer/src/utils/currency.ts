/**
 * Currency formatting and parsing utilities for the POS renderer.
 */

/** Format a dollar amount (e.g. 12.5 → "$12.50") */
export const formatCurrency = (value: number): string => `$${value.toFixed(2)}`

/** Format a cents-based integer to dollars (e.g. 1250 → "$12.50") */
export const formatCurrencyFromCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`

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
