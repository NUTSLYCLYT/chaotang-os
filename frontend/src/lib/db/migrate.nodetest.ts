import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import test from 'node:test';
import { createClient } from '@libsql/client';

import { cleanupLegacyLearningPollution } from './migrate.ts';
import { upsertPrimaryTask } from './primary-store.ts';

const dbPath = `/tmp/migrate-c1-cleanup-${process.pid}.db`;

/**
 * C1 旧账回归(2026-06-20 会审 · 铁律4 门b):部门学习记录曾被误写进 tasks,
 * 污染 briefing/史馆/今日完成。cleanupLegacyLearningPollution 必须删净这些前缀行、
 * 保留真任务、且幂等。这条断言钉死"清理只清污染,不误伤,不复发"。
 */
test('C1 cleanup: 删净 department_learning_ 残留,保留真任务,幂等', async (t) => {
  const db = createClient({ url: `file:${dbPath}` });
  t.after(async () => {
    db.close();
    await rm(dbPath, { force: true });
    await rm(`${dbPath}-shm`, { force: true });
    await rm(`${dbPath}-wal`, { force: true });
  });

  await db.execute('CREATE TABLE tasks (id TEXT PRIMARY KEY, status TEXT, updated_at TEXT)');
  await db.execute(`
    INSERT INTO tasks (id, status, updated_at) VALUES
      ('department_learning_hu_bu', 'archived', '2026-06-20'),
      ('department_learning_bing_bu', 'archived', '2026-06-20'),
      ('real_task_abc', 'completed', '2026-06-20')
  `);

  const removed = await cleanupLegacyLearningPollution(db);
  assert.equal(removed, 2, '应删 2 条 department_learning_ 残留');

  const dept = await db.execute("SELECT COUNT(*) AS n FROM tasks WHERE id LIKE 'department_learning_%'");
  assert.equal(Number(dept.rows[0].n), 0, 'tasks 不得再有 department_learning_ 污染');

  const total = await db.execute('SELECT COUNT(*) AS n FROM tasks');
  assert.equal(Number(total.rows[0].n), 1, '真任务必须保留,不得误伤');

  // 幂等:再清一次删 0 行
  assert.equal(await cleanupLegacyLearningPollution(db), 0, '幂等:再跑应删 0 行');
});

/**
 * 结构门(会审 Q1):堵住重污染——upsertPrimaryTask 必须拒绝 department_learning_ 前缀,
 * 否则 edict-return 透传用户 taskId 可重新往 tasks 写学习行污染朝报。守门在写入那道门(铁律1)。
 */
test('C1 结构门: upsertPrimaryTask 拒绝 department_learning_ 保留前缀', async () => {
  await assert.rejects(
    upsertPrimaryTask({ command: '试图重污染', taskId: 'department_learning_hu_bu' }),
    /保留前缀 department_learning_/,
    '保留前缀必须在写入前抛错',
  );
});
