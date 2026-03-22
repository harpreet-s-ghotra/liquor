import * as React from 'react'
import { cn } from '@renderer/lib/utils'
import './inventory-input.css'

/** Compact input for use in the Inventory form (h-9, text-13px). */
type InventoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean
}

export const InventoryInput = React.forwardRef<HTMLInputElement, InventoryInputProps>(
  ({ hasError, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('inventory-input', hasError && 'inventory-input--error', className)}
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
      className={cn('inventory-select', hasError && 'inventory-select--error', className)}
      {...props}
    >
      {children}
    </select>
  )
)
InventorySelect.displayName = 'InventorySelect'
