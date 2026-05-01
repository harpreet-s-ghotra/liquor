import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    // Windows CI runners are noticeably slower at filesystem + sqlite ops than
    // macOS/Linux. Default 5s timeout flakes on multi-DB lifecycle tests.
    testTimeout: 30000,
    hookTimeout: 30000,
    include: [
      'src/main/**/*.test.ts',
      'src/shared/**/*.test.ts',
      'tools/catalog-admin/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: false,
      exclude: ['src/main/database/schema.ts', 'src/main/database/seed.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
})
