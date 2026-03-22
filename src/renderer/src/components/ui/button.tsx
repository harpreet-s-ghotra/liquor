import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@renderer/lib/utils'
import './button.css'

type ButtonVariant = 'default' | 'success' | 'danger' | 'warning' | 'neutral' | 'ghost' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const variantMap: Record<ButtonVariant, string> = {
  default: 'btn--default',
  success: 'btn--success',
  danger: 'btn--danger',
  warning: 'btn--warning',
  neutral: 'btn--neutral',
  ghost: 'btn--ghost',
  outline: 'btn--outline'
}

const sizeMap: Record<ButtonSize, string> = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
  icon: 'btn--icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn('btn', variantMap[variant], sizeMap[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
