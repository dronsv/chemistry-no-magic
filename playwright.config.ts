import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4322',
    headless: true,
  },
  webServer: {
    command: 'npx astro preview --port 4322',
    port: 4322,
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
