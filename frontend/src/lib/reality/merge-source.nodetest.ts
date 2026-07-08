import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeHonestSource } from './merge-source';

/**
 * 铁律4 回归(2026-06-29 · 真验证挖出的诚实标源 bug):
 * 决策主闭环丞相(refine)超时离线,但路由旧逻辑只取 report 标、`?? 'LIVE'` 默认 → 整体标 LIVE,
 * 骗裁决者"这是真 AI 判断"(违铁律13.2.3 FALLBACK禁伪装LIVE)。
 * 钉死:任一步降级 → 整体绝不 LIVE。会咬证明:把 route 改回单取 report 标 → 本断言红。
 */
test('refine 离线(FALLBACK) + report 真(LIVE) → MIXED,绝不 LIVE', () => {
  assert.equal(mergeHonestSource(['FALLBACK', 'LIVE']), 'MIXED');
  assert.equal(mergeHonestSource(['DEMO', 'LIVE']), 'MIXED');
  assert.equal(mergeHonestSource(['LIVE', 'FALLBACK']), 'MIXED');
});

test('全真 → LIVE', () => {
  assert.equal(mergeHonestSource(['LIVE', 'LIVE']), 'LIVE');
  assert.equal(mergeHonestSource(['LIVE', 'LIVE_SWARM']), 'LIVE');
});

test('全降级 → FALLBACK / 全演示 → DEMO', () => {
  assert.equal(mergeHonestSource(['FALLBACK', 'FALLBACK']), 'FALLBACK');
  assert.equal(mergeHonestSource(['DEMO', 'DEMO']), 'DEMO');
  assert.equal(mergeHonestSource(['FALLBACK', 'DEMO']), 'FALLBACK');
});

test('未知(空/undefined)→ FALLBACK,绝不默认 LIVE(旧 ?? LIVE 的根)', () => {
  assert.equal(mergeHonestSource([]), 'FALLBACK');
  assert.equal(mergeHonestSource([undefined, null]), 'FALLBACK');
});
