import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

const BACKEND_BASE = 'http://127.0.0.1:8081';
const INVITE_CODE = 'W07-RUNNABLE-E2E';

export async function registerAndLoginRealUser(username: string): Promise<{
  token: string;
  tenantId: number;
}> {
  const password = `W07-${randomUUID()}-aA1!`;
  const register = await fetch(`${BACKEND_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.local`,
      password,
      invite_code: INVITE_CODE,
    }),
  });
  if (!register.ok) {
    throw new Error(`real backend registration failed: HTTP ${register.status}`);
  }
  const login = await fetch(`${BACKEND_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!login.ok) {
    throw new Error(`real backend login failed: HTTP ${login.status}`);
  }
  const body = await login.json() as {
    token: string;
    tenant: { id: number };
  };
  return { token: body.token, tenantId: body.tenant.id };
}

export async function installRealBrowserSession(
  page: Page,
  session: { token: string; tenantId: number },
  username: string,
): Promise<void> {
  await page.addInitScript(({ token, tenantId, name }) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify({
      accessToken: token,
      refreshToken: 'not-issued-by-current-backend',
      tenantId,
      username: name,
      accountType: 0,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    }));
    window.localStorage.setItem('courtos.onboarded', '1');
    window.localStorage.setItem('courtos.first-decree-seeded', '1');
  }, {
    token: session.token,
    tenantId: session.tenantId,
    name: username,
  });
}
