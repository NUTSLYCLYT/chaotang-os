/**
 * Task1 回归断言：召回带 retrospective_status（相关子查询 shiguan_archives）
 *
 * MED-1 修复(2026-06-28): LEFT JOIN 改为相关子查询，消除 task_id 无唯一约束时的一对多重复行。
 *
 * 场景A：court_archives 有对应 shiguan_archives 行（task_id 匹配），SQL 应返回 retrospective_status='达成'
 * 场景B：court_archives 无对应 shiguan_archives 行，retrospective_status 应为 null（绝不编造）
 *
 * 策略：在 buildRecallQuery（纯函数）返回的 SQL 上执行真实 libsql 查询，
 * 兼顾命门校验（sql/args）与真实 DB 行为（子查询走通）。
 * 不直接 import archive-store.ts（server-only 在非 Next.js 上下文会抛错）。
 */
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@libsql/client';

import { buildRecallQuery } from './recall-guard.ts';

const dbPath = `/tmp/recall-outcome-${process.pid}.db`;

const CREATE_COURT_ARCHIVES = `
  CREATE TABLE IF NOT EXISTS court_archives (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    original_question TEXT NOT NULL,
    refined_intent TEXT,
    verdict TEXT,
    source_label TEXT,
    overall_signal TEXT,
    missing_evidence_json TEXT,
    needs_human_confirmation INTEGER,
    reusable_lessons_json TEXT,
    archive_record_json TEXT,
    user_id TEXT,
    synthetic INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )
`;

/* shiguan_archives 测试表（省略外键约束，测试不依赖 decision_tasks 等父表） */
const CREATE_SHIGUAN_ARCHIVES = `
  CREATE TABLE IF NOT EXISTS shiguan_archives (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    memorial_id TEXT NOT NULL,
    archive_json TEXT NOT NULL,
    source_label TEXT NOT NULL DEFAULT 'MIXED',
    retrospective_status TEXT NOT NULL DEFAULT 'not_started',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

test('召回 SQL 带 shiguan_archives 相关子查询 → retrospective_status 正确返回', async (t) => {
  const db = createClient({ url: `file:${dbPath}` });
  t.after(async () => {
    db.close();
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
  });

  await db.execute(CREATE_COURT_ARCHIVES);
  await db.execute(CREATE_SHIGUAN_ARCHIVES);

  /* 场景A：court_archives archive-1 绑定 task-aaa，有对应 shiguan（达成） */
  await db.execute({
    sql: `INSERT INTO court_archives
            (id, task_id, original_question, user_id, synthetic, created_at, reusable_lessons_json)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: ['archive-1', 'task-aaa', '如何与供应商谈合同价格条款', 'user123', '2026-06-28T10:00:00Z', '[]'],
  });
  await db.execute({
    sql: `INSERT INTO shiguan_archives
            (id, task_id, review_id, memorial_id, archive_json, retrospective_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'shiguan-1',
      'task-aaa',
      'rev-1',
      'mem-1',
      '{}',
      '达成',
      '2026-06-28T10:00:00Z',
      '2026-06-28T10:00:00Z',
    ],
  });

  /* 场景B：court_archives archive-2 绑定 task-bbb，无 shiguan 记录 */
  await db.execute({
    sql: `INSERT INTO court_archives
            (id, task_id, original_question, user_id, synthetic, created_at, reusable_lessons_json)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: [
      'archive-2',
      'task-bbb',
      '如何与供应商谈合同价格方案',
      'user123',
      '2026-06-27T10:00:00Z',
      '[]',
    ],
  });

  const query = buildRecallQuery('与供应商谈合同价格', 'user123', 10);
  assert.ok(query, 'buildRecallQuery 应返回有效查询');

  /* 命门结构断言（铁律4）—— MED-1 修复后检查相关子查询而非 LEFT JOIN（消除一对多重复行）*/
  assert.match(
    query.sql,
    /SELECT\s+s\.retrospective_status\s+FROM\s+shiguan_archives\s+s\s+WHERE\s+s\.task_id\s*=\s*ca\.task_id/i,
    'SQL 必须用相关子查询从 shiguan_archives 取 retrospective_status，否则 task_id 无唯一约束时行重复',
  );
  assert.match(query.sql, /retrospective_status/, 'SELECT 必须包含 retrospective_status 字段');

  const res = await db.execute({ sql: query.sql, args: query.args });
  assert.ok(res.rows.length >= 2, `应召回 ≥2 条，实际 ${res.rows.length}`);

  type Row = Record<string, unknown>;
  const row1 = res.rows.map((r) => r as Row).find((r) => String(r.id) === 'archive-1');
  const row2 = res.rows.map((r) => r as Row).find((r) => String(r.id) === 'archive-2');

  assert.ok(row1, 'archive-1 应在召回集中');
  assert.ok(row2, 'archive-2 应在召回集中');

  /* 场景A：有 shiguan 行 → retrospective_status 必须是 '达成' */
  assert.equal(
    String(row1!.retrospective_status),
    '达成',
    '有 shiguan 归档的旧案必须带 retrospective_status=达成（勿丢）',
  );

  /* 场景B：无 shiguan 行 → retrospective_status 不得是 '达成'（绝不编造） */
  const statusB = row2!.retrospective_status;
  assert.ok(
    statusB === null || statusB === undefined,
    `无 shiguan 归档的旧案 retrospective_status 应为 null（LEFT JOIN 未命中），实际: ${String(statusB)}`,
  );
});

/* 铁律4 SQL 结构静态守卫 —— MED-1 修复后：相关子查询代替 LEFT JOIN */
test('铁律4: buildRecallQuery SQL 包含相关子查询 shiguan_archives + retrospective_status（不编造 outcome）', () => {
  const query = buildRecallQuery('供应商合同谈判策略', 'tenant-xyz', 3);
  assert.ok(query, '合法用户应得到查询');

  // MED-1: 相关子查询 —— 每 ca 行取最新 retrospective_status，消除一对多重复行
  assert.match(
    query!.sql,
    /SELECT\s+s\.retrospective_status\s+FROM\s+shiguan_archives\s+s\s+WHERE\s+s\.task_id\s*=\s*ca\.task_id/i,
    '相关子查询必须明确关联 ca.task_id，并带 ORDER BY created_at DESC LIMIT 1 取最新',
  );
  assert.match(query!.sql, /retrospective_status/, 'SELECT 必须带 retrospective_status');
  // 确认没有裸 LEFT JOIN（已改为子查询）
  assert.ok(!/LEFT JOIN shiguan_archives/i.test(query!.sql), '不应再有 LEFT JOIN shiguan_archives（已改为相关子查询）');

  /* 租户隔离仍生效（子查询不得破坏 user_id 强过滤） */
  assert.match(query!.sql, /user_id = \?\s+AND/, '租户隔离：user_id 仍以 AND 连接（非 OR）');
  assert.ok(!/user_id = \?\s+OR/.test(query!.sql), '严禁 user_id = ? OR（会短路泄露全表）');
});
