import { expect, test, type Page } from '@playwright/test';

import {
  installRealBrowserSession,
  registerAndLoginRealUser,
} from './helpers/real-backend-auth';

const USERNAME = 'w08_browser_batch2_user';
const TASK_ID = 'task-w08-browser-batch2';
const PARTIAL_TASK_ID = `${TASK_ID}-partial`;

type RealSession = {
  token: string;
  tenantId: number;
};

type HomeTask = {
  task_id: string;
  raw_question: string;
  contract_task: boolean;
};

let session: RealSession;
let archiveId = '';

async function seedContracts() {
  const seedResponse = await fetch('http://127.0.0.1:8081/__w07/seed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(seedResponse.status).toBe(200);
}

async function openContractTaskFromHome(
  page: Page,
  taskId: string,
  title: string,
) {
  const homeResponsePromise = page.waitForResponse((response) => (
    response.url().includes('/api/shangshufang/home/v1')
    && response.request().method() === 'GET'
  ));
  await page.goto('/shangshufang');
  const homeResponse = await homeResponsePromise;
  expect(homeResponse.status()).toBe(200);

  const homePayload = await homeResponse.json() as {
    data?: {
      pending_decisions?: HomeTask[];
      pending_evidence_tasks?: HomeTask[];
    };
  };
  const homeTasks = [
    ...(homePayload.data?.pending_decisions ?? []),
    ...(homePayload.data?.pending_evidence_tasks ?? []),
  ];
  const taskIndex = homeTasks.findIndex((task) => task.task_id === taskId);
  expect(taskIndex).toBeGreaterThanOrEqual(0);
  expect(homeTasks[taskIndex]).toMatchObject({
    task_id: taskId,
    raw_question: title,
    contract_task: true,
  });

  const expandRails = page.getByRole('button', { name: /展开辅政/ });
  if (await expandRails.isVisible()) {
    await expandRails.click();
  }
  expect(taskIndex).toBeLessThan(3);
  const taskItem = page.getByTestId('chancellor-visible-item').nth(taskIndex);
  await expect(taskItem).toBeVisible();
  await taskItem.click();
}

async function installSession(page: Page) {
  await installRealBrowserSession(page, session, USERNAME);
}

test.describe('W08 browser flow batch 2', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    session = await registerAndLoginRealUser(USERNAME);
    await seedContracts();
  });

  test('flow 2: generates, downloads, archives and reopens exact lineage', async ({ page }, testInfo) => {
    await installSession(page);
    await openContractTaskFromHome(page, TASK_ID, '审查合成采购合同');

    const panel = page.getByTestId('contract-review-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('NOT_DELIVERED');

    const deliveryResponse = page.waitForResponse((response) => (
      response.url().includes('/api/artifacts/deliveries')
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('contract-action-generate_delivery').click();
    expect((await deliveryResponse).status()).toBe(201);
    await expect(panel).toContainText('READY');

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
    archiveId = decisionPayload.data.archive_record.archive_id as string;
    expect(archiveId).toMatch(/^archive_/);
    await expect(panel).toContainText('ARCHIVED');

    await page.getByTestId('contract-action-reopen_archive').click();
    await expect(page).toHaveURL(new RegExp(`/shiguan\\?taskId=${TASK_ID}`));
    await expect(
      page.locator('[data-contract-read-model-status="ready"]'),
    ).toBeVisible();
    await expect(page.getByTestId('contract-archive-identity')).toContainText(
      `final-${TASK_ID}`,
    );
    await page.screenshot({
      path: testInfo.outputPath('w08-batch2-flow2-exact-lineage.png'),
      fullPage: true,
    });
  });

  test('flow 3: rejects tampered archive identity in Shiguan replay', async ({ page }, testInfo) => {
    await installSession(page);
    await page.goto(`/shiguan?taskId=${TASK_ID}&archiveId=archive-tampered`);
    await expect(
      page.locator('[data-contract-read-model-status="error"]'),
    ).toBeVisible();
    await expect(
      page.getByTestId('contract-archive-readback-error'),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('w08-batch2-flow3-tampered-archive.png'),
      fullPage: true,
    });
  });

  test('flow 4: keeps partial delivery non-decidable after refresh', async ({ page }, testInfo) => {
    await installSession(page);
    await openContractTaskFromHome(
      page,
      PARTIAL_TASK_ID,
      '审查合成采购合同（部分交付）',
    );

    const panel = page.getByTestId('contract-review-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('PARTIAL');
    await expect(panel).toContainText('部分交付可下载；刷新后暂不支持恢复');
    await expect(page.getByTestId('contract-action-decide')).toHaveCount(0);
    await expect(
      page.getByTestId('contract-action-resume_delivery'),
    ).toHaveCount(0);

    await page.reload();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('PARTIAL');
    await expect(page.getByTestId('contract-action-decide')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('w08-batch2-flow4-partial-refresh.png'),
      fullPage: true,
    });
  });
});
