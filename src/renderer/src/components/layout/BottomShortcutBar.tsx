import { useState, useEffect } from 'react'
import { useAuthStore } from '@renderer/store/useAuthStore'
import './bottom-shortcut-bar.css'

type BottomShortcutBarProps = {
  isAdmin?: boolean
  onInventoryClick: () => void
  onClockOutClick: () => void
  onSalesHistoryClick: () => void
  onReportsClick: () => void
  onManagerClick: () => void
  onSignOutClick: () => void
}

const ADMIN_ONLY_ACTIONS = new Set(['inventory', 'reports', 'sales-history', 'manager'])

const F_KEYS = [
  { key: 'F2', label: 'Inventory', action: 'inventory' },
  { key: 'F3', label: 'Clock In/Out', action: 'clock-out' },
  { key: 'F4', label: 'Customers' },
  { key: 'F5', label: 'Reports', action: 'reports' },
  { key: 'F6', label: 'Manager', action: 'manager' },
  { key: 'F7', label: 'Sales History', action: 'sales-history' }
]

function useCurrentTime(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  return `${date.toUpperCase()}\n${time}`
}

export function BottomShortcutBar({
  isAdmin,
  onInventoryClick,
  onClockOutClick,
  onSalesHistoryClick,
  onReportsClick,
  onManagerClick,
  onSignOutClick
}: BottomShortcutBarProps): React.JSX.Element {
  const logout = useAuthStore((s) => s.logout)
  const datetime = useCurrentTime()
  const [datePart, timePart] = datetime.split('\n')

  return (
    <footer className="bottom-bar" data-testid="bottom-bar">
      <div className="bottom-bar__keys">
        {F_KEYS.map(({ key, label, action }) => {
          const restricted = !isAdmin && !!action && ADMIN_ONLY_ACTIONS.has(action)
          return (
            <button
              key={key}
              type="button"
              className={`bottom-bar__key-btn${restricted ? ' bottom-bar__key-btn--disabled' : ''}`}
              disabled={restricted}
              onClick={
                restricted
                  ? undefined
                  : action === 'inventory'
                    ? onInventoryClick
                    : action === 'clock-out'
                      ? onClockOutClick
                      : action === 'sales-history'
                        ? onSalesHistoryClick
                        : action === 'reports'
                          ? onReportsClick
                          : action === 'manager'
                            ? onManagerClick
                            : undefined
              }
            >
              <span className="bottom-bar__key-badge">{key}</span>
              <span className="bottom-bar__key-label">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="bottom-bar__divider" />

      <div className="bottom-bar__right">
        <div className="bottom-bar__datetime">
          <div className="bottom-bar__date">{datePart}</div>
          <div className="bottom-bar__time">{timePart}</div>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="bottom-bar__sign-out"
            onClick={onSignOutClick}
            data-testid="sign-out-account-button"
          >
            SIGN OUT
          </button>
        ) : null}
        <button
          type="button"
          className="bottom-bar__exit"
          onClick={logout}
          data-testid="exit-pos-button"
        >
          EXIT POS
        </button>
      </div>
    </footer>
  )
}
