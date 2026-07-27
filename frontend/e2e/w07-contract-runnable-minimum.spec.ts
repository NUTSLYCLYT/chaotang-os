import { expect, test } from '@playwright/test';

import {
  installRealBrowserSession,
  registerAndLoginRealUser,
} from './helpers/real-backend-auth';

const USERNAME = 'w07_runnable_user';
const TASK_ID = 'task-w07-runnable-minimum';
const PARTIAL_TASK_ID = `${TASK_ID}-partial`;

test.describe('W07 contract RUNNABLE_MINIMUM', () => {
  test.describe.configure({ mode: 'serial' });

  test('real JWT flow generates, downloads, archives and reopens the review pack', async ({ page }, testInfo) => {
    const session = await registerAndLoginRealUser(USERNAME);
    await installRealBrowserSession(page, session, USERNAME);

    const seedResponse = await fetch('http://127.0.0.1:8081/__w07/seed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(seedResponse.status).toBe(200);

    await expect.poll(async () => {
      const response = await fetch(
        `http://127.0.0.1:8081/api/contracts/tasks/${TASK_ID}/read-model`,
        { headers: { Authorization: `Bearer ${session.token}` } },
      );
      return response.status;
    }).toBe(200);
    await expect.poll(async () => {
      const response = await fetch(
        `http://127.0.0.1:8081/api/contracts/tasks/${PARTIAL_TASK_ID}/read-model`,
        { headers: { Authorization: `Bearer ${session.token}` } },
      );
      return response.status;
    }).toBe(200);

    await page.goto(`/shangshufang?taskId=${TASK_ID}`);
    const panel = page.getByTestId('contract-review-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('审查合成采购合同');
    await expect(panel).toContainText('NOT_DELIVERED');
    await expect(page.getByText('此折已驳回 · 三项圣裁已锁定')).toHaveCount(0);

    const deliveryResponse = page.waitForResponse((response) => (
      response.url().includes('/api/artifacts/deliveries')
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('contract-action-generate_delivery').click();
    expect((await deliveryResponse).status()).toBe(201);
    await expect(panel).toContainText('READY');
    await expect(page.getByTestId('contract-action-decide')).toBeVisible();

    await page.reload();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('READY');
    await expect(page.getByTestId('contract-action-decide')).toBeVisible();

    const download = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'JSON' }).click();
    await expect((await download).suggestedFilename()).toContain('json');

    const decisionResponse = page.waitForResponse((response) => (
      response.url().includes(`/api/shangshufang/tasks/${TASK_ID}/decision`)
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('contract-action-decide').click();
    const decision = await decisionResponse;
    expect(decision.status()).toBe(200);
    const decisionPayload = await decision.json();
    const archiveId = decisionPayload.data.archive_record.archive_id as string;
    await expect(panel).toContainText('ARCHIVED');

    await page.getByTestId('contract-action-reopen_archive').click();
    await expect(page).toHaveURL(new RegExp(`/shiguan\\?taskId=${TASK_ID}`));
    await expect(
      page.locator('[data-contract-read-model-status="ready"]'),
    ).toBeVisible();
    const archiveIdentity = page.getByTestId('contract-archive-identity');
    await expect(archiveIdentity).toContainText('精确归档');
    await expect(archiveIdentity).toContainText(
      'final-task-w07-runnable-minimum',
    );
    await page.goto(
      `/shiguan?taskId=${TASK_ID}&archiveId=${encodeURIComponent(archiveId)}`,
    );
    await expect(
      page.locator('[data-contract-read-model-status="ready"]'),
    ).toBeVisible();
    await expect(page.getByTestId('contract-archive-identity')).toBeVisible();
    await page.waitForTimeout(1_200);
    await page.screenshot({
      path: testInfo.outputPath('w07-shiguan-exact-lineage.png'),
      fullPage: true,
    });

    await page.goto(
      `/shiguan?taskId=${TASK_ID}&archiveId=archive-tampered`,
    );
    await expect(
      page.locator('[data-contract-read-model-status="error"]'),
    ).toBeVisible();
    await expect(
      page.getByTestId('contract-archive-readback-error'),
    ).toBeVisible();

    await page.goto(`/shangshufang?taskId=${PARTIAL_TASK_ID}`);
    const partialPanel = page.getByTestId('contract-review-panel');
    await expect(partialPanel).toBeVisible();
    await expect(partialPanel).toContainText('PARTIAL');
    await expect(partialPanel).toContainText(
      '部分交付可下载；刷新后暂不支持恢复',
    );
    await expect(
      page.getByTestId('contract-action-resume_delivery'),
    ).toHaveCount(0);
    await expect(page.getByTestId('contract-action-decide')).toHaveCount(0);
    await expect(partialPanel).not.toContainText('ARCHIVED');

    await page.reload();
    await expect(partialPanel).toBeVisible();
    await expect(partialPanel).toContainText('PARTIAL');
    await expect(partialPanel).toContainText(
      '部分交付可下载；刷新后暂不支持恢复',
    );
    await expect(page.getByTestId('contract-action-decide')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('w07-partial-after-refresh.png'),
      fullPage: true,
    });
  });
});
