/**
 * 阶段4②(2026-07-03) 铁律4 回归断言：archive_records 桥接进召回后的合并行为。
 *
 * archive-store.ts 有 `server-only`，不能在 Node test runner 直接 import；
 * 用 buildRecallQuery + buildArchiveRecordsRecallQuery(纯函数) + @libsql/client 走真实内存/文件 DB，
 * 还原 findSimilarCourtArchives 合并两路来源的逻辑进行断言(与 shiguan-honesty.nodetest.ts 同策略)。
 */
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@libsql/client';

import { buildRecallQuery, buildArchiveRecordsRecallQuery } from './recall-guard.ts';

const dbPath = `/tmp/archive-records-recall-${process.pid}.db`;

const CREATE_COURT_ARCHIVES = `
  CREATE TABLE IF NOT EXISTS court_archives (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    original_question TEXT NOT NULL,
    verdict TEXT,
    source_label TEXT,
    reusable_lessons_json TEXT,
    user_id TEXT,
    synthetic INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )
`;
const CREATE_SHIGUAN_ARCHIVES = `
  CREATE TABLE IF NOT EXISTS shiguan_archives (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    retrospective_status TEXT,
    created_at TEXT NOT NULL
  )
`;
const CREATE_ARCHIVE_RECORDS = `
  CREATE TABLE IF NOT EXISTS archive_records (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    archive_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`;

// 还原 findSimilarCourtArchives 的合并逻辑(archive-store.ts 因 server-only 不可直接 import)。
type PriorCaseLike = { id: string; originalQuestion: string; createdAt: string; reusableLessons: string[] };

async function mergedRecall(
  db: ReturnType<typeof createClient>,
  question: string,
  userId: string,
  limit: number,
): Promise<PriorCaseLike[]> {
  const courtQuery = buildRecallQuery(question, userId, limit);
  const archiveQuery = buildArchiveRecordsRecallQuery(question, userId, limit);
  const [courtRes, archiveRes] = await Promise.all([
    courtQuery ? db.execute({ sql: courtQuery.sql, args: courtQuery.args }) : Promise.resolve({ rows: [] }),
    archiveQuery ? db.execute({ sql: archiveQuery.sql, args: archiveQuery.args }) : Promise.resolve({ rows: [] }),
  ]);
  const courtCases: PriorCaseLike[] = courtRes.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      originalQuestion: String(row.original_question),
      createdAt: String(row.created_at),
      reusableLessons: [],
    };
  });
  const archiveCases: PriorCaseLike[] = archiveRes.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const parsed = JSON.parse(String(row.archive_json ?? '{}')) as { issue?: { question?: string }; lessons?: string[] };
    return {
      id: String(row.id),
      originalQuestion: parsed.issue?.question ?? '',
      createdAt: String(row.created_at),
      reusableLessons: Array.isArray(parsed.lessons) ? parsed.lessons.map(String) : [],
    };
  });
  return [...courtCases, ...archiveCases]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

