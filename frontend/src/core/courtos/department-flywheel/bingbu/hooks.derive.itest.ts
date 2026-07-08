// src/core/courtos/department-flywheel/bingbu/hooks.derive.itest.ts
// 集成测试：derive 依赖 @/ 值导入，须在 tsx 环境下跑（test:node）。
// 不在 test:core 里（*.nodetest.ts glob 不捕获 *.itest.ts）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bingbuHooks } from './hooks';
import type { SourceTask } from '../types';

const salesTask: SourceTask = {
  id: 'b1',
  title: '大客户报价策略',
  command: '客户要求我们提供一份竞品对比报价，希望了解折扣空间和付款条件',
  status: 'submitted',
  updatedAt: '2026-06-28T08:00:00Z',
};

const channelTask: SourceTask = {
  id: 'b2',
  title: '渠道伙伴协议',
  command: '讨论渠道代理分成比例和独家经销协议，客户有预算120万',
  status: 'submitted',
  updatedAt: '2026-06-28T08:00:00Z',
};

test('derive 产 real 待决项 + 带 questionType 元数据', () => {
  const d = bingbuHooks.derive(salesTask);
  assert.ok(d !== null, 'derive 不应返回 null');
  assert.equal(d!.reality, 'real');
  assert.ok(d!.command.includes('兵部呈报待决'), 'command 应含兵部标识');
  assert.ok(d!.command.includes('CRO裁决'), 'command 应含 CRO 裁决');
  assert.ok('questionType' in d!.meta, 'meta 应含 questionType');
  assert.ok('signal' in d!.meta, 'meta 应含 signal');
  assert.ok('missing' in d!.meta, 'meta 应含 missing 缺证字段');
});

test('derive 渠道任务 meta 带 subOffices', () => {
  const d = bingbuHooks.derive(channelTask);
  assert.ok(d !== null, 'derive 不应返回 null');
  assert.ok(Array.isArray(d!.meta.subOffices), 'meta.subOffices 应为数组');
  assert.ok((d!.meta.subOffices as string[]).length > 0, '渠道任务至少应选一个司');
});

test('derive priority 为数字', () => {
  const d = bingbuHooks.derive(salesTask);
  assert.ok(d !== null);
  assert.ok(typeof d!.priority === 'number', 'priority 应为 number');
});

// —— MED-2 回归断言：禁把 FALLBACK/DEMO 源漂白成 LIVE(铁律2)——
test('无 sourceLabel 源视为 real(真实用户输入 + 本地确定性启发式)', () => {
  const d = bingbuHooks.derive(salesTask);
  assert.equal(d!.reality, 'real');
});

test('FALLBACK 源任务禁漂白 — derive.reality 原样降级为 fallback', () => {
  const d = bingbuHooks.derive({ ...salesTask, sourceLabel: 'FALLBACK' });
  assert.ok(d !== null);
  assert.equal(d!.reality, 'fallback', 'FALLBACK 源必须标 fallback，禁升级为 real/LIVE');
});

test('DEMO 源任务禁漂白 — derive.reality 降级为 mock', () => {
  const d = bingbuHooks.derive({ ...salesTask, sourceLabel: 'DEMO' });
  assert.ok(d !== null);
  assert.equal(d!.reality, 'mock', 'DEMO 源必须标 mock，禁升级为 real/LIVE');
});
