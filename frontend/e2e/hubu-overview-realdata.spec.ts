import { expect, test, type APIRequestContext } from '@playwright/test';
import { resolveBasePath } from './helpers/base-path';
import { Buffer } from 'node:buffer';

// 回归断言(打穿户部 · 2026-06-24):户部总览必须「接真」——
//   1. 零 seed:绝不再返回旧版演示种子(建设户部经营预算中台 v1 / 42.6 万 / build-* id)。
//   2. 从真任务派生:下达一条含预算/ROI 的真旨意后,它应作为财政事项出现,且金额取命令中真数字。
//   3. source='turso'(真本地),不冒充。
// 守护根因:旧版 ensureSeedData 把元演示种子写进 hubu_* 表 → 任何新装机都显假数字冒充真。

function cookieHeader(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    user_id: 'e2e-hubu',
    username: 'e2e',
    tenant_slug: 'local',
    role: 'user',
    exp: '2100-01-01T00:00:00.000Z',
  })}.sig`;
  return `courtos.access_token=${token}`;
}

async function postJson(request: APIRequestContext, path: string, data: unknown) {
  return request.post(`${await resolveBasePath(request)}${path}`, {
    data,
    headers: { 'content-type': 'application/json', cookie: cookieHeader() },
  });
}

// 旧版 SEED 幽灵 + 假 cash_reserve「71%」(单机私有无真实现金口径来源,只能真账或诚实空)。
const SEED_GHOSTS = ['建设户部经营预算中台', '42.6 万', '71%', 'build-hubu-v1', 'build-gongbu-workflow', 'build-jinyiwei-intel'];

test('户部总览:零 seed + 从真任务派生(接真契约)', async ({ request }) => {
  // 下达一条含预算/ROI 的真旨意 → 写入本地 tasks。
  const ask = '审批市场部建设预算 12 万，预期 ROI 3x，要不要批？';
  const drafted = await postJson(request, '/api/court/shangshufang/draft-edict', { raw_question: ask });
  expect(drafted.ok(), 'draft-edict 应成功').toBeTruthy();
  const taskId = ((await drafted.json()) as { data?: { task_id?: string } }).data?.task_id;
  expect(taskId, '应得到 task_id').toBeTruthy();

  const res = await request.get(`${await resolveBasePath(request)}/api/court/hubu/overview`, { headers: { cookie: cookieHeader() } });
  expect(res.ok(), '户部总览应成功').toBeTruthy();
  const body = (await res.json()) as { data?: { summary?: { source?: string }; projects?: Array<Record<string, unknown>> } };
  const data = body.data;
  expect(data, '应含 data').toBeTruthy();

  // 1) 零 seed:总览里不得出现任何旧种子幽灵。
  const blob = JSON.stringify(data);
  for (const ghost of SEED_GHOSTS) {
    expect(blob, `户部总览不得含 seed 幽灵「${ghost}」`).not.toContain(ghost);
  }

  // 2) source 是真本地。
  expect(data!.summary?.source, "summary.source 应为 'turso'(真本地派生)").toBe('turso');

  // cash_reserve 只能是本地真账金额或诚实 '—'，绝不是旧的假 '71%'。
  const cash = (data!.summary as { cash_reserve?: string } | undefined)?.cash_reserve ?? '';
  expect(cash === '—' || /\d/.test(cash), `cash_reserve 应为真账金额或诚实 '—'，实得「${cash}」`).toBeTruthy();

  // 3) 刚下的真任务被派生进来,且预算/ROI 取自命令中的真数字。
  const derived = (data!.projects ?? []).find((p) => p.id === taskId);
  expect(derived, '含预算的真任务应派生为财政事项(按 task id)').toBeTruthy();
  expect(derived!.requested_budget, '预算应取命令中的真数字 12 万').toBe('12 万');
  expect(derived!.estimated_roi, 'ROI 应取命令中的真数字 3x').toBe('3x');
});
