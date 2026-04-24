export const CANONICAL_SIZE_SUGGESTIONS = [
  '50ML',
  '187ML',
  '200ML',
  '250ML',
  '355ML',
  '375ML',
  '500ML',
  '700ML',
  '720ML',
  '750ML',
  '1L',
  '1.5L',
  '1.75L',
  '2L',
  '3L',
  '4L',
  '5L'
] as const

export function normalizeSize(input: string | null | undefined): string | null {
  if (input == null) return null

  const trimmed = input.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/)
  if (!match) return trimmed.toUpperCase()

  const [, num, rawUnit] = match
  if (!rawUnit) return num

  const unit = rawUnit.toUpperCase()
  const canonicalUnit =
    unit === 'ML' || unit === 'MILLILITER'
      ? 'ML'
      : unit === 'L' || unit === 'LT' || unit === 'LITER'
        ? 'L'
        : unit === 'OZ' || unit === 'OUNCE'
          ? 'OZ'
          : unit

  return `${num}${canonicalUnit}`
}
