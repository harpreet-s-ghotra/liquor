import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    include: ['src/renderer/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: [
        'src/renderer/src/App.tsx',
        'src/renderer/src/components/**/*.tsx',
        'src/renderer/src/pages/**/*.tsx',
        'src/renderer/src/store/**/*.ts',
        'src/renderer/src/utils/**/*.ts'
      ],
      exclude: ['src/renderer/src/components/Versions.tsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
})
