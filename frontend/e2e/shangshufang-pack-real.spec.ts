import { expect, test } from '@playwright/test';

function base64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function makeLocalJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    base64Url(JSON.stringify({
      sub: 'e2e-pack-user',
      username: 'e2e-pack',
      tenantId: 1,
      accountType: 1,
      iat: now,
      exp: now + 24 * 60 * 60,
    })),
    'e2e',
  ].join('.');
}

async function seedRealSession(page: import('@playwright/test').Page): Promise<void> {
  const token = makeLocalJwt();
  await page.context().addCookies(
    ['http://localhost:3002', 'http://127.0.0.1:3002'].map((url) => ({
      name: 'courtos.access_token',
      value: token,
      url,
    })),
  );
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify({
      accessToken,
      refreshToken: 'e2e-refresh',
      tenantId: 1,
      username: 'e2e-pack',
      accountType: 1,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }));
    window.localStorage.setItem('courtos.onboarded', '1');
    window.localStorage.setItem('courtos.first-decree-seeded', '1');
  }, token);
}

test.describe('上书房 PACK 研发蜂群真实闭环', () => {
  test.skip(process.env.REAL_PACK_E2E !== '1', 'Set REAL_PACK_E2E=1 to run the real PACK swarm flow.');

  test('从 UI 下旨启动 PACK 研发蜂群，并把后端 final_output 回填到正文', async ({ page }) => {
    test.setTimeout(10 * 60_000);

    await seedRealSession(page);

    const calls: Array<{ url: string; status: number; method: string }> = [];
    page.on('response', (response) => {
      const url = response.url();
      if (
        url.includes('/api/court/orchestrate/all') ||
        url.includes('/api/court/shangshufang/edict-return') ||
        url.includes('/api/court/chaotang/study/run') ||
        url.includes('/jiqun/api/swarm/sessions')
      ) {
        calls.push({ url, status: response.status(), method: response.request().method() });
      }
    });

    await page.goto('/study?skipOnboarding=1');
    const decreeBar = page.getByLabel('御前对话栏');
    const input = page.getByRole('textbox');

    await decreeBar.getByRole('button', { name: '密', exact: true }).click();
    await input.fill(
      '请启动 PACK研发蜂群流程，围绕储能电池包输出需求规格、BMS选型、通信协议、结构热设计、PACK工艺、测试验证和风险建议。',
    );
    await page.getByTestId('decree-submit').click();
    await page.getByLabel('圣旨展示面板').getByRole('button', { name: '确认下旨' }).click();

    await expect.poll(
      () => calls.some((call) => call.url.includes('/api/court/orchestrate/all') && call.status < 500),
      { timeout: 90_000 },
    ).toBe(true);

    await expect.poll(
      () => calls.some((call) => call.url.includes('/jiqun/api/swarm/sessions') && call.status === 200),
      { timeout: 8 * 60_000 },
    ).toBe(true);

    await expect(page.getByText('蜂群回奏').first()).toBeVisible({ timeout: 8 * 60_000 });
    await expect(page.getByText(/PACK|BMS|通信协议|测试验证|风险/).first()).toBeVisible({ timeout: 30_000 });

    await expect.poll(
      () => calls.some((call) => call.url.includes('/api/court/shangshufang/edict-return') && call.status === 200),
      { timeout: 30_000 },
    ).toBe(true);

    await page.reload();
    await expect(page.getByText('蜂群回奏').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/PACK|BMS|通信协议|测试验证|风险/).first()).toBeVisible({ timeout: 30_000 });
  });
});
