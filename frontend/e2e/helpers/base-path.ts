import type { APIRequestContext } from '@playwright/test';

/**
 * 自适应 basePath（2026-06-24 · 消除"specs 假设 basePath vs 服务器实际"隐性耦合）。
 *
 * 背景:门禁纯 `next dev` 无 basePath,但 `pnpm dev`/prod 带 `/chaotang`。specs 若硬编码会在
 * 另一种服务器上整批 404 变红,且查不出是 basePath 不是代码(本会话 QA 已踩)。
 *
 * 解:env(PLAYWRIGHT_BASE_PATH/NEXT_PUBLIC_BASE_PATH)优先;否则探测一次——
 * app 若在 /chaotang 下,/chaotang/<已知路由> 不会 404(200/307/401 均算存在)。缓存,全程一次探测。
 */
let cached: string | undefined;

export async function resolveBasePath(request: APIRequestContext): Promise<string> {
  const env = process.env.PLAYWRIGHT_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH;
  if (env !== undefined) return env;
  if (cached !== undefined) return cached;
  try {
    const res = await request.get('/chaotang/api/court/true-chain-health', {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    cached = res.status() === 404 ? '' : '/chaotang';
  } catch {
    cached = '';
  }
  return cached;
}

/** 仅供测试/诊断:复位探测缓存。 */
export function __resetBasePathCache(): void {
  cached = undefined;
}
