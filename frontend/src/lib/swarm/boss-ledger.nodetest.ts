/** npx tsx --test src/lib/swarm/boss-ledger.nodetest.ts (需 @/ 别名，走 test:node 而非裸 node) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';

// ── 会审HIGH修复回归(2026-07-03)：boss_decisions 必须记住自己属于哪个taskId ──
// 根因：此前 archive-backfill.ts 只能靠"任意归档是否存在"匹配陈旧pending签核，导致同一条
// 签核被不相关的新归档反复误配对确认。修法：recordOrchestration 存 task_id，
// loadBossDecisionOutcomeEvidence 读回，real-source.ts 用它做严格匹配。这里测底层存取正确性。
test('recordOrchestration 存 taskId，loadBossDecisionOutcomeEvidence 能读回', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/boss-ledger-taskid-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/boss-ledger-taskid-test.db';

  const { recordOrchestration, signOff, loadBossDecisionOutcomeEvidence } = await import('./boss-ledger.ts');

  const merge = { verdict: 'v', escalateToBoss: false, conflicts: [] };
  const rec = await recordOrchestration('测试命令', merge, '2026-07-03T00:00:00.000Z', 'task_abc_123');
  assert.ok(rec, 'recordOrchestration 应成功');

  await signOff(rec!.id, 'signed', 'hu_bu', null, '2026-07-03T00:01:00.000Z');

  const outcome = await loadBossDecisionOutcomeEvidence(rec!.id);
  assert.ok(outcome, '应能查到已签核记录');
  assert.equal(outcome!.taskId, 'task_abc_123', 'taskId 必须被正确存取，供归档关联校验用');
});

test('recordOrchestration 不传 taskId 时向后兼容(存 null，不报错)', async () => {
  mkdirSync('dev/tmp', { recursive: true });
  rmSync('dev/tmp/boss-ledger-notaskid-test.db', { force: true });
  process.env.TURSO_DB_URL = 'file:./dev/tmp/boss-ledger-notaskid-test.db';

  const { recordOrchestration, signOff, loadBossDecisionOutcomeEvidence } = await import('./boss-ledger.ts');

  const merge = { verdict: 'v', escalateToBoss: false, conflicts: [] };
  const rec = await recordOrchestration('测试命令(无taskId)', merge, '2026-07-03T00:00:00.000Z');
  assert.ok(rec, '不传 taskId 时 recordOrchestration 仍应正常工作(向后兼容旧调用方)');

  await signOff(rec!.id, 'signed', 'hu_bu', null, '2026-07-03T00:01:00.000Z');
  const outcome = await loadBossDecisionOutcomeEvidence(rec!.id);
  assert.equal(outcome!.taskId, null, '未传 taskId 时应存 null，不得静默编造一个假值');
});