test('阶段4②: 两个来源(court_archives + archive_records)的先例能合并召回', async (t) => {
  const db = createClient({ url: `file:${dbPath}` });
  t.after(async () => {
    db.close();
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
  });

  await db.execute(CREATE_COURT_ARCHIVES);
  await db.execute(CREATE_SHIGUAN_ARCHIVES);
  await db.execute(CREATE_ARCHIVE_RECORDS);

  await db.execute({
    sql: `INSERT INTO court_archives (id, task_id, original_question, user_id, synthetic, created_at, reusable_lessons_json)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: ['ca-1', 't1', '低温电池市场怎么定价', 'userA', '2026-07-01T08:00:00Z', '[]'],
  });
  await db.execute({
    sql: `INSERT INTO archive_records (id, task_id, archive_json, created_at) VALUES (?, ?, ?, ?)`,
    args: [
      'ar-1',
      't2',
      JSON.stringify({
        issue: { userId: 'userA', question: '低温电池竞品分析' },
        outcome: 'achieved',
        lessons: ['电芯成本占大头'],
      }),
      '2026-07-02T08:00:00Z',
    ],
  });

  const merged = await mergedRecall(db, '低温电池', 'userA', 5);
  assert.equal(merged.length, 2, '两个来源都应命中，各1条');
  assert.ok(merged.some((c) => c.id === 'ca-1'), 'court_archives 的先例应出现');
  assert.ok(merged.some((c) => c.id === 'ar-1'), 'archive_records 的先例应出现');
  // 按时间倒序：ar-1(07-02) 应排在 ca-1(07-01) 前面
  assert.equal(merged[0].id, 'ar-1', '合并后应按 createdAt 倒序，最新的 archive_records 先例排最前');
});

test('阶段4②: 跨用户隔离在合并召回里同样生效(userB 查不到 userA 的 archive_records)', async (t) => {
  const db = createClient({ url: `file:${dbPath}-iso` });
  t.after(async () => {
    db.close();
    await rm(`${dbPath}-iso`, { force: true });
    await rm(`${dbPath}-iso-shm`, { force: true });
    await rm(`${dbPath}-iso-wal`, { force: true });
  });

  await db.execute(CREATE_COURT_ARCHIVES);
  await db.execute(CREATE_SHIGUAN_ARCHIVES);
  await db.execute(CREATE_ARCHIVE_RECORDS);

  await db.execute({
    sql: `INSERT INTO archive_records (id, task_id, archive_json, created_at) VALUES (?, ?, ?, ?)`,
    args: [
      'ar-userA', 't1',
      JSON.stringify({ issue: { userId: 'userA', question: '低温电池竞品分析' }, outcome: 'achieved', lessons: [] }),
      '2026-07-02T08:00:00Z',
    ],
  });

  const asUserA = await mergedRecall(db, '低温电池', 'userA', 5);
  const asUserB = await mergedRecall(db, '低温电池', 'userB', 5);
  assert.ok(asUserA.some((c) => c.id === 'ar-userA'), 'userA 应能召回自己的 archive_records');
  assert.ok(!asUserB.some((c) => c.id === 'ar-userA'), 'userB 绝不能召回 userA 的 archive_records(跨用户隔离)');
  assert.equal(asUserB.length, 0, 'userB 无任何数据时应返回空,不静默泄露');
});

test('阶段4②: limit 在合并后仍然生效(不因为两路来源各自都返回 limit 条而超额)', async (t) => {
  const db = createClient({ url: `file:${dbPath}-limit` });
  t.after(async () => {
    db.close();
    await rm(`${dbPath}-limit`, { force: true });
    await rm(`${dbPath}-limit-shm`, { force: true });
    await rm(`${dbPath}-limit-wal`, { force: true });
  });

  await db.execute(CREATE_COURT_ARCHIVES);
  await db.execute(CREATE_SHIGUAN_ARCHIVES);
  await db.execute(CREATE_ARCHIVE_RECORDS);

  for (let i = 0; i < 3; i += 1) {
    await db.execute({
      sql: `INSERT INTO court_archives (id, task_id, original_question, user_id, synthetic, created_at, reusable_lessons_json)
            VALUES (?, ?, ?, ?, 0, ?, ?)`,
      args: [`ca-${i}`, `t${i}`, '低温电池市场怎么定价', 'userA', `2026-07-0${i + 1}T08:00:00Z`, '[]'],
    });
    await db.execute({
      sql: `INSERT INTO archive_records (id, task_id, archive_json, created_at) VALUES (?, ?, ?, ?)`,
      args: [
        `ar-${i}`, `t${i + 10}`,
        JSON.stringify({ issue: { userId: 'userA', question: '低温电池竞品分析' }, outcome: 'achieved', lessons: [] }),
        `2026-07-1${i}T08:00:00Z`,
      ],
    });
  }

  const merged = await mergedRecall(db, '低温电池', 'userA', 2);
  assert.equal(merged.length, 2, 'limit=2 时合并后总数必须恰好2条,不因两路各自返回而变成4条');
});
