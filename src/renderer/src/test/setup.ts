import '@testing-library/jest-dom/vitest'

// Radix UI primitives use ResizeObserver internally; JSDOM doesn't provide it.
globalThis.ResizeObserver ??= class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
} as unknown as typeof globalThis.ResizeObserver
