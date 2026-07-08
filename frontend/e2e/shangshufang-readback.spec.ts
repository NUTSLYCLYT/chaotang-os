import { expect, test, type APIRequestContext } from '@playwright/test';
import { resolveBasePath } from './helpers/base-path';
import { Buffer } from 'node:buffer';

// 回归断言（数据路径，纯 API，不走页面）：
//   draft-edict → confirm-edict → GET /api/court/backend/tasks/[id]
//   读回必须是 confirm-edict 真正写下的那份：status=report_ready 且带 unifiedLoop，
//   且读回够快（不被死的 COURTOS_API_URL 5s 超时拖住）。
//
// 钉死的根因（2026-06-24 全面 debug）：confirm-edict 把 report_ready+unifiedLoop 写进本地
// primary store，但读路径 /api/court/backend/tasks/[id] 旧实现先问 jiqun(只有 draft 旧快照、
// 无 unifiedLoop) 再问死的 courtos:4000(每读吃满 5s)，本地 SoT 反而被挡在最后 → 军机处统一
// Loop 卡永不渲染。本断言保证 ssf_ 任务读回直取本地 SoT、快且完整。

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function localSessionCookieHeader(): string {
  const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
    user_id: 'e2e-readback',
    username: 'e2e',
    tenant_slug: 'local',
    role: 'user',
    exp: '2100-01-01T00:00:00.000Z',
  })}.sig`;
  return `courtos.access_token=${token}`;
}

const ASK_QUESTION = '客户要求正式报价，要不要发？';

interface UnifiedLoopShape {
  unifiedLoop?: unknown;
  shangshufangDecision?: { unified_loop?: unknown };
}

async function postJson(request: APIRequestContext, path: string, data: unknown) {
  return request.post(`${await resolveBasePath(request)}${path}`, {
    data,
    headers: { 'content-type': 'application/json', cookie: localSessionCookieHeader() },
  });
}

test('confirm-edict 后，backend/tasks 读回同案号带 unifiedLoop 且够快（统一 Loop 卡数据契约）', async ({ request }) => {
  const drafted = await postJson(request, '/api/court/shangshufang/draft-edict', { raw_question: ASK_QUESTION });
  expect(drafted.ok(), 'draft-edict 应成功').toBeTruthy();
  const draftPayload = (await drafted.json()) as { data?: { task_id?: string; draft_edict?: unknown } };
  const taskId = draftPayload.data?.task_id;
  expect(taskId, 'draft-edict 应返回 task_id').toBeTruthy();
  expect(draftPayload.data?.draft_edict, 'draft-edict 应返回 draft_edict').toBeTruthy();

  const confirmed = await postJson(request, '/api/court/shangshufang/confirm-edict', {
    task_id: taskId,
    confirmed: true,
    edited_edict: draftPayload.data!.draft_edict,
  });
  expect(confirmed.ok(), 'confirm-edict 应成功').toBeTruthy();
  const confirmPayload = (await confirmed.json()) as { data?: { unified_loop?: unknown } };
  expect(confirmPayload.data?.unified_loop, 'confirm-edict 应回执 unified_loop').toBeTruthy();

  // 读回：必须取到 confirm-edict 写下的本地 SoT，且不被死上游拖慢。
  const startedAt = Date.now();
  const full = await request.get(`${await resolveBasePath(request)}/api/court/backend/tasks/${encodeURIComponent(taskId!)}`, {
    headers: { cookie: localSessionCookieHeader() },
  });
  const elapsedMs = Date.now() - startedAt;
  expect(full.ok(), 'backend/tasks 读回应成功').toBeTruthy();

  const body = (await full.json()) as { task?: { status?: string; result?: UnifiedLoopShape | null } };
  const task = body.task;
  expect(task, '读回应含 task').toBeTruthy();
  expect(task!.status, '读回状态应为 confirm 后的 report_ready，而非 jiqun 的 draft 旧快照').toBe('report_ready');

  const result = task!.result ?? null;
  const hasUnifiedLoop = Boolean(result?.unifiedLoop ?? result?.shangshufangDecision?.unified_loop);
  expect(hasUnifiedLoop, '读回的 result 必须带 unifiedLoop（军机处统一 Loop 卡的数据前置）').toBeTruthy();

  // 死的 COURTOS_API_URL 让旧读路径对 ssf_ 必吃满 5s AbortSignal 超时（下限恒 ≥5s）；
  // 本地 SoT 直取是一次 SQLite 读（即便冷启动建表也远低于此）。阈值取 4s：稳过修复后的
  // <300ms，又稳卡在 5s 破损下限之下，给冷启动留足余量、不误伤。
  expect(elapsedMs, `ssf_ 任务读回应直取本地 SoT、够快，实测 ${elapsedMs}ms`).toBeLessThan(4000);
});
