import * as React from 'react'
import { cn } from '@renderer/lib/utils'

function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'warning' | 'success' | 'danger'
}): React.JSX.Element {
  const variantClasses = {
    default: 'bg-[var(--btn-bg)] text-[var(--btn-text)]',
    warning: 'bg-[var(--accent-peach)] text-[var(--btn-warning-text)]',
    success: 'bg-[var(--btn-success-bg)] text-[var(--btn-success-text)]',
    danger: 'bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)]'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius)] px-1.5 py-0.5 text-[0.8125rem] font-extrabold',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
