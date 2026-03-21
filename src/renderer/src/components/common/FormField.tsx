import type { ReactNode } from 'react'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'

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
    <label className={cn('grid gap-[0.2rem]', hasError && 'has-error', className)}>
      <Label asChild>
        <span>
          {label}
          {required && <span className="text-(--semantic-danger-text) font-bold"> *</span>}
        </span>
      </Label>
      {children}
      <span className="min-h-[1.1rem] text-[0.78rem] text-(--semantic-danger-text) font-semibold">
        {hasError ? error : ''}
      </span>
    </label>
  )
}
