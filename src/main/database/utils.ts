/**
 * Normalize a SQLite CURRENT_TIMESTAMP string ("YYYY-MM-DD HH:MM:SS", UTC)
 * to a proper ISO 8601 string ("YYYY-MM-DDTHH:MM:SSZ") so that
 * `new Date()` always parses it as UTC, not local time.
 *
 * Already-normalized strings (containing 'T' or 'Z') are returned unchanged.
 */
export function normalizeTimestamp(ts: string): string {
  if (ts.includes('T') || ts.includes('Z')) return ts
  return ts.replace(' ', 'T') + 'Z'
}

/**
 * Convert an ISO string (with T/Z) to SQLite DATETIME format ("YYYY-MM-DD HH:MM:SS")
 * for use in WHERE clause comparisons against CURRENT_TIMESTAMP-stored values.
 */
export function toSqliteFormat(iso: string): string {
  return iso.replace('T', ' ').replace('Z', '').split('.')[0]
}
