import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRaiseInput } from './raise-build.ts';
import type { RaiseDraft } from './types';

const draft: RaiseDraft = { sourceTaskId: 't', command: 'c', title: 'x', priority: 50, reality: 'real', meta: {} };

test('铁律4:部门自动项带 flywheel.auto=true,可与人工任务区分', () => {
  const inp = buildRaiseInput(draft, 'hubu');
  const fw = inp.result.flywheel as Record<string, unknown>;
  assert.equal(fw.auto, true);               // 统计/KPI 可据此排除自动项
  assert.equal(fw.dept, 'hubu');
});

test('铁律:绝不冒充 LIVE 假数据 — sourceLabel 真实反映', () => {
  assert.equal(buildRaiseInput(draft, 'hubu').result.sourceLabel, 'real');
  assert.equal(buildRaiseInput({ ...draft, reality: 'fallback' }, 'hubu').result.sourceLabel, 'fallback');
});
