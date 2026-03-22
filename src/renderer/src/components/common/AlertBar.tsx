import { useAlertStore, type AlertType } from '@renderer/store/useAlertStore'
import './alert-bar.css'

const ALERT_STYLES: Record<AlertType, { bg: string; border: string; text: string }> = {
  error: {
    bg: 'rgba(127, 29, 29, 0.95)',
    border: 'rgba(185, 28, 28, 0.6)',
    text: '#fee2e2'
  },
  warning: {
    bg: 'rgba(120, 53, 15, 0.95)',
    border: 'rgba(234, 88, 12, 0.6)',
    text: '#ffedd5'
  },
  success: {
    bg: 'rgba(6, 78, 59, 0.95)',
    border: 'rgba(16, 185, 129, 0.6)',
    text: '#d1fae5'
  },
  info: {
    bg: 'rgba(30, 58, 138, 0.95)',
    border: 'rgba(59, 130, 246, 0.6)',
    text: '#dbeafe'
  }
}

export function AlertBar(): React.JSX.Element | null {
  const alerts = useAlertStore((s) => s.alerts)
  const dismissAlert = useAlertStore((s) => s.dismissAlert)

  if (alerts.length === 0) return null

  return (
    <div className="alert-bar" data-testid="alert-bar">
      {alerts.map((alert) => {
        const s = ALERT_STYLES[alert.type]
        return (
          <div
            key={alert.id}
            className="alert-bar__item"
            style={{
              background: s.bg,
              borderColor: s.border,
              color: s.text,
              fontFamily: 'var(--font-body)'
            }}
            data-testid={`alert-${alert.type}`}
            role="alert"
          >
            <span className="alert-bar__message">{alert.message}</span>
            <button
              type="button"
              className="alert-bar__dismiss"
              style={{ color: s.text }}
              onClick={() => dismissAlert(alert.id)}
              aria-label="Dismiss alert"
            >
              X
            </button>
          </div>
        )
      })}
    </div>
  )
}
