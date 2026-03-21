import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@renderer/lib/utils'

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root ref={ref} className={cn('flex shrink-0', className)} {...props} />
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'bg-[var(--bg-surface-soft)] text-[var(--text-primary)] border border-[var(--border-default)] px-2.5 py-1.5 text-[0.85rem] font-semibold cursor-pointer min-w-[2rem] text-center border-l-0 first:border-l first:rounded-l-none last:rounded-r-[var(--radius)]',
      'data-[state=on]:bg-[var(--btn-bg)] data-[state=on]:text-[var(--btn-text)] data-[state=on]:border-[var(--btn-bg)]',
      className
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
