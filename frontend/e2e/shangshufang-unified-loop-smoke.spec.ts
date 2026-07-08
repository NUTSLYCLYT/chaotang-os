import { expect, test, type Page } from '@playwright/test';
import { resolveBasePath } from './helpers/base-path';
import { Buffer } from 'node:buffer';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeLocalSessionToken(): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    user_id: 'e2e-unified-loop',
    username: 'e2e',
    tenant_slug: 'local',
    role: 'user',
    exp: '2100-01-01T00:00:00.000Z',
  });
  return `${header}.${payload}.sig`;
}

function cookieOrigins(): string[] {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const origins = new Set(['http://localhost:3002', 'http://127.0.0.1:3002']);
  if (configuredBaseUrl) origins.add(new URL(configuredBaseUrl).origin);
  return Array.from(origins);
}

async function seedJwtSession(page: Page): Promise<void> {
  const token = makeLocalSessionToken();
  await page.context().addCookies(cookieOrigins().map((url) => ({
    name: 'courtos.access_token',
    value: token,
    url,
  })));
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify({
      accessToken,
      refreshToken: 'e2e-refresh',
      tenantId: 1,
      username: 'e2e',
      accountType: 0,
      expiresAt: 4102444800000,
    }));
    window.localStorage.setItem('courtos.onboarded', '1');
  }, token);
}

test('上书房确认拟旨后，军机处展示同一任务的统一 Loop 摘要', async ({ page }) => {
  test.setTimeout(90_000);
  await seedJwtSession(page);

  const rawQuestion = '客户要求正式报价，要不要发？';
  const drafted = await page.request.post(`${await resolveBasePath(page.request)}/api/court/shangshufang/draft-edict`, {
    data: { raw_question: rawQuestion },
  });
  expect(drafted.ok()).toBeTruthy();
  const draftPayload = await drafted.json() as {
    data?: {
      task_id?: string;
      draft_edict?: unknown;
    };
  };
  expect(draftPayload.data?.task_id).toBeTruthy();
  expect(draftPayload.data?.draft_edict).toBeTruthy();

  const confirmed = await page.request.post(`${await resolveBasePath(page.request)}/api/court/shangshufang/confirm-edict`, {
    data: {
      task_id: draftPayload.data!.task_id,
      confirmed: true,
      edited_edict: draftPayload.data!.draft_edict,
    },
  });
  expect(confirmed.ok()).toBeTruthy();
  const payload = await confirmed.json() as { data?: { task_id?: string } };
  const taskId = payload.data?.task_id;
  expect(taskId).toBeTruthy();

  await page.goto(`${await resolveBasePath(page.request)}/command-center?taskId=${encodeURIComponent(taskId!)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(taskId!).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: '任务概览' })).toBeVisible();
  await expect(page.getByText('FALLBACK').first()).toBeVisible();
  await expect(page.getByText(/质门/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '最终奏折' })).toBeVisible();
});
