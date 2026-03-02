import './bottom-shortcut-bar.css'

type BottomShortcutBarProps = {
  onInventoryClick: () => void
}

export function BottomShortcutBar({ onInventoryClick }: BottomShortcutBarProps): React.JSX.Element {
  return (
    <footer className="shortcut-bar">
      <button type="button">F1 - Help</button>
      <button type="button" onClick={onInventoryClick}>
        F2 - Inventory
      </button>
      <button type="button">F3 - Clock In/Out</button>
      <button type="button">F4 - Customers</button>
    </footer>
  )
}
