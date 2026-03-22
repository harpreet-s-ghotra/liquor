import * as React from 'react'
import { cn } from '@renderer/lib/utils'
import './badge.css'

const variantMap = {
  default: 'badge--default',
  warning: 'badge--warning',
  success: 'badge--success',
  danger: 'badge--danger'
}

function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'warning' | 'success' | 'danger'
}): React.JSX.Element {
  return <span className={cn('badge', variantMap[variant], className)} {...props} />
}

export { Badge }
