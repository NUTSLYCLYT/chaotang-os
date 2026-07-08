// src/app/(dashboard)/command-center/panel-mode.itest.ts
// 铁律4 回归断言：诚实徽章不该发生的事 —— 不实源(FALLBACK/MIXED/DEMO)禁标绿 LIVE。
// 依赖 @/ 值导入(isLiveLike)，跑 test:node(tsx)，不在 test:core。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePanelMode } from './panel-mode.ts';

test('无 task → DEMO；有 task 无数据 → PENDING', () => {
  assert.equal(resolvePanelMode(false, false), 'DEMO');
  assert.equal(resolvePanelMode(false, true), 'DEMO');
  assert.equal(resolvePanelMode(true, false), 'PENDING');
});

test('有数据 + live 源 → LIVE(绿)', () => {
  assert.equal(resolvePanelMode(true, true, 'LIVE'), 'LIVE');
  assert.equal(resolvePanelMode(true, true, 'LIVE_SWARM'), 'LIVE');
});

test('铁律4：有数据但不实源禁漂白绿 —— FALLBACK/MIXED/DEMO 一律标 FALLBACK', () => {
  assert.equal(resolvePanelMode(true, true, 'FALLBACK'), 'FALLBACK', 'FALLBACK 源禁标 LIVE');
  assert.equal(resolvePanelMode(true, true, 'MIXED'), 'FALLBACK', 'MIXED 源禁标 LIVE');
  assert.equal(resolvePanelMode(true, true, 'DEMO'), 'FALLBACK', 'DEMO 源禁标 LIVE');
});

test('缺来源标(面板未透传)→ 维持既有 LIVE 行为(向后兼容,不制造回归)', () => {
  assert.equal(resolvePanelMode(true, true), 'LIVE');
  assert.equal(resolvePanelMode(true, true, null), 'LIVE');
});
