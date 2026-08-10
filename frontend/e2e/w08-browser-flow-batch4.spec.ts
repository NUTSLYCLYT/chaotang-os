import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  installRealBrowserSession,
  registerAndLoginRealUser,
} from './helpers/real-backend-auth';

const USERNAME = 'w08_browser_batch4_user';
const TASK_ID = 'task-w08-browser-batch4';

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

async function seedContracts() {
  const seedResponse = await fetch('http://127.0.0.1:8081/__w07/seed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(seedResponse.status).toBe(200);
}

async function installSession(page: Page) {
  await installRealBrowserSession(page, session, USERNAME);
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

async function ensureReadyDelivery(page: Page): Promise<Locator> {
  const panel = page.getByTestId('contract-review-panel');
  await expect(panel).toBeVisible();
  if (await page.getByTestId('contract-action-generate_delivery').isVisible()) {
    const deliveryResponse = page.waitForResponse((response) => (
      response.url().includes('/api/artifacts/deliveries')
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('contract-action-generate_delivery').click();
    expect((await deliveryResponse).status()).toBe(201);
  }
  await expect(panel).toContainText('READY');
  return panel;
}

test.describe('W08 browser flow batch 4', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    session = await registerAndLoginRealUser(USERNAME);
    await seedContracts();
  });

  test('flow 8: duplicate delivery click sends one command and stays READY', async ({ page }, testInfo) => {
    await installSession(page);
    await openContractTaskFromHome(page, TASK_ID, '审查合成采购合同');

    const deliveryResponses: number[] = [];
    page.on('response', (response) => {
      if (
        response.url().includes('/api/artifacts/deliveries')
        && response.request().method() === 'POST'
      ) {
        deliveryResponses.push(response.status());
      }
    });

    const action = page.getByTestId('contract-action-generate_delivery');
    await expect(action).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => (
        response.url().includes('/api/artifacts/deliveries')
        && response.request().method() === 'POST'
      )),
      action.dblclick(),
    ]);

    const panel = page.getByTestId('contract-review-panel');
    await expect(panel).toContainText('READY');
    await expect.poll(() => deliveryResponses.length).toBe(1);
    expect(deliveryResponses).toEqual([201]);
    await page.screenshot({
      path: testInfo.outputPath('w08-batch4-flow8-duplicate-delivery.png'),
      fullPage: true,
    });
  });

  test('flow 9: READY delivery remains downloadable after reload', async ({ page }, testInfo) => {
    await installSession(page);
    await openContractTaskFromHome(page, TASK_ID, '审查合成采购合同');
    const panel = await ensureReadyDelivery(page);

    await page.reload();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('READY');
    for (const kind of ['PDF', 'DOCX', 'JSON']) {
      await expect(panel.getByRole('button', { name: kind })).toBeEnabled();
    }
    await page.screenshot({
      path: testInfo.outputPath('w08-batch4-flow9-ready-reload.png'),
      fullPage: true,
    });
  });

  test('flow 10: archived task reopens as read-only audit without old actions', async ({ page }, testInfo) => {
    await installSession(page);
    await openContractTaskFromHome(page, TASK_ID, '审查合成采购合同');
    const panel = await ensureReadyDelivery(page);

    const decisionResponse = page.waitForResponse((response) => (
      response.url().includes(`/api/shangshufang/tasks/${TASK_ID}/decision`)
      && response.request().method() === 'POST'
    ));
    await page.getByTestId('contract-action-decide').click();
    const decision = await decisionResponse;
    expect(decision.status()).toBe(200);
    const decisionPayload = await decision.json();
    const archiveId = decisionPayload.data.archive_record.archive_id as string;
    expect(archiveId).toMatch(/^archive_/);
    await expect(panel).toContainText('ARCHIVED');

    await page.getByTestId('contract-action-reopen_archive').click();
    await expect(page).toHaveURL(new RegExp(`/shiguan\\?taskId=${TASK_ID}`));
    await page.goto(
      `/shiguan?taskId=${TASK_ID}&archiveId=${encodeURIComponent(archiveId)}`,
    );
    await expect(
      page.locator('[data-contract-read-model-status="ready"]'),
    ).toBeVisible();
    await expect(page.getByTestId('contract-archive-audit-panel')).toContainText(
      '只读审计',
    );
    await expect(page.getByTestId('contract-action-decide')).toHaveCount(0);
    await expect(page.getByTestId('contract-action-generate_delivery')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('w08-batch4-flow10-readonly-archive.png'),
      fullPage: true,
    });
  });
});
