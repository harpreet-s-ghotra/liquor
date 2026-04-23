const SENSITIVE_KEY_REGEX = /password|pin|token|secret|card|pan|cvv|bearer/i

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_REGEX.test(key)
}

export function redact<T = unknown>(value: T, depth = 0): T {
  if (depth > 8) return value
  if (value == null) return value
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1)) as unknown as T
  }

  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source)) {
    out[key] = isSensitiveKey(key) ? '[REDACTED]' : redact(source[key], depth + 1)
  }
  return out as unknown as T
}
