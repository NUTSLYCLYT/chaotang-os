import { expect, test, type Page } from '@playwright/test';
import { resolveBasePath } from './helpers/base-path';
import { Buffer } from 'node:buffer';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeLocalSessionToken(): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    user_id: 'e2e-ui-to-edict',
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
    window.localStorage.setItem('courtos.first-decree-seeded', '1');
  }, token);
}

const ASK_QUESTION = '客户要求正式报价，要不要发？';

test('上书房真点击：输入问题后生成圣旨润色稿', async ({ page }) => {
  test.setTimeout(90_000);
  await seedJwtSession(page);

  await page.route('**/api/court/shangshufang/polish-edict', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          mode: 'order',
          original_question: ASK_QUESTION,
          polished_edict: ASK_QUESTION,
          source_label: 'FALLBACK',
          audit_id: 'e2e-stub-polish',
          fallback_used: true,
        },
      }),
    });
  });

  await page.goto(`${await resolveBasePath(page.request)}/court-briefing`, { waitUntil: 'domcontentloaded' });

  const openWorkbench = page.getByRole('button', { name: /按此|下旨|鎸夋/ });
  const askInput = page.getByTestId('ssf-ask-input');
  await expect(async () => {
    if (await openWorkbench.isVisible()) await openWorkbench.click();
    await expect(askInput).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });

  await expect(askInput).toBeEditable();
  await page.getByTestId('decree-mode-order').click();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await askInput.click();
  await page.evaluate(async (text) => navigator.clipboard.writeText(text), ASK_QUESTION);
  await page.keyboard.press('Control+V');
  const expandEdict = page.getByTestId('collapsed-edict-scroll');
  if (await expandEdict.isVisible()) await expandEdict.click();
  await expect(page.getByTestId('decree-draft-original')).toContainText(ASK_QUESTION);
  await page.getByTestId('decree-submit').click();

  await expect(page.getByText('FALLBACK').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/MIXED|混合/).first()).toBeVisible();
});
