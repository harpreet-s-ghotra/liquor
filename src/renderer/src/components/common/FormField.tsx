import type { ReactNode } from 'react'
import './form-field.css'

type FormFieldProps = {
  label: string
  required?: boolean
  error?: string
  showError?: boolean
  className?: string
  children: ReactNode
}

export function FormField({
  label,
  required = false,
  error,
  showError = false,
  className = '',
  children
}: FormFieldProps): React.JSX.Element {
  const hasError = showError && !!error
  const classes = ['form-field', hasError ? 'has-error' : '', className].filter(Boolean).join(' ')

  return (
    <label className={classes}>
      <span className="form-field__label">
        {label}
        {required && <span className="form-field__required"> *</span>}
      </span>
      {children}
      <span className="form-field__error-slot">{hasError ? error : ''}</span>
    </label>
  )
}
