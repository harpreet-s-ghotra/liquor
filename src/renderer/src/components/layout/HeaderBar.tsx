import { CircleHelp, Settings, Sun, Moon, User } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useThemeStore } from '@renderer/store/useThemeStore'

type HeaderBarProps = {
  cashierName?: string
}

export function HeaderBar({ cashierName }: HeaderBarProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <header
      className="flex items-center justify-end gap-4 px-6 h-16 border-b-2"
      style={{
        background: 'var(--header-bg)',
        borderColor: 'var(--header-border)'
      }}
      data-testid="header-bar"
    >
      {/* Left: status indicator */}
      <div className="mr-auto flex items-center gap-3">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--header-status)', fontFamily: 'var(--font-body)' }}
        >
          Register Active
        </span>
      </div>

      {/* Right: icons + badge */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="p-2 bg-transparent border-none cursor-pointer"
          style={{ color: 'var(--text-label)' }}
          aria-label="Help"
        >
          <CircleHelp size={20} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="p-2 bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--text-label)' }}
            aria-label="Settings"
            onClick={() => setMenuOpen((o) => !o)}
            data-testid="settings-button"
          >
            <Settings size={20} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 min-w-[12rem] rounded-[var(--radius)] border p-1 shadow-lg"
              style={{
                background: 'var(--bg-panel)',
                borderColor: 'var(--border-strong)'
              }}
              data-testid="settings-dropdown"
            >
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold rounded-[var(--radius)] border-none cursor-pointer"
                style={{
                  background: 'var(--bg-surface-soft)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)'
                }}
                onClick={() => {
                  toggleTheme()
                  setMenuOpen(false)
                }}
                data-testid="theme-toggle"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 border rounded-[var(--radius)]"
          style={{
            background: 'var(--header-badge-bg)',
            borderColor: 'var(--header-badge-border)',
            color: 'var(--header-badge-text)',
            fontFamily: 'var(--font-display)'
          }}
        >
          <User size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">
            {cashierName ?? 'Admin'}
          </span>
        </div>
      </div>
    </header>
  )
}
