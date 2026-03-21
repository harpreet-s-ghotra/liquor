import * as React from 'react'
import { cn } from '@renderer/lib/utils'

/** Compact input for use in the Inventory form (h-9, text-13px). */
type InventoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean
}

export const InventoryInput = React.forwardRef<HTMLInputElement, InventoryInputProps>(
  ({ hasError, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 bg-[var(--bg-input)] rounded-[var(--radius)] px-2.5 text-[13px] text-[var(--text-primary)] border border-[var(--border-default)] outline-none placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent-blue)]',
        hasError && 'ring-1 ring-[var(--error)]',
        className
      )}
      {...props}
    />
  )
)
InventoryInput.displayName = 'InventoryInput'

/** Compact select for use in the Inventory form (h-9, text-13px). */
type InventorySelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean
}

export const InventorySelect = React.forwardRef<HTMLSelectElement, InventorySelectProps>(
  ({ hasError, className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full h-9 bg-[var(--bg-input)] rounded-[var(--radius)] px-2.5 text-[13px] text-[var(--text-primary)] border border-[var(--border-default)] outline-none cursor-pointer focus:ring-1 focus:ring-[var(--accent-blue)]',
        hasError && 'ring-1 ring-[var(--error)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
InventorySelect.displayName = 'InventorySelect'
