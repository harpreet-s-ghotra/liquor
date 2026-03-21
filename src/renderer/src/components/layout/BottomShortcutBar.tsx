import { useState, useEffect } from 'react'
import { useAuthStore } from '@renderer/store/useAuthStore'

type BottomShortcutBarProps = {
  onInventoryClick: () => void
}

const F_KEYS = [
  { key: 'F1', label: 'Help' },
  { key: 'F2', label: 'Inventory', action: 'inventory' },
  { key: 'F3', label: 'Clock In/Out' },
  { key: 'F4', label: 'Customers' },
  { key: 'F5', label: 'Reports' },
  { key: 'F6', label: 'Manager' }
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

export function BottomShortcutBar({ onInventoryClick }: BottomShortcutBarProps): React.JSX.Element {
  const logout = useAuthStore((s) => s.logout)
  const datetime = useCurrentTime()
  const [datePart, timePart] = datetime.split('\n')

  return (
    <footer
      className="flex items-center gap-2 h-14 px-4 overflow-hidden border-t"
      style={{
        background: 'var(--bottom-bg)',
        borderColor: 'var(--bottom-border)'
      }}
      data-testid="bottom-bar"
    >
      {/* F-Key buttons */}
      <div className="flex gap-1 flex-1 py-2">
        {F_KEYS.map(({ key, label, action }) => (
          <button
            key={key}
            type="button"
            className="flex items-center gap-2 px-3 py-2.5 border-none cursor-pointer"
            style={{
              background: 'var(--bottom-key-bg)',
              borderBottomColor: 'var(--bottom-key-border)',
              borderBottomStyle: 'solid',
              borderBottomWidth: '2px',
              fontFamily: 'var(--font-display)'
            }}
            onClick={action === 'inventory' ? onInventoryClick : undefined}
          >
            <span
              className="px-1 text-[10px] font-black text-center text-white"
              style={{ background: 'var(--bottom-key-badge-bg)' }}
            >
              {key}
            </span>
            <span
              className="text-[15px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--bottom-key-text)' }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-8 w-0.5 mx-1" style={{ background: 'var(--bottom-border)' }} />

      {/* Date/time + Exit */}
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          <div
            className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {datePart}
          </div>
          <div
            className="text-[10px] font-black uppercase tracking-wider"
            style={{ color: 'var(--text-label)' }}
          >
            {timePart}
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-1.5 border cursor-pointer text-[10px] font-black uppercase tracking-wider"
          style={{
            background: 'var(--bottom-exit-bg)',
            borderColor: 'var(--bottom-exit-border)',
            color: 'var(--bottom-exit-text)',
            fontFamily: 'var(--font-display)'
          }}
          onClick={logout}
          data-testid="exit-pos-button"
        >
          EXIT POS
        </button>
      </div>
    </footer>
  )
}
