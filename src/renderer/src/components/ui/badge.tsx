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
    default: 'bg-(--btn-bg) text-(--btn-text)',
    warning: 'bg-(--accent-peach) text-(--btn-warning-text)',
    success: 'bg-(--btn-success-bg) text-(--btn-success-text)',
    danger: 'bg-(--btn-danger-bg) text-(--btn-danger-text)'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-(--radius) px-1.5 py-0.5 text-[0.8125rem] font-extrabold',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
