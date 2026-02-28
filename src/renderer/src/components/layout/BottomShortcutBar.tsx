import './bottom-shortcut-bar.css'

export function BottomShortcutBar(): React.JSX.Element {
  return (
    <footer className="shortcut-bar">
      <button type="button">F1 - Help</button>
      <button type="button">F2 - Inventory</button>
      <button type="button">F3 - Clock In/Out</button>
      <button type="button">F4 - Customers</button>
    </footer>
  )
}
