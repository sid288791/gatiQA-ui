import { defineConfig } from '@playwright/test';

/**
 * E2E runs against the Vite dev server with the synthetic fixture backend
 * enabled (VITE_USE_FIXTURES=true). The fixture layer implements the same
 * OpenAPI contract as the real backend.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:fixtures',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
