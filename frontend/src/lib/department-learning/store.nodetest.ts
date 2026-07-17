import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { blastRadiusFromText } from '../../core/courtos/harness/human-approval-gate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFile(join(here, rel), 'utf8');

/**
 * C1 回归护栏(2026-06-20 会审):学习记录必须写独立 department_learning 表,
 * 结构上不得碰主库 tasks(否则被 briefing/史馆/今日完成 KPI 当奏折读出,污染朝报)。
 * node --test 不解析 @/,故用「源码静态断言」证明结构隔离——与 tasks 解耦即不可能污染。
 */
test('C1: 学习持久化结构上与主库 tasks 解耦', async () => {
  const store = await read('./store.ts');
  assert.match(store, /department_learning/, 'store 必须用独立 department_learning 表');
  // 只看 SQL 实际用法,不看注释(文档里提到 tasks 是说明隔离意图)。
  assert.doesNotMatch(store, /(FROM|INTO|UPDATE)\s+tasks\b/, 'store 不得读写 tasks 表');
  assert.doesNotMatch(store, /upsertPrimaryTask/, 'store 不得经 upsertPrimaryTask 写 tasks');

  for (const rel of [
    './advisor-signal.ts',
    './real-source.ts',
    './archive-backfill.ts',
  ]) {
    const src = await read(rel);
    assert.doesNotMatch(src, /upsertPrimaryTask/, `${rel} 不得写 tasks`);
    assert.doesNotMatch(src, /FROM tasks/, `${rel} 不得读 tasks`);
  }
});

test('C1: real-source 长期提权必须走签核与史馆双证据链', async () => {
  const source = await read('./real-source.ts');
  assert.match(source, /loadBossDecisionOutcomeEvidence/, 'boss_decision 证据必须查签核哈希链,不能只信字符串');
  assert.match(source, /hasCourtArchive/, '长期 confirmed\/refuted 必须查史馆归档');
  assert.match(source, /暂记 observing，不长期提权/, '单签核证据不能长期提高部门权重');
});

/**
 * 安全护栏(解冻做安全 2026-06-22 · 铁律4):部门学习不得恢复 e2e 伪造证据提权后门。
 * 旧前端 orchestrate BFF 与其 env 闸已整体退役，生产决策边界由 canonical projection/导入门承接。
 */
test('安全: e2e 伪造证据提权后门已除', async () => {
  const source = await read('./real-source.ts');
  assert.doesNotMatch(source, /isE2eEvidenceId/, 'e2e 伪造后门 isE2eEvidenceId 必须移除(解冻≠开后门)');
});

/**
 * 样本量闸门接线证明(2026-07-03 P2修)：real-source.ts 必须真的调用 deriveThresholdedVerdict
 * (verdict-threshold.ts 的纯函数单测见 verdict-threshold.nodetest.ts)，不能只留一个没人用的
 * 摆设函数，也不能倒退回"直接用 verdictForAction 结果覆盖 verdict"的旧写法(那正是
 * DEPARTMENT_LEARNING_FEED_DECISIONS 默认关时留下的单样本噪声风险根因)。
 */
test('样本量闸门真接线: real-source.ts 真调用 deriveThresholdedVerdict,不再是最近一次事件直接覆盖判定', async () => {
  const source = await read('./real-source.ts');
  assert.match(source, /deriveThresholdedVerdict/, 'applyDepartmentLearningRealSource 必须调用样本量闸门纯函数');
  assert.doesNotMatch(
    source,
    /verdict:\s*DepartmentLearningRecord\['verdict'\]\s*=\s*verified\.archiveConfirmed\s*\?\s*finalVerdict/,
    '不得倒退回"验真通过就直接用本轮 finalVerdict 覆盖"的旧写法(单样本即可甩权重)',
  );
});

/**
 * 证据关联漏洞接线证明(2026-07-03 会审HIGH修复，随会审MEDIUM抽纯函数后更新)：
 * real-source.ts 的 verifyEvidence 必须真的调用 resolveArchiveConfirmation(纯函数比对逻辑，
 * 真行为测试见 archive-correlation.nodetest.ts)，不能倒退回"只查归档是否存在"的旧写法——
 * 那正是陈旧pending签核被不相关新归档误配对反复计数的根因。archive-backfill.ts 必须真的
 * 把 expectedTaskId 传过去，不能只加了字段没人传。
 */
test('证据关联漏洞真接线: real-source.ts 调用 resolveArchiveConfirmation，archive-backfill.ts 真传 expectedTaskId', async () => {
  const source = await read('./real-source.ts');
  assert.match(
    source,
    /resolveArchiveConfirmation/,
    'verifyEvidence 必须调用纯函数做 taskId 关联判定，不能只信"归档是否存在"',
  );
  const correlation = await read('./archive-correlation.ts');
  assert.match(
    correlation,
    /outcomeTaskId\s*&&\s*input\.expectedTaskId/,
    'resolveArchiveConfirmation 必须要求双方taskId都在场才走严格比对',
  );
  const backfill = await read('./archive-backfill.ts');
  assert.match(
    backfill,
    /expectedTaskId:\s*archive\.task_id/,
    'archive-backfill.ts 必须把当前正在处理的归档 taskId 传给 real-source.ts 做关联校验',
  );
});

test('C1: 史馆入史后才允许 pending 学习记录二次提权', async () => {
  const archiveStore = await read('../../core/courtos/archive/archive-store.ts');
  const backfill = await read('./archive-backfill.ts');
  assert.match(archiveStore, /backfillDepartmentLearningFromArchive/, 'saveShiguanArchiveRecordV1 后必须触发学习回填');
  assert.match(backfill, /archive:pending/, '归档回填只处理等待史馆确认的学习记录');
  assert.match(backfill, /applyDepartmentLearningRealSource/, '归档回填仍必须复用双证据 real-source 门');
});

/**
 * H1 机制(2026-06-20 会审):裁决责任徽的「高风险」必须源自 §8.7 SSOT(detectHighRisk),
 * 不从 seal/priority 自造。证明:命中关键词→irreversible(徽章红),未命中→internal(中性)。
 */
test('H1: blastRadiusFromText 接 §8.7 高风险 SSOT,真高风险才报红', () => {
  assert.equal(blastRadiusFromText('客户要求正式报价，要签合同'), 'irreversible');
  assert.equal(blastRadiusFromText('涉及股权与预付款安排'), 'irreversible');
  assert.equal(blastRadiusFromText(['对外报价', '客户承诺']), 'irreversible');
  // 证券/仓位裁决(2026-06-20 补入 §8.7)→ 高危报红,真金白银不可逆。
  assert.equal(blastRadiusFromText('三花智控当前仓位是否该减'), 'irreversible');
  assert.equal(blastRadiusFromText('是否清仓某只股票'), 'irreversible'); // 经「股票」命中,非「清仓」
  // 制造-供应链近义反例(会审防告警疲劳):删了 建仓/持仓/清仓,这些仓储语境必须保持中性。
  assert.equal(blastRadiusFromText('新建仓库项目预算审批'), 'internal');
  assert.equal(blastRadiusFromText('清仓大促去化库存'), 'internal');
  assert.equal(blastRadiusFromText('支持仓储扩容'), 'internal');
  // 真·低危事务仍中性。
  assert.equal(blastRadiusFromText('帮我把奏折标题改短一点'), 'internal');
});
