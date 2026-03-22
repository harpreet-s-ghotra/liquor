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

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],

  showAlert: (message: string, type: AlertType) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const alert: Alert = { id, message, type, timestamp: Date.now() }
    set({ alerts: [...get().alerts, alert] })

    setTimeout(() => {
      get().dismissAlert(id)
    }, AUTO_DISMISS_MS[type])
  },

  showError: (message: string) => get().showAlert(message, 'error'),
  showWarning: (message: string) => get().showAlert(message, 'warning'),
  showSuccess: (message: string) => get().showAlert(message, 'success'),
  showInfo: (message: string) => get().showAlert(message, 'info'),

  dismissAlert: (id: string) => {
    set({ alerts: get().alerts.filter((a) => a.id !== id) })
  }
}))
