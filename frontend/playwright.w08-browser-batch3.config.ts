import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'w08-browser-flow-batch3.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: (
        'cd ../backend && '
        + 'W07_RUNNABLE_E2E=1 '
        + 'W07_E2E_USERNAME=w08_browser_batch3_user '
        + 'W07_E2E_TASK_ID=task-w08-browser-batch3 '
        + 'python3 harness/chaotang-true-loop/scripts/run_w07_runnable_backend.py'
      ),
      url: 'http://127.0.0.1:8081/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: (
        'CHAOTANG_BACKEND_API_URL=http://127.0.0.1:8081 '
        + 'pnpm exec next dev -p 3002'
      ),
      url: 'http://127.0.0.1:3002/shangshufang',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
