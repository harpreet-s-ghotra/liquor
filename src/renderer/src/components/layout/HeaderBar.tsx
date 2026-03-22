import { CircleHelp, Settings, Sun, Moon, User } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useThemeStore } from '@renderer/store/useThemeStore'
import './header-bar.css'

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
    <header className="header-bar" data-testid="header-bar">
      <div className="header-bar__left">
        <span className="header-bar__status">Register Active</span>
      </div>

      <div className="header-bar__right">
        <button type="button" className="header-bar__icon-btn" aria-label="Help">
          <CircleHelp size={20} />
        </button>

        <div className="header-bar__settings-wrapper" ref={menuRef}>
          <button
            type="button"
            className="header-bar__icon-btn"
            aria-label="Settings"
            onClick={() => setMenuOpen((o) => !o)}
            data-testid="settings-button"
          >
            <Settings size={20} />
          </button>

          {menuOpen && (
            <div className="header-bar__dropdown" data-testid="settings-dropdown">
              <button
                type="button"
                className="header-bar__dropdown-item"
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

        <div className="header-bar__badge">
          <User size={16} />
          <span className="header-bar__badge-name">{cashierName ?? 'Admin'}</span>
        </div>
      </div>
    </header>
  )
}
