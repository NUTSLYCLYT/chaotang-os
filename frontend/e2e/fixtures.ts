import type { Page } from '@playwright/test';

/**
 * 朝堂 E2E 共享夹具：双门鉴权种子。
 *
 * 鉴权两道门(见 AGENTS.md §11):
 *   - 服务端中间件 src/proxy.ts → 认 cookie `courtos.access_token`(仅查存在,不校验值)
 *   - 客户端 AuthGate src/components/AuthGate.tsx → 认 localStorage `courtos.auth`(getSession)
 * 两道都喂才能进受保护页面。后续任何受保护路由的 spec 直接 `await seedSession(page)` 即可。
 */

const FAKE_SESSION = {
  accessToken: 'e2e-access',
  refreshToken: 'e2e-refresh',
  tenantId: 1,
  username: 'e2e',
  accountType: 0,
  expiresAt: 4102444800000, // 2100-01-01,远未过期
};

/** 导出供其它 spec 文件复用(2026-07-04 · 见 e2e/agents-run-auth.spec.ts 会审)：
 *  playwright.config.ts 默认 baseURL 是 127.0.0.1，但历史上多个 spec 各自重新发明的
 *  cookie 种子函数只种 domain:'localhost'——域名不匹配导致 cookie 从不被发送，
 *  用默认配置跑时这些用例会静默走向"看似符合预期"的 401，从未真正验证过后续逻辑。 */
export function cookieOrigins(): string[] {
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const origins = new Set(['http://localhost:3002', 'http://127.0.0.1:3002']);
  if (configuredBaseUrl) origins.add(new URL(configuredBaseUrl).origin);
  return Array.from(origins);
}

/** 给单个具名 cookie 在全部候选 origin 下都种一份，替代各 spec 自己写的
 *  `addCookies([{..., domain:'localhost', path:'/'}])`(域名单一、baseURL 换了就失效)。 */
export async function addCookieAcrossOrigins(page: Page, name: string, value: string): Promise<void> {
  await page.context().addCookies(cookieOrigins().map((url) => ({ name, value, url })));
}

/** 喂双门鉴权种子,放行受保护路由。在 page.goto 之前调用。 */
export async function seedSession(page: Page): Promise<void> {
  await addCookieAcrossOrigins(page, 'courtos.access_token', 'e2e-token');
  await page.addInitScript((session) => {
    window.localStorage.setItem('courtos.auth', JSON.stringify(session));
    window.localStorage.setItem('courtos.onboarded', '1');
  }, FAKE_SESSION);
}

/** 清空双门种子,用于验证鉴权拦截(应跳 /login)。 */
export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.addInitScript(() => window.localStorage.removeItem('courtos.auth'));
}

/**
 * 便捷封装:拦截某个 /api/v1 路径,返回固定 JSON 或状态码。
 * dev 下 API base = /api/v1(basePath 空、NEXT_PUBLIC_BASE_PATH 未设)。
 */
export async function mockApi(
  page: Page,
  pathSuffix: string,
  json: unknown,
  status = 200,
): Promise<void> {
  await page.route(`**/api/v1${pathSuffix}`, (route) => route.fulfill({ status, json }));
}
