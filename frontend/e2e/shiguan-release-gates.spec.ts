import { expect, test } from '@playwright/test';
import { seedSession } from './fixtures';

test.describe('史馆发布可信战报', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.route('**/api/court/true-chain-health', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            summary: { ready: 8, degraded: 0, down: 0, mock: 0, missing: 0, requiredDown: 0 },
            recommendation: '发布门禁已通过。',
            checks: [],
          },
        },
      });
    });
    await page.route('**/api/court/shiguan/release-gates**', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            status: 'ready',
            latest: {
              schema: 'chaotang.release-gates.v1',
              runId: 'e2e-release-gates',
              startedAt: '2026-06-07T10:00:00.000Z',
              finishedAt: '2026-06-07T10:07:06.000Z',
              decision: 'SHIP',
              gitCommit: '77ed86a889900',
              summary: { total: 8, passed: 8, failed: 0, durationMs: 426000 },
              evidence: {
                releaseReport: 'artifacts/chaotang-release-gates/latest.json',
                screenshotQaReport: 'artifacts/release-screenshot-qa/dev-gates/latest.json',
                screenshotQaSummary: {
                  total: 20,
                  completed: 20,
                  passed: 20,
                  failed: 0,
                  screenshotCount: 20,
                },
              },
              stages: [
                { id: 'typescript', status: 'passed', durationMs: 3200 },
                { id: 'browser:dev-server', status: 'passed', durationMs: 14400 },
                {
                  id: 'browser:critical-flows',
                  status: 'passed',
                  durationMs: 119800,
                  evidence: {
                    specs: [
                      'e2e/capability-debt.spec.ts',
                      'e2e/donggong.spec.ts',
                      'e2e/gongbu-rd-pipeline.spec.ts',
                      'e2e/shiguan-release-gates.spec.ts',
                      'e2e/shangshufang-ux.spec.ts',
                    ],
                  },
                },
                { id: 'screenshot-qa', status: 'passed', durationMs: 172000 },
                { id: 'production-build', status: 'passed', durationMs: 116000 },
              ],
            },
            screenshotQa: {
              decision: 'SHIP',
              outputDir: 'artifacts/release-screenshot-qa/dev-gates/e2e-release-gates',
              summary: { total: 20, completed: 20, passed: 20, failed: 0, screenshotCount: 20 },
              blockers: [],
            },
            audit: [
              {
                schema: 'chaotang.release-audit.v1',
                runId: 'e2e-release-gates',
                checkedAt: '2026-06-07T10:07:06.000Z',
                decision: 'SHIP',
                summary: { total: 8, passed: 8, failed: 0, durationMs: 426000 },
                evidence: {
                  releaseReport: 'artifacts/chaotang-release-gates/latest.json',
                  screenshotQaReport: 'artifacts/release-screenshot-qa/dev-gates/latest.json',
                },
                failedStages: [],
              },
            ],
            paths: {
              releaseReport: 'artifacts/chaotang-release-gates/latest.json',
              releaseAudit: 'artifacts/chaotang-release-gates/release-audit.jsonl',
              screenshotQaReport: 'artifacts/release-screenshot-qa/dev-gates/latest.json',
            },
          },
        },
      });
    });
    await page.route('**/api/court/shiguan/stats', async (route) => {
      await route.fulfill({ json: { totalTasks: 0, totalCases: 0, successRate: 0 } });
    });
    await page.route('**/api/court/chaotang/archive/knowledge/count', async (route) => {
      await route.fulfill({ json: { success: true, data: { count: 0 } } });
    });
    await page.route('**/api/court/chaotang/archive', async (route) => {
      await route.fulfill({ json: { success: true, data: { memorials: [], decisions: [] } } });
    });
    await page.route('**/api/scribe/lessons', async (route) => {
      await route.fulfill({ json: { lessons: [] } });
    });
    await page.route('**/api/build-ledger**', async (route) => {
      await route.fulfill({ json: { success: true, data: [] } });
    });
  });

  test('用户能在史馆看到每次发布为什么可信', async ({ page }) => {
    const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '';
    await page.goto(`${basePath}/shiguan`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await expect(page.getByText('发布可信战报')).toBeVisible();
    await expect(page.getByText('SHIP', { exact: true })).toBeVisible();
    await expect(page.getByText('8/8').first()).toBeVisible();
    await expect(page.getByText('截图 QA 20/20')).toBeVisible();
    await expect(page.getByText('browser:critical-flows')).toBeVisible();
    await expect(page.getByText('production-build')).toBeVisible();
    await expect(page.getByText('独立审计 JSONL')).toBeVisible();
    await expect(page.getByText('release-audit.jsonl')).toBeVisible();
  });
});
