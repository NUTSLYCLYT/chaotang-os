#!/usr/bin/env node
/**
 * guard:task-id (2026-07-01 · 德明"拿数据每天复核" + 林纳斯"让错误无法发生")。
 *
 * 背景：orchestrate 曾每次 `task_${crypto.randomUUID()}` 写主库 tasks → 同一会审复触 INSERT 新行，
 * 121 条 tasks 中 6 个标题占 97 条（×50）。修法=稳定 taskId（stableTaskId）。本 guard 防它回潮：
 *
 *  ① 静态（永远跑 · CI 无需 DB）：禁止 `task_${...randomUUID}` 作为「主库 tasks 主键」再次出现。
 *     审计表（decision_tasks 等）用 randomUUID 合法，见 ALLOWLIST。
 *  ② 数据（DB 可达时）：断言「同租户内 tasks 无重复 raw_command」（count(*) == count(DISTINCT)）。
 *
 * 默认 warn-only（exit 0）；TASKID_STRICT=1 → 有命中即 exit 1。与 guard:tenant/auth/realdata 同套路。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const STRICT = process.env.TASKID_STRICT === '1';

// 主库 tasks 主键非幂等模式：task_ 前缀 + randomUUID。
const BAD = /task_\$\{[^}]*randomUUID/;
// 已核实豁免：写审计表（非主库 tasks）或仅注释。加入前须人工核实写的不是 tasks 表。
const ALLOWLIST = new Set([
  'src/lib/db/courtos-decision-store.ts', // 核实(2026-07-01)：写 decision_tasks/court_reviews 审计表，非主库 tasks
  'src/lib/db/primary-store.ts', // 仅注释引用旧模式（fallback 已改 stableTaskId）
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.ts') && !name.endsWith('.nodetest.ts')) out.push(p);
  }
  return out;
}

const staticHits = [];
for (const f of walk(SRC)) {
  const rel = relative(ROOT, f);
  if (ALLOWLIST.has(rel)) continue;
  const src = readFileSync(f, 'utf8');
  if (BAD.test(src)) {
    const line = src.split('\n').findIndex((l) => BAD.test(l)) + 1;
    staticHits.push(`${rel}:${line}`);
  }
}

async function dataCheck() {
  const url = process.env.TURSO_DB_URL?.trim() || `file:./.chaotang-main-${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'}.db`;
  try {
    const { createClient } = await import('@libsql/client');
    const db = createClient(url.startsWith('file:') ? { url } : { url, authToken: process.env.TURSO_AUTH_TOKEN });
    const res = await db.execute(
      "SELECT COALESCE(tenant_id,'∅') t, count(*) - count(DISTINCT raw_command) dups FROM tasks GROUP BY tenant_id HAVING dups > 0",
    );
    return { ok: true, rows: res.rows.map((r) => ({ tenant: String(r.t), dups: Number(r.dups) })) };
  } catch (e) {
    return { ok: false, reason: String(e?.message ?? e) };
  }
}

const data = await dataCheck();

console.log('— guard:task-id —');
if (staticHits.length === 0) {
  console.log('✓ 静态：无新的 `task_${randomUUID}` 写主库 tasks（已收敛到 stableTaskId）');
} else {
  console.log(`✗ 静态：${staticHits.length} 处给主库 tasks 用了 randomUUID（非幂等→重复孤儿），改用 stableTaskId(command, scope)：`);
  staticHits.forEach((h) => console.log(`   - ${h}`));
}
if (!data.ok) {
  console.log(`· 数据：DB 不可达，跳过（仅静态校验）。${data.reason}`);
} else if (data.rows.length === 0) {
  console.log('✓ 数据：tasks 表同租户内 0 重复 raw_command');
} else {
  console.log('✗ 数据：tasks 表存在重复 raw_command（同租户）：');
  data.rows.forEach((r) => console.log(`   - 租户 ${r.tenant}: 多出 ${r.dups} 条重复`));
}

const failed = staticHits.length > 0 || (data.ok && data.rows.length > 0);
if (failed && STRICT) {
  console.error('\n[guard:task-id] STRICT 模式命中 → exit 1');
  process.exit(1);
}
process.exit(0);
