import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002/';

// E2E 配置：复用已在 3002 跑着的 dev 服务（没有就自动起一个）。
// 端口纪律见 AGENTS.md §0：dev=3002，绝不碰 3050(prod)/3001(禁用)。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'
    ? undefined
    : {
        command: 'pnpm exec next dev -p 3002 --hostname 127.0.0.1 --webpack',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
        // dev/prod .next 隔离(2026-07-04·根治"pnpm dev 弄坏正在跑的 prod" 这个已实测发生过一次
        // 的8小时故障根因)：此命令直接调 next dev，绕开 next-with-base-path.mjs 里的隔离逻辑，
        // 此前 e2e 套件自己起的 webServer 会跟 prod 共享默认 `.next`。显式设 NEXT_DIST_DIR，
        // 独立于 pnpm dev 用的 `.next-dev`，避免并发跑 e2e + 手动 dev 时二者互相打架。
        env: { NEXT_DIST_DIR: '.next-e2e' },
      },
});
