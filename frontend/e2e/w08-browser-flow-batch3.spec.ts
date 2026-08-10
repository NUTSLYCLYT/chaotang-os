import { expect, test, type Page } from '@playwright/test';

import {
  installRealBrowserSession,
  registerAndLoginRealUser,
} from './helpers/real-backend-auth';

const OWNER_USERNAME = 'w08_browser_batch3_user';
const OTHER_USERNAME = 'w08_browser_batch3_other_user';
const TASK_ID = 'task-w08-browser-batch3';

type RealSession = {
  token: string;
  tenantId: number;
};

type HomeTask = {
  task_id: string;
  raw_question: string;
  contract_task: boolean;
};

let ownerSession: RealSession;
let otherSession: RealSession;
let archiveId = '';

async function seedContracts() {
  const seedResponse = await fetch('http://127.0.0.1:8081/__w07/seed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerSession.token}` },
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

async function installOwnerSession(page: Page) {
  await installRealBrowserSession(page, ownerSession, OWNER_USERNAME);
}

async function installOtherSession(page: Page) {
  await installRealBrowserSession(page, otherSession, OTHER_USERNAME);
}

async function generateDelivery(page: Page) {
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

test.describe('W08 browser flow batch 3', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    ownerSession = await registerAndLoginRealUser(OWNER_USERNAME);
    otherSession = await registerAndLoginRealUser(OTHER_USERNAME);
    expect(otherSession.tenantId).toBe(ownerSession.tenantId);
    await seedContracts();
  });

  test('flow 5: downloads PDF, DOCX and JSON artifacts from the review panel', async ({ page }, testInfo) => {
    await installOwnerSession(page);
    await openContractTaskFromHome(page, TASK_ID, '审查合成采购合同');
    const panel = await generateDelivery(page);

    for (const kind of ['PDF', 'DOCX', 'JSON']) {
      const download = page.waitForEvent('download');
      await panel.getByRole('button', { name: kind }).click();
      const suggestedFilename = (await download).suggestedFilename().toLowerCase();
      expect(suggestedFilename).toContain(kind.toLowerCase());
    }
    await page.screenshot({
      path: testInfo.outputPath('w08-batch3-flow5-all-artifacts.png'),
      fullPage: true,
    });
  });

  test('flow 6: unauthenticated browser cannot read the contract task', async ({ page }, testInfo) => {
    await page.goto(`/shangshufang?taskId=${TASK_ID}`);
    await expect(page.getByTestId('contract-review-panel')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('w08-batch3-flow6-unauthenticated.png'),
      fullPage: true,
    });
  });

  test('flow 7: same-tenant second user cannot replay the owner archive', async ({ page }, testInfo) => {
    await installOwnerSession(page);
    await openContractTaskFromHome(page, TASK_ID, '审查合成采购合同');
    await generateDelivery(page);

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

    const otherPage = await page.context().newPage();
    await installOtherSession(otherPage);
    await otherPage.goto(
      `/shiguan?taskId=${TASK_ID}&archiveId=${encodeURIComponent(archiveId)}`,
    );
    await expect(
      otherPage.locator('[data-contract-read-model-status="error"]'),
    ).toBeVisible();
    await expect(
      otherPage.getByTestId('contract-archive-readback-error'),
    ).toBeVisible();
    await otherPage.screenshot({
      path: testInfo.outputPath('w08-batch3-flow7-cross-user-replay.png'),
      fullPage: true,
    });
    await otherPage.close();
  });
});
