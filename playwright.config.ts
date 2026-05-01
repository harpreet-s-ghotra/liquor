import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    // Default 5s assertion timeout flakes on Windows CI where the Vite + Chromium
    // combo competes for CPU. 10s gives async data-fetch chains room to settle.
    timeout: 10_000
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  // Cap workers on CI so the Vite dev server isn't overwhelmed by parallel
  // page loads — past failures included ERR_CONNECTION_FAILED mid-suite.
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev:renderer',
    port: 4173,
    reuseExistingServer: true,
    timeout: 180_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
