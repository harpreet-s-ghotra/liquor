import { create } from 'zustand'

type ReportsPrefsStore = {
  registerScopedByDevice: Record<string, boolean>
  isRegisterScoped: (deviceId: string | null | undefined) => boolean
  setRegisterScoped: (deviceId: string, value: boolean) => void
}

const STORAGE_KEY = 'pos-reports-prefs'

function loadPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable
  }
}

export const useReportsPrefsStore = create<ReportsPrefsStore>()((set, get) => ({
  registerScopedByDevice: loadPrefs(),

  isRegisterScoped: (deviceId) => {
    if (!deviceId) return false
    return get().registerScopedByDevice[deviceId] ?? false
  },

  setRegisterScoped: (deviceId, value) => {
    set((s) => {
      const next = { ...s.registerScopedByDevice, [deviceId]: value }
      savePrefs(next)
      return { registerScopedByDevice: next }
    })
  }
}))
