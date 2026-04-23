import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'

// Radix UI primitives use ResizeObserver internally; JSDOM doesn't provide it.
globalThis.ResizeObserver ??= class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
} as unknown as typeof globalThis.ResizeObserver

// JSDOM's localStorage is unavailable for opaque origins; install an in-memory
// polyfill so components that persist state do not crash during tests.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    }
  } satisfies Storage
}

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('__probe__', '1')
    window.localStorage.removeItem('__probe__')
  } catch {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage()
    })
  }
}

// Isolate localStorage state between tests so persisted UI preferences from
// one test do not leak into the next.
beforeEach(() => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
  }
})

import { vi } from 'vitest'

vi.mock('electron-log/renderer', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    functions: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    }
  },
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
}))
