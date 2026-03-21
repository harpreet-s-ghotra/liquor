import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-bold cursor-pointer shadow-xs disabled:opacity-55 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-[var(--btn-bg)] text-[var(--btn-text)] border border-[var(--btn-border)]',
        success:
          'bg-[var(--btn-success-bg)] text-[var(--btn-success-text)] border border-[var(--btn-success-border)]',
        danger:
          'bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] border border-[var(--btn-danger-border)]',
        warning:
          'bg-[var(--btn-warning-bg)] text-[var(--btn-warning-text)] border border-[var(--btn-warning-border)]',
        neutral:
          'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-default)]',
        ghost: 'bg-transparent shadow-none text-[var(--text-primary)] border-none',
        outline:
          'border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] shadow-none'
      },
      size: {
        sm: 'min-h-[2.25rem] text-[0.95rem] px-3 rounded-[var(--radius)]',
        md: 'min-h-[2.75rem] text-[1rem] px-3.5 rounded-[var(--radius)]',
        lg: 'min-h-[4.5rem] text-[1.3125rem] px-4 rounded-[var(--radius)]',
        icon: 'h-9 w-9 rounded-[var(--radius)]'
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
