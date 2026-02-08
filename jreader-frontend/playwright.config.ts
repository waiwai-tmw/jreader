import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const PORT = Number(process.env.E2E_PORT ?? 4001)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !isCI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: isCI ? 'line' : 'html',
  use: {
    baseURL: BASE_URL,
    trace: isCI ? 'on-first-retry' : 'on',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Always use production build for consistent, reliable tests
    // The production build is more stable than the dev server
    // Uses PHASE_PRODUCTION_SERVER to read from .next-prod
    // Run 'npm run build' manually before running tests
    command: `npm run start -- -p ${PORT}`,
    port: PORT,
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      E2E_FAKE_AUTH: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12 Pro'] },
    },
  ],
})
