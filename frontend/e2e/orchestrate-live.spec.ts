import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * @live 上书房编排真链烟测 —— register → login → orchestrate/all → jiqun 蜂群真扇出。
 *
 * 填补 orchestrate.spec.ts 自己注明的缺口("真实合并行为靠 live 烟测,这里只焊确定性闸")。
 * 本测真烧 LLM + 真建后端测试用户,默认 CI 跳过(grep-invert @live),手动/夜间跑:
 *   只跑本测:        pnpm exec playwright test --grep @live
 *   CI 排除:         pnpm exec playwright test --grep-invert @live
 *
 * 证伪铁律(charity-majors:"没见它红过的网不算网"):
 *   kill 掉 jiqun:8081 后本测必须变红(jiqunSwarm.ok 断言会失败)——已验证。
 *
 * 不 mock:走真后端鉴权(decode-only/strict 两种姿态都通)+ 真蜂群派发。
 */

const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002/').replace(/\/$/, '');
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/chaotang';
const url = (p: string): string => `${BASE}${BASE_PATH}${p}`;

test.describe('@live 上书房编排真链', () => {
  test('register→login→orchestrate/all→蜂群真扇出(realResponded≥1 且 swarm 已派发)', async () => {
    // secret 全召模式真烧多部门 LLM,远超默认 30s test timeout
    test.setTimeout(120_000);
    const ctx = await pwRequest.newContext();
    const stamp = Date.now();
    const username = `e2e_live_${stamp}`;
    const email = `${username}@e2e.local`;
    const password = 'Verify123456';

    // 1. 注册(BFF 转后端 :8081 建用户)
    const reg = await ctx.post(url('/api/auth/register'), { data: { username, email, password } });
    expect(reg.status(), `register(${await reg.text()})`).toBe(201);

    // 2. 登录 → 真 JWT(strict 姿态走后端验签;dev 姿态本地 decode-only)
    const login = await ctx.post(url('/api/auth/local-login'), { data: { username, password } });
    expect(login.ok(), `login(${login.status()})`).toBeTruthy();
    const { accessToken } = (await login.json()) as { accessToken?: string };
    expect(accessToken, 'accessToken 缺失').toBeTruthy();

    // 3. orchestrate/all 真扇出(召部门烧 LLM + 派发 jiqun 蜂群)
    const orch = await ctx.post(url('/api/court/orchestrate/all'), {
      headers: { Cookie: `courtos.access_token=${accessToken}` },
      data: { command: '户部评估:三花智控当前仓位是否该减', mode: 'secret' },
      timeout: 90_000,
    });
    expect(orch.ok(), `orchestrate http(${orch.status()})`).toBeTruthy();
    const body = (await orch.json()) as {
      ok?: boolean;
      jiqunSwarm?: { ok?: boolean; sessionId?: string };
      coverage?: { realResponded?: number };
    };

    // —— 真链断言:证明是真蜂群,不是 scripted 兜底 ——
    expect(body.ok, '编排未成功').toBe(true);
    // 真蜂群已派发到后端 :8081(kill 8081 → 此断言变红,即证伪点)
    expect(body.jiqunSwarm?.ok, 'jiqun 蜂群未派发(后端 :8081 不可达?)').toBe(true);
    expect(body.jiqunSwarm?.sessionId ?? '', 'sessionId 格式').toMatch(/^\d{8}_\d{6}/);
    // 至少一个真部门 LLM 应答 —— scripted 兜底造不出真 coverage
    expect(body.coverage?.realResponded ?? 0, '无任何真部门应答(全 scripted?)').toBeGreaterThanOrEqual(1);

    await ctx.dispose();
  });
});
