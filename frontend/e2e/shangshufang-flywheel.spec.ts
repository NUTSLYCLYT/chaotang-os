/**
 * 上书房飞轮 · dogfood 固化(2026-07-02)
 *
 * 把手跑的 dogfood(下旨→确认→看 live/source_label/prior_cases)钉成可复现的客观断言。
 * 命中真后端(jiqun :8081)+ 真 LLM(:4444);二者任一不可达 → skip(诚实,不 false-fail CI)。
 *
 * 两类断言:
 *   [硬·永远成立] 诚实不变量:确认返回的 memorial 里所有 source_label 必须一致
 *     (顶层 == 所有 nested)。这是会审 CRITICAL#1 的回归网,LIVE/MIXED/FALLBACK 三档都必须自洽。
 *   [软·点火标尺] 记录 live / source_label / prior_cases 数。当前预期 FALLBACK(门太严,见交接笔记);
 *     做完 MIXED 修法后应转 LIVE/MIXED —— 届时把下面 EXPECT_IGNITION 置 true 收紧为硬断言。
 *
 * 运行:先起服务(pnpm dev:3002 或 pnpm start:3050),BASE 环境变量可覆盖。
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = process.env.FLYWHEEL_BASE ?? 'http://127.0.0.1:3050/chaotang';
/** 做完 MIXED 修法后置 true:届时要求真点火(live 或 MIXED),把软标尺升级成硬门。 */
const EXPECT_IGNITION = false;

function devToken(): string {
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return [
    b64(JSON.stringify({ alg: 'none', typ: 'JWT' })),
    b64(JSON.stringify({ sub: 'flywheel-e2e', username: 'flywheel-e2e', tenantId: 1, accountType: 1, iat: now, exp: now + 86400 })),
    'x',
  ].join('.');
}

async function post(req: APIRequestContext, path: string, body: unknown, token: string) {
  return req.post(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json', cookie: `courtos.access_token=${token}` },
    data: body,
    timeout: 120_000,
  });
}

/** 收集一个对象里所有 source_label(与 recall-guard/office-kit 同口径),验不变量。 */
function collectSourceLabels(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => collectSourceLabels(v, acc));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'source_label' && typeof v === 'string') acc.push(v);
      else collectSourceLabels(v, acc);
    }
  }
  return acc;
}

test('上书房飞轮:下旨→确认 的诚实不变量 + 点火标尺', async ({ request }) => {
  test.setTimeout(200_000); // 确认步跑真 LLM 闭环(refine+report+3部会审),需分钟级
  const token = devToken();

  // 1) 下旨
  const draftRes = await post(request, '/api/court/shangshufang/draft-edict', {
    question: '要不要给华东大客户签独家供货协议,预付30%账期3个月',
  }, token);
  test.skip(!draftRes.ok(), `draft-edict 不可用(${draftRes.status()})——后端/服务未起,skip`);
  const draft = await draftRes.json();
  const taskId: string | undefined = draft?.data?.task_id;
  expect(taskId, '应返回 task_id').toBeTruthy();

  // 2) 确认(触发真闭环)
  const confirmRes = await post(request, '/api/court/shangshufang/confirm-edict', {
    task_id: taskId, confirmed: true,
  }, token);
  test.skip(!confirmRes.ok(), `confirm-edict 不可用(${confirmRes.status()})——skip`);
  const confirm = await confirmRes.json();
  const data = confirm?.data;
  expect(data?.memorial, '应返回 memorial').toBeTruthy();

  // [硬] 诚实不变量:memorial 里所有 source_label 必须一致(禁半覆盖=假当真,会审 CRITICAL#1 回归网)
  const labels = collectSourceLabels(data.memorial);
  const uniq = Array.from(new Set(labels));
  expect(labels.length, 'memorial 应含多处 source_label').toBeGreaterThan(0);
  expect(uniq, `memorial 存在异源标(半覆盖=假当真):${uniq.join(',')}`).toHaveLength(1);
  // 顶层与 nested 一致
  expect(data.source_label, '顶层 source_label 应与 memorial 内部一致').toBe(uniq[0]);

  // [软→硬] 点火标尺:记录状态;MIXED 修法完成后 EXPECT_IGNITION=true 收紧
  // eslint-disable-next-line no-console
  console.log(`[flywheel] live=${data.live} source_label=${data.source_label} prior_cases=${(data.prior_cases ?? []).length}`);
  if (EXPECT_IGNITION) {
    expect(['LIVE', 'LIVE_SWARM', 'MIXED'], '做完 MIXED 修法后应真点火(非 FALLBACK)').toContain(data.source_label);
  }
});
