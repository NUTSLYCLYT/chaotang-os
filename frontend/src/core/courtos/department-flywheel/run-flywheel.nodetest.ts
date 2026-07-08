// src/core/courtos/department-flywheel/run-flywheel.nodetest.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFlywheel } from './run-flywheel.ts';
import type { DeptHooks, SourceTask, RaiseDraft } from './types';

const tasks: SourceTask[] = [
  { id: 't1', title: '小额', command: '买纸 200', status: 'pending', updatedAt: '2026-06-28T01:00:00Z' },
  { id: 't2', title: '大额', command: '储能采购预算 80万 风险高', status: 'pending', updatedAt: '2026-06-28T02:00:00Z' },
];
const hooks: DeptHooks = {
  dept: 'hubu',
  selectCandidates: (ts) => ts.filter((t) => t.command.includes('预算') || t.command.includes('采购')),
  passesThreshold: (t) => t.command.includes('万'),
  derive: (t): RaiseDraft => ({ sourceTaskId: t.id, command: `户部待决:${t.command}`, title: t.title, priority: 80, reality: 'real', meta: {} }),
};

test('runFlywheel: 筛选→阈值→加工→去重→上限→raise,且记录统计', async () => {
  const raised: string[] = [];
  const res = await runFlywheel(hooks, { maxPerRun: 2 }, {
    tasks, ledger: [], raise: async (d) => { raised.push(d.sourceTaskId); return `dept_raise_${d.sourceTaskId}`; },
  });
  assert.equal(res.raised.length, 1);          // 只有 t2 过阈值(含"万")
  assert.equal(res.raised[0].sourceTaskId, 't2');
  assert.deepEqual(raised, ['t2']);
});

test('runFlywheel: 单项 derive 抛错被隔离,不中断整轮', async () => {
  const boom: DeptHooks = { ...hooks, derive: () => { throw new Error('boom'); } };
  const res = await runFlywheel(boom, { maxPerRun: 2 }, { tasks, ledger: [], raise: async () => 'x' });
  assert.equal(res.raised.length, 0);
  assert.ok(res.skipped.some((s) => s.reason.includes('boom') || s.reason.includes('derive')));
});

test('runFlywheel: 自产待决项(dept_raise_* 等前缀)不得被当候选来源,防自反馈放大环', async () => {
  // 把一条飞轮自产任务混入候选池;它应在 selectCandidates 之前被过滤掉
  const selfAmplifyTask: import('./types').SourceTask = {
    id: 'dept_raise_hubu_xxx',
    title: '自产待决:储能采购预算 80万',
    command: '储能采购预算 80万 风险高',
    status: 'pending',
    updatedAt: '2026-06-28T03:00:00Z',
  };
  const tasksWithSelf = [...tasks, selfAmplifyTask];
  const raised: string[] = [];
  const res = await runFlywheel(hooks, { maxPerRun: 10 }, {
    tasks: tasksWithSelf,
    ledger: [],
    raise: async (d) => { raised.push(d.sourceTaskId); return `dept_raise_${d.sourceTaskId}`; },
  });
  // dept_raise_hubu_xxx 不得出现在 raised 里
  assert.ok(
    !res.raised.some((r) => r.sourceTaskId === 'dept_raise_hubu_xxx'),
    'dept_raise_ 前缀任务不得作为 sourceTaskId 产出新待决项'
  );
  // 合法任务 t2 仍应正常产出
  assert.equal(res.raised.length, 1, '正常候选 t2 仍应产出');
  assert.equal(res.raised[0].sourceTaskId, 't2');
  // scanned 应计总数(含自产项)
  assert.equal(res.scanned, tasksWithSelf.length);
});
