import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // A single `astro preview` server backs all tests. The default worker count
  // (≈ half the CPU cores) overwhelms it on high-core machines, causing slow
  // asset delivery → transient hydration mismatches and slow island hydration
  // that surface as flaky console-error / DOM-timing failures. Cap workers to
  // keep load realistic, and allow one retry to absorb residual load jitter — a
  // real (deterministic) failure still fails on retry; only load-flakes recover.
  workers: 4,
  retries: 1,
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
