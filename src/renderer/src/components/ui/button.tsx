import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-bold cursor-pointer shadow-xs disabled:opacity-55 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-(--btn-bg) text-(--btn-text) border border-(--btn-border)',
        success:
          'bg-(--btn-success-bg) text-(--btn-success-text) border border-(--btn-success-border)',
        danger: 'bg-(--btn-danger-bg) text-(--btn-danger-text) border border-(--btn-danger-border)',
        warning:
          'bg-(--btn-warning-bg) text-(--btn-warning-text) border border-(--btn-warning-border)',
        neutral: 'bg-(--bg-surface) text-(--text-primary) border border-(--border-default)',
        ghost: 'bg-transparent shadow-none text-(--text-primary) border-none',
        outline: 'border border-(--border-strong) bg-transparent text-(--text-primary) shadow-none'
      },
      size: {
        sm: 'min-h-[2.25rem] text-[0.95rem] px-3 rounded-(--radius)',
        md: 'min-h-11 text-[1rem] px-3.5 rounded-(--radius)',
        lg: 'min-h-18 text-[1.3125rem] px-4 rounded-(--radius)',
        icon: 'h-9 w-9 rounded-(--radius)'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button }
