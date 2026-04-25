import {
  CircleHelp,
  LogOut,
  Printer,
  RefreshCw,
  Settings,
  Store,
  Sun,
  Moon,
  User,
  ShieldCheck,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useThemeStore } from '@renderer/store/useThemeStore'
import type { CashierRole } from '@renderer/types/pos'
import './header-bar.css'

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.0

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10))
}

function factorToPercent(f: number): number {
  return Math.round(f * 100)
}

type HeaderBarProps = {
  cashierName?: string
  cashierRole?: CashierRole
  merchantName?: string
  registerName?: string
  canSignOutAccount?: boolean
  onSignOutAccount?: () => void
  onPrinterSettings?: () => void
  onCheckForUpdates?: () => void
  updateReadyVersion?: string | null
  onInstallUpdate?: () => void
}

export function HeaderBar({
  cashierName,
  cashierRole,
  merchantName,
  registerName,
  canSignOutAccount = false,
  onSignOutAccount,
  onPrinterSettings,
  onCheckForUpdates,
  updateReadyVersion,
  onInstallUpdate
}: HeaderBarProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const [zoomFactor, setZoomFactor] = useState<number>(1)

  // Sync displayed zoom whenever menu opens (picks up Cmd+= changes)
  useEffect(() => {
    if (menuOpen) {
      window.api
        ?.getZoomFactor?.()
        .then((f) => setZoomFactor(f ?? 1))
        .catch(() => {})
    }
  }, [menuOpen])

  const changeZoom = (delta: number): void => {
    const next = clampZoom(zoomFactor + delta)
    window.api?.setZoomFactor?.(next).catch(() => {})
    setZoomFactor(next)
  }

  const resetZoom = (): void => {
    window.api?.setZoomFactor?.(1).catch(() => {})
    setZoomFactor(1)
  }

  useEffect(() => {
    if (!menuOpen && !accountMenuOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [accountMenuOpen, menuOpen])

  const accountLabel = merchantName
    ? registerName
      ? `${merchantName} · ${registerName}`
      : merchantName
    : null

  return (
    <header className="header-bar" data-testid="header-bar">
      <div className="header-bar__left">
        <span className="header-bar__status">Register Active</span>
      </div>

      <div className="header-bar__right">
        <button type="button" className="header-bar__icon-btn" aria-label="Help">
          <CircleHelp size={20} />
        </button>

        {accountLabel ? (
          <div className="header-bar__account-wrapper" ref={accountRef}>
            <button
              type="button"
              className="header-bar__account-pill"
              aria-label="Active account"
              onClick={() => setAccountMenuOpen((open) => !open)}
              data-testid="account-pill"
            >
              <Store size={16} />
              <span className="header-bar__account-pill-text">{accountLabel}</span>
            </button>

            {accountMenuOpen ? (
              <div
                className="header-bar__dropdown header-bar__dropdown--account"
                data-testid="account-menu"
              >
                <button
                  type="button"
                  className="header-bar__dropdown-item"
                  onClick={() => {
                    onSignOutAccount?.()
                    setAccountMenuOpen(false)
                  }}
                  disabled={!canSignOutAccount}
                >
                  <LogOut size={16} />
                  Sign Out of Account
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

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
              <button
                type="button"
                className="header-bar__dropdown-item"
                onClick={() => {
                  onPrinterSettings?.()
                  setMenuOpen(false)
                }}
                data-testid="printer-settings-btn"
              >
                <Printer size={16} />
                Printer Settings
              </button>
              {updateReadyVersion ? (
                <button
                  type="button"
                  className="header-bar__dropdown-item header-bar__dropdown-item--update-ready"
                  onClick={() => {
                    onInstallUpdate?.()
                    setMenuOpen(false)
                  }}
                  data-testid="restart-to-install-btn"
                >
                  <RefreshCw size={16} />
                  Restart to install {updateReadyVersion}
                </button>
              ) : (
                <button
                  type="button"
                  className="header-bar__dropdown-item"
                  onClick={() => {
                    onCheckForUpdates?.()
                    setMenuOpen(false)
                  }}
                  data-testid="check-for-updates-btn"
                >
                  <RefreshCw size={16} />
                  Check for Updates
                </button>
              )}
              <div className="header-bar__dropdown-zoom" data-testid="zoom-controls">
                <button
                  type="button"
                  className="header-bar__zoom-btn"
                  onClick={() => changeZoom(-ZOOM_STEP)}
                  disabled={zoomFactor <= ZOOM_MIN}
                  aria-label="Zoom out"
                  data-testid="zoom-out-btn"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  className="header-bar__zoom-reset"
                  onClick={resetZoom}
                  aria-label="Reset zoom"
                  data-testid="zoom-reset-btn"
                >
                  {factorToPercent(zoomFactor)}%
                </button>
                <button
                  type="button"
                  className="header-bar__zoom-btn"
                  onClick={() => changeZoom(ZOOM_STEP)}
                  disabled={zoomFactor >= ZOOM_MAX}
                  aria-label="Zoom in"
                  data-testid="zoom-in-btn"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="header-bar__badge">
          {cashierRole === 'admin' ? <ShieldCheck size={16} /> : <User size={16} />}
          <span className="header-bar__badge-name">{cashierName ?? 'Cashier'}</span>
          {cashierRole === 'admin' && (
            <span className="header-bar__role-tag" data-testid="admin-badge">
              ADMIN
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
