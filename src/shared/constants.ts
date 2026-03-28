// ── Shared constants: single source of truth for validation rules ──

/** Valid characters for SKUs: letters, numbers, and hyphens */
export const SKU_PATTERN = /^[A-Za-z0-9-]+$/

/** Maximum length for SKU fields */
export const SKU_MAX_LENGTH = 64

/** Maximum length for name fields (product name, distributor name, etc.) */
export const NAME_MAX_LENGTH = 120

/** Maximum length for department name */
export const DEPARTMENT_NAME_MAX_LENGTH = 64

/** Maximum length for tax code name */
export const TAX_CODE_MAX_LENGTH = 32

/** Length of cashier PINs */
export const PIN_LENGTH = 4

/** Max failed PIN attempts before lockout */
export const MAX_PIN_ATTEMPTS = 3

/** Lockout duration in milliseconds (30 seconds) */
export const PIN_LOCKOUT_MS = 30_000
