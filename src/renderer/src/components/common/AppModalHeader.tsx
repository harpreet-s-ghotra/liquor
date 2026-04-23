import type { ReactNode } from 'react'
import './app-modal-header.css'

type AppModalHeaderProps = {
  icon: ReactNode
  label: string
  title: string
  onClose: () => void
  /** Optional extra controls rendered to the left of the Close button. */
  actions?: ReactNode
  /** Custom label for the close button. Defaults to "Close". */
  closeLabel?: string
  /** Disable the Close button (e.g. while an action is mid-flight). */
  closeDisabled?: boolean
  className?: string
}

/**
 * Unified modal header used by every app dialog.
 *
 * Visual contract:
 * - Dark toolbar strip (`#2d3133`)
 * - Square icon tile on the left
 * - Breadcrumb `LABEL / Title` in the middle
 * - Optional action slot
 * - Close button on the right
 *
 * ESC key closure is handled by the underlying Radix `Dialog` — every modal must
 * keep `onEscapeKeyDown` at its default so pressing ESC fires `onClose`.
 */
export function AppModalHeader({
  icon,
  label,
  title,
  onClose,
  actions,
  closeLabel = 'Close',
  closeDisabled = false,
  className
}: AppModalHeaderProps): React.JSX.Element {
  return (
    <div className={`app-modal-header${className ? ` ${className}` : ''}`}>
      <div className="app-modal-header__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="app-modal-header__breadcrumb">
        <span className="app-modal-header__label">{label}</span>
        <span className="app-modal-header__separator">/</span>
        <span className="app-modal-header__title">{title}</span>
      </div>
      {actions && <div className="app-modal-header__actions">{actions}</div>}
      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        className="app-modal-header__close-btn"
        aria-label={`${closeLabel} ${title}`}
      >
        {closeLabel}
      </button>
    </div>
  )
}
