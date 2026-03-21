import { create } from 'zustand'

export type Theme = 'dark' | 'light'

type ThemeStore = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const getStoredTheme = (): Theme => {
  try {
    return (localStorage.getItem('pos-theme') as Theme) ?? 'dark'
  } catch {
    return 'dark'
  }
}

const persistTheme = (theme: Theme): void => {
  try {
    localStorage.setItem('pos-theme', theme)
  } catch {
    // localStorage unavailable (e.g. JSDOM tests)
  }
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: getStoredTheme(),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),

  setTheme: (theme: Theme) => {
    persistTheme(theme)
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  }
}))
