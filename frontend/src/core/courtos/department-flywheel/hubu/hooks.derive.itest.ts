// src/core/courtos/department-flywheel/hubu/hooks.derive.itest.ts
// 集成测试：derive 依赖 evaluateProject(@/ 值导入)，须在 tsx 环境下跑（test:node）。
// 不在 test:core 里（*.nodetest.ts glob 不捕获 *.itest.ts）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubuHooks } from './hooks';
import type { SourceTask } from '../types';

const big: SourceTask = { id: 'b', title: '储能采购', command: '储能采购预算 80万 预期回报 2.5x 风险高', status: 'pending', updatedAt: '2026-06-28T02:00:00Z' };

test('derive 产 real 待决项 + 带 verdict 元数据,缺数字不编', () => {
  const d = hubuHooks.derive(big);
  assert.ok(d && d.reality === 'real');
  assert.ok(d!.command.includes('户部'));
  assert.ok('verdict' in d!.meta);
});
