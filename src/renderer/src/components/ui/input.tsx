import * as React from 'react'
import { cn } from '@renderer/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full rounded-(--radius) border border-(--border-default) bg-(--bg-input) px-2.5 py-2 text-[1.125rem] text-(--text-primary) outline-none placeholder:text-(--text-muted) focus:border-(--accent-blue) focus:ring-2 focus:ring-(--accent-blue)/25 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
