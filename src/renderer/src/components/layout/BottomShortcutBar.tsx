import { Button } from '@renderer/components/ui/button'

type BottomShortcutBarProps = {
  onInventoryClick: () => void
}

export function BottomShortcutBar({ onInventoryClick }: BottomShortcutBarProps): React.JSX.Element {
  return (
    <footer className="shortcut-bar grid grid-cols-4 gap-px bg-(--border-strong) border-t border-(--border-strong)">
      <Button
        variant="ghost"
        className="rounded-none bg-(--bg-surface-soft) text-[0.875rem] font-semibold text-(--text-primary) shadow-none"
      >
        F1 - Help
      </Button>
      <Button
        variant="ghost"
        className="rounded-none bg-(--bg-surface-soft) text-[0.875rem] font-semibold text-(--text-primary) shadow-none"
        onClick={onInventoryClick}
      >
        F2 - Inventory
      </Button>
      <Button
        variant="ghost"
        className="rounded-none bg-(--bg-surface-soft) text-[0.875rem] font-semibold text-(--text-primary) shadow-none"
      >
        F3 - Clock In/Out
      </Button>
      <Button
        variant="ghost"
        className="rounded-none bg-(--bg-surface-soft) text-[0.875rem] font-semibold text-(--text-primary) shadow-none"
      >
        F4 - Customers
      </Button>
    </footer>
  )
}
