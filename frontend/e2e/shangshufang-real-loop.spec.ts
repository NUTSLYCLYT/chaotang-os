import { expect, test, type APIRequestContext } from '@playwright/test';

const BASE = process.env.CHAOTANG_E2E_BASE_URL ?? 'http://127.0.0.1:3002/chaotang';
const API = process.env.CHAOTANG_E2E_API_URL ?? 'http://127.0.0.1:8081';

async function waitForTask(request: APIRequestContext, taskId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await request.get(`${API}/api/shangshufang/tasks/${taskId}/status`);
    const body = await response.json();
    const status = body.data?.task?.status;
    if (status === 'awaiting_decision' || status === 'awaiting_evidence') return body.data;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`task ${taskId} did not reach a review state`);
}

test('real loop: 上书房下旨到史馆精确回放', async ({ page, request }) => {
  test.skip(process.env.RUN_REAL_LOOP !== '1', '真实闭环需要显式 RUN_REAL_LOOP=1，并使用隔离本地后端');
  test.setTimeout(90_000);
  const prompt = `请审查这份采购合同（真人闭环回归 ${Date.now()}）：甲方向乙方采购数控零部件，金额50万元，预付款30%，30日交货，货到7日验收。请识别付款、交付、验收和违约责任风险。`;

  await page.goto(`${BASE}/shangshufang`, { waitUntil: 'domcontentloaded' });
  const input = page.locator('textarea[placeholder*="裁决"]');
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill(prompt);
  await page.getByTestId('decree-submit').click();

  await expect.poll(() => page.locator('body').innerText(), {
    timeout: 20_000,
    message: '下旨后必须等待后端回执并展示案号',
  }).toMatch(/案号：?\s*task_[a-z0-9]+/i);
  const taskText = await page.locator('body').innerText();
  const taskId = taskText.match(/案号：?(task_[a-z0-9]+)/i)?.[1];
  expect(taskId, '下旨后页面必须展示真实 task_id').toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`[?&]taskId=${taskId}`), { timeout: 20_000 });

  await waitForTask(request, taskId!);
  await page.goto(`${BASE}/shangshufang?taskId=${encodeURIComponent(taskId!)}`, { waitUntil: 'networkidle' });
  await expect(page.getByTestId('contract-action-generate_delivery')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('contract-review-panel')).toHaveAttribute('data-task-id', taskId!);

  await page.getByTestId('contract-action-generate_delivery').click();
  await expect(page.getByText('READY', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('PDF', { exact: true })).toBeVisible();
  await expect(page.getByTestId('contract-action-decide')).toBeVisible();

  const decisionResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/shangshufang/tasks/${taskId}/decision`) && response.request().method() === 'POST',
  );
  await page.getByTestId('contract-action-decide').click();
  const decisionBody = await (await decisionResponse).json();
  const archiveId = decisionBody.data?.archive_id ?? decisionBody.data?.archive_record?.archive_id;
  expect(archiveId, '人工裁决必须返回 archive_id').toBeTruthy();
  await expect(page.getByText('ARCHIVED', { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.goto(`${BASE}/shiguan?taskId=${encodeURIComponent(taskId!)}&archiveId=${encodeURIComponent(archiveId)}`, {
    waitUntil: 'networkidle',
  });
  await expect(page.getByText('EXACT ARCHIVE', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(archiveId, { exact: true })).toBeVisible();

  for (const format of ['PDF', 'DOCX', 'JSON']) {
    const link = page.getByRole('link', { name: format, exact: true });
    await expect(link).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(await download.path(), `${format} must be downloadable`).toBeTruthy();
  }
});
