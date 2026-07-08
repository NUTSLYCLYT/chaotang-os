/**
 * 铁律4 回归断言：史馆"诚实性"两条钢轨
 *
 * 钢轨1 · 不编 outcome:
 *   无 retrospective 的旧案（LEFT JOIN 未命中），映射后
 *   retrospectiveStatus 必须是 undefined / null，绝不能是 '达成'。
 *   用 buildRecallQuery + 内存 libsql 重现映射链路，与 archive-store 一致。
 *
 * 钢轨2 · 空旧案不挂徽章:
 *   recallBadgeLabel(0) === null（不渲染计数徽章）
 *   recallBadgeLabel(N>0) === '引用旧案 N 条'（正常挂徽章）
 *
 * 测试策略:
 *   - archive-store.ts 有 `server-only`，不能在 Node test runner 直接 import；
 *     改为直接用 buildRecallQuery（纯函数）+ @libsql/client 走内存 DB，
 *     还原 findSimilarCourtArchives 的映射逻辑进行断言。
 *   - recallBadgeLabel 是纯函数，直接 import 测。
 */

import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@libsql/client';

import { buildRecallQuery } from './recall-guard.ts';
// HIGH-2 修复: @/ 别名在 node --experimental-strip-types 下不解析，改相对路径带扩展名。
import { recallBadgeLabel } from '../../../features/shangshufang/lib/recall-badge.ts';

// ---------------------------------------------------------------------------
// 钢轨1：不编 outcome（无 retrospective 行时，映射结果绝不能是 '达成'）
// ---------------------------------------------------------------------------

const dbPath = `/tmp/shiguan-honesty-${process.pid}.db`;

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

test('铁律4·钢轨1: 无 retrospective 的旧案，映射后 retrospectiveStatus 绝不能是"达成"', async (t) => {
  const db = createClient({ url: `file:${dbPath}` });

  t.after(async () => {
    db.close();
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
  });

  await db.execute(CREATE_COURT_ARCHIVES);
  await db.execute(CREATE_SHIGUAN_ARCHIVES);

  // 插入一条无对应 shiguan_archives 记录的旧案（模拟"只归档、未回填"）
  await db.execute({
    sql: `INSERT INTO court_archives
            (id, task_id, original_question, user_id, synthetic, created_at, reusable_lessons_json)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: ['archive-honest-1', 'task-no-retro', '如何评估供应商资质', 'user-honesty', '2026-06-28T08:00:00Z', '[]'],
  });

  // 执行召回 SQL，还原 findSimilarCourtArchives 的 SQL 层
  const query = buildRecallQuery('评估供应商资质', 'user-honesty', 5);
  assert.ok(query, 'buildRecallQuery 对合法用户应返回非 null');

  const res = await db.execute({ sql: query.sql, args: query.args });
  assert.ok(res.rows.length >= 1, `应召回到 archive-honest-1，实际 ${res.rows.length} 条`);

  type Row = Record<string, unknown>;
  const row = res.rows.map((r) => r as Row).find((r) => String(r.id) === 'archive-honest-1');
  assert.ok(row, 'archive-honest-1 应在召回集中');

  // 还原 findSimilarCourtArchives 的映射逻辑：
  //   retrospectiveStatus: r.retrospective_status ? String(r.retrospective_status) : undefined
  const rawStatus = row!.retrospective_status;
  const retrospectiveStatus = rawStatus ? String(rawStatus) : undefined;

  // 核心断言：无 shiguan_archives 行 → 相关子查询未命中返回 NULL → 映射为 undefined，绝不是 '达成'
  assert.notEqual(
    retrospectiveStatus,
    '达成',
    `无 retrospective 记录的旧案，映射后 retrospectiveStatus 不得是 '达成'（实际: ${String(retrospectiveStatus)}）`,
  );

  // 补充：验证具体值是 undefined（相关子查询未命中，SQL 层返回 null，映射为 undefined）
  assert.equal(
    retrospectiveStatus,
    undefined,
    `无 shiguan 行时 retrospectiveStatus 应为 undefined（相关子查询 null → 映射 undefined）`,
  );
});

// ---------------------------------------------------------------------------
// 钢轨2：空旧案不挂徽章（recallBadgeLabel 纯函数断言）
// ---------------------------------------------------------------------------

test('铁律4·钢轨2: recallBadgeLabel(0) 返回 null（空旧案不渲染计数徽章）', () => {
  const label = recallBadgeLabel(0);
  assert.equal(label, null, 'priorCases 为空时徽章必须是 null，不得显示计数（防冒充有先例）');
});

test('铁律4·钢轨2: recallBadgeLabel(1) 返回正确标签', () => {
  const label = recallBadgeLabel(1);
  assert.equal(label, '引用旧案 1 条');
});

test('铁律4·钢轨2: recallBadgeLabel(2) 返回正确标签', () => {
  const label = recallBadgeLabel(2);
  assert.equal(label, '引用旧案 2 条');
});

test('铁律4·钢轨2: recallBadgeLabel 负数返回 null（防御性）', () => {
  const label = recallBadgeLabel(-1);
  assert.equal(label, null, '负数也不得挂徽章');
});
