// src/core/courtos/department-flywheel/bingbu/hooks.nodetest.ts
// 纯函数门：selectCandidates + passesThreshold（无 @/ 值导入，跑 test:core）。
// derive 测试因依赖 @/ 值导入，已移至 hooks.derive.itest.ts（test:node 覆盖）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCandidates, passesThreshold } from './hooks-pure.ts';
import type { SourceTask } from '../types.ts';

const salesTask: SourceTask = {
  id: 's1',
  title: '大客户报价策略',
  command: '客户要求我们提供一份竞品对比报价，希望了解折扣空间',
  status: 'submitted',
  updatedAt: '2026-06-28T08:00:00Z',
};

const negotiationTask: SourceTask = {
  id: 's2',
  title: '渠道代理协议',
  command: '讨论渠道伙伴分成比例和独家经销协议条款',
  status: 'submitted',
  updatedAt: '2026-06-28T08:00:00Z',
};

const offTopic: SourceTask = {
  id: 'o1',
  title: '招聘工程师',
  command: '招募两名后端工程师，负责基础架构',
  status: 'submitted',
  updatedAt: '2026-06-28T08:00:00Z',
};

// 单关键词任务：宽筛(≥1)放行，但阈值门(≥2)拦截 — 用于递进断言
const singleKeywordTask: SourceTask = {
  id: 'sk1',
  title: '销售讨论',
  command: '本周工作安排确认',
  status: 'submitted',
  updatedAt: '2026-06-28T08:00:00Z',
};

test('selectCandidates 只保留兵部销售语义任务', () => {
  const result = selectCandidates([salesTask, negotiationTask, offTopic]).map((t) => t.id);
  assert.deepEqual(result.sort(), ['s1', 's2']);
  assert.equal(result.includes('o1'), false);
});

test('passesThreshold 要求关键词命中≥2 才放行（比 selectCandidates 严）', () => {
  // 多关键词命中 → 放行
  assert.equal(passesThreshold(salesTask), true, 's1 多关键词命中应放行');
  assert.equal(passesThreshold(negotiationTask), true, 's2 多关键词命中应放行');
  // 0 关键词 → 拦截
  assert.equal(passesThreshold(offTopic), false, 'o1 0命中应拦截');
  // 1 关键词（只含"销售"）→ 拦截（命中数=1 < 2）
  assert.equal(passesThreshold(singleKeywordTask), false, 'sk1 仅1命中应被阈值门拦截');
});

test('两道闸真正递进：selectCandidates 候选中存在不通过 passesThreshold 的任务', () => {
  const candidates = selectCandidates([salesTask, negotiationTask, offTopic, singleKeywordTask]);
  // singleKeywordTask 应被 selectCandidates 放行（有"销售"关键词）
  assert.ok(candidates.some((t) => t.id === 'sk1'), 'sk1 应进入候选（宽筛≥1）');
  // 但 singleKeywordTask 不过 passesThreshold（仅1命中 < 2）
  const failedGate = candidates.filter((t) => !passesThreshold(t));
  assert.ok(failedGate.length > 0, '候选中必须存在至少一条被阈值门拦截的任务（两道闸递进有效）');
  assert.ok(failedGate.some((t) => t.id === 'sk1'), 'sk1 应被阈值门拦截');
});
