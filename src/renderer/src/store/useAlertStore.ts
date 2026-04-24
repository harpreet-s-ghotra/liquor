import { create } from 'zustand'

export type AlertType = 'error' | 'warning' | 'success' | 'info'

export type Alert = {
  id: string
  message: string
  type: AlertType
  timestamp: number
}

type AlertStore = {
  alerts: Alert[]
  showAlert: (message: string, type: AlertType) => void
  showError: (message: string) => void
  showWarning: (message: string) => void
  showSuccess: (message: string) => void
  showInfo: (message: string) => void
  dismissAlert: (id: string) => void
}

const AUTO_DISMISS_MS: Record<AlertType, number> = {
  error: 6000,
  warning: 4000,
  success: 3000,
  info: 3000
}

const MAX_ALERTS = 5

// Timers live outside the Zustand state — they aren't part of UI state and
// shouldn't trigger re-renders when set/cleared.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(id: string): void {
  const handle = timers.get(id)
  if (handle !== undefined) {
    clearTimeout(handle)
    timers.delete(id)
  }
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],

  showAlert: (message: string, type: AlertType) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const alert: Alert = { id, message, type, timestamp: Date.now() }

    const next = [...get().alerts, alert]
    // Cap stack — drop oldest and cancel its timer.
    while (next.length > MAX_ALERTS) {
      const dropped = next.shift()
      if (dropped) clearTimer(dropped.id)
    }
    set({ alerts: next })

    const handle = setTimeout(() => {
      timers.delete(id)
      get().dismissAlert(id)
    }, AUTO_DISMISS_MS[type])
    timers.set(id, handle)
  },

  showError: (message: string) => get().showAlert(message, 'error'),
  showWarning: (message: string) => get().showAlert(message, 'warning'),
  showSuccess: (message: string) => get().showAlert(message, 'success'),
  showInfo: (message: string) => get().showAlert(message, 'info'),

  dismissAlert: (id: string) => {
    clearTimer(id)
    set({ alerts: get().alerts.filter((a) => a.id !== id) })
  }
}))
