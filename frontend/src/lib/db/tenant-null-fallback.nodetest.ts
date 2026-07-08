/** node --experimental-strip-types --test src/lib/db/tenant-null-fallback.nodetest.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';

/**
 * 会审CRITICAL回归钉死(2026-07-03)：qintian/calibration 和 agents/run 曾一度用严格
 * `tenant_id = ?` 过滤查 tasks 表，但全仓核查 upsertPrimaryTask 的调用方从未传过 tenantId——
 * 真实写入路径下 tasks.tenant_id 恒为 NULL，严格相等在 SQL 里 `NULL = ?` 永不为真，导致
 * qintian/calibration 静默变成永久空转、agents/run 把所有真实任务都误判 404。
 *
 * 修复用 primary-store.ts 已有的 `(tenant_id = ? OR tenant_id IS NULL)` 写法。这里不测
 * route.ts 本身(两个路由都还需要处理会话鉴权，e2e 才能覆盖完整链路)，而是直接钉死两个路由
 * 共用的这段 SQL 判定逻辑本身——防止以后有人"优化"回严格相等，又悄悄引入同一个回归。
 */
test('真实写入的task(未传tenantId) → tenant_id恒为NULL，严格相等查询永远查不到(复现CRITICAL根因)', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/tenant-null-fallback-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/tenant-null-fallback-test.db';

  const { upsertPrimaryTask } = await import('./primary-store.ts');
  const { getDb } = await import('./turso.ts');

  const taskId = 'qintian_learning_test_task';
  // 模拟真实调用方(orchestrate/route.ts 等)的实际用法：不传 tenantId。
  await upsertPrimaryTask({
    taskId,
    command: '测试命令',
    status: 'submitted',
    at: '2026-07-03T00:00:00.000Z',
  });

  const db = getDb();
  const row = await db.execute({ sql: 'SELECT tenant_id FROM tasks WHERE id = ?', args: [taskId] });
  assert.equal(row.rows[0]?.tenant_id, null, '真实写入路径下 tenant_id 必须是 NULL(复现根因前提)');

  const strictMatch = await db.execute({
    sql: 'SELECT id FROM tasks WHERE id = ? AND tenant_id = ?',
    args: [taskId, 'some-real-user-id'],
  });
  assert.equal(strictMatch.rows.length, 0, '严格相等永远查不到这条真实任务(复现此前的CRITICAL回归)');
});

test('修复后的(tenant_id = ? OR tenant_id IS NULL)能正确匹配到真实的NULL行', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/tenant-null-fallback-fixed-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/tenant-null-fallback-fixed-test.db';

  const { upsertPrimaryTask } = await import('./primary-store.ts');
  const { getDb } = await import('./turso.ts');

  const taskId = 'qintian_learning_test_task_2';
  await upsertPrimaryTask({
    taskId,
    command: '测试命令2',
    status: 'submitted',
    at: '2026-07-03T00:00:00.000Z',
  });

  const db = getDb();
  const fixedMatch = await db.execute({
    sql: 'SELECT id FROM tasks WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)',
    args: [taskId, 'some-real-user-id'],
  });
  assert.equal(fixedMatch.rows.length, 1, 'qintian/calibration与agents/run共用的这段SQL必须能匹配到真实的NULL行，否则回归重现');

  // 反面情形：真的有其它租户的行时，NULL兜底不应该让"不存在的id"变成"存在"。
  const noMatch = await db.execute({
    sql: 'SELECT id FROM tasks WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)',
    args: ['task_never_existed', 'some-real-user-id'],
  });
  assert.equal(noMatch.rows.length, 0, '不存在的taskId不应该被NULL兜底误判成存在');
});
