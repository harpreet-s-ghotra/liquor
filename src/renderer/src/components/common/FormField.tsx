import type { ReactNode } from 'react'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'
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

  return (
    <label className={cn('form-field', hasError && 'has-error', className)}>
      <Label asChild>
        <span>
          {label}
          {required && <span className="form-field__label-required"> *</span>}
        </span>
      </Label>
      {children}
      <span className="form-field__error">{hasError ? error : ''}</span>
    </label>
  )
}
