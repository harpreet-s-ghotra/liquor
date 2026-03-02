import type { InputHTMLAttributes } from 'react'
import { SKU_PATTERN, SKU_MAX_LENGTH, NAME_MAX_LENGTH } from '../../../../shared/constants'

/* ─── Field types supported by ValidatedInput ─── */
export type FieldType = 'text' | 'name' | 'email' | 'phone' | 'sku' | 'integer' | 'decimal'

/* ─── Per-type configuration ─── */
export interface FieldTypeConfig {
  /** Strip / transform characters on every keystroke */
  sanitize?: (value: string) => string
  /** Return an error string for non-empty values, or undefined if valid */
  formatValidate: (value: string) => string | undefined
  /** Default HTML inputMode */
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  /** Default maxLength */
  maxLength?: number
}

const PHONE_CHARS = /^[\d\s().+-]+$/
const PHONE_MIN_DIGITS = 7
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const fieldConfigs: Record<FieldType, FieldTypeConfig> = {
  /* Free-form text – no formatting constraints */
  text: {
    formatValidate: () => undefined
  },

  /* Name – max characters per shared constant */
  name: {
    formatValidate: (v) =>
      v.trim().length > NAME_MAX_LENGTH
        ? `Must be ${NAME_MAX_LENGTH} characters or less`
        : undefined,
    maxLength: NAME_MAX_LENGTH
  },

  /* Email – basic addr@domain.tld check */
  email: {
    formatValidate: (v) => {
      if (!v.trim()) return undefined
      return EMAIL_PATTERN.test(v.trim()) ? undefined : 'Invalid email format'
    }
  },

  /* Phone – digits, spaces, parens, dashes, plus; ≥ 7 digits */
  phone: {
    formatValidate: (v) => {
      if (!v.trim()) return undefined
      if (!PHONE_CHARS.test(v.trim())) return 'Only digits, spaces, +, -, (, ) allowed'
      const digitCount = v.replace(/\D/g, '').length
      if (digitCount < PHONE_MIN_DIGITS) return 'Must have at least 7 digits'
      return undefined
    },
    inputMode: 'tel'
  },

  /* SKU – auto-uppercase, letters + numbers + hyphens, max chars per shared constant */
  sku: {
    sanitize: (v) => v.replace(/[^A-Za-z0-9-]/g, '').toUpperCase(),
    formatValidate: (v) => {
      if (!v.trim()) return undefined
      if (!SKU_PATTERN.test(v.trim())) return 'Only letters, numbers, and hyphens'
      if (v.trim().length > SKU_MAX_LENGTH) return `Must be ${SKU_MAX_LENGTH} characters or less`
      return undefined
    },
    maxLength: SKU_MAX_LENGTH
  },

  /* Integer – whole numbers (negative allowed) */
  integer: {
    formatValidate: (v) => {
      if (!v.trim()) return undefined
      return /^-?\d+$/.test(v.trim()) ? undefined : 'Must be a whole number'
    },
    inputMode: 'numeric'
  },

  /* Decimal – floating-point numbers (for tax rates, etc.) */
  decimal: {
    formatValidate: (v) => {
      if (!v.trim()) return undefined
      const n = Number.parseFloat(v)
      return Number.isNaN(n) ? 'Must be a number' : undefined
    },
    inputMode: 'decimal'
  }
}

/* ─── Pure validation function (use in useMemo / fieldErrors) ─── */
export function validateField(
  fieldType: FieldType,
  value: string,
  options?: { required?: boolean }
): string | undefined {
  if (options?.required && !value.trim()) {
    return 'Required'
  }
  return fieldConfigs[fieldType].formatValidate(value)
}
