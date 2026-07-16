import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

test('jinyiwei client radar is explicitly SHADOW and decision-ineligible', () => {
  const text = source('features/jinyiwei/lib/lead-radar.ts');
  assert.match(text, /capabilityMode: 'SHADOW'/);
  assert.match(text, /sourceLabel: 'FALLBACK'/);
  assert.match(text, /decisionEligible: false/);
});

test('gongbu client evaluation is labelled as non-canonical advice', () => {
  const text = source('features/departments/lib/department-task-insights.ts');
  assert.match(text, /SHADOW · 客户端规则参考 · 非后端工部裁决/);
});

test('xingbu client scan is a SHADOW first-pass and never claims low risk', () => {
  const text = source('features/xingbu/components/xingbu-contract-workbench.tsx');
  assert.match(text, /SHADOW · 客户端规则初筛 · 非法律意见\/非刑部正式裁决/);
  assert.equal(/label: '低风险'/.test(text), false);
  assert.match(text, /未命中已知规则/);
});

test('frontend governance gate declares its client-only shadow boundary', () => {
  const text = source('features/governance/lib/gate.ts');
  assert.match(text, /SHADOW_CLIENT_GUARD_ONLY/);
  assert.match(text, /不得作为后端御史正式裁决/);
});
