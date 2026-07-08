/**
 * reality-state 回归 · #9 黑天鹅保险（防"假 LIVE"·2026-06-28 塔勒布优先）。
 * 跑：npx --yes tsx --test src/lib/reality/reality-state.nodetest.ts
 *
 * 锁死的不变量（任一破 = 后端挂了却给用户标 LIVE，信任崩塌的黑天鹅）：
 *   ① 只有真 LIVE 家族 → real；② 降级/假数据态绝不 → real；
 *   ③ 未知/垃圾输入 → missing（安全），绝不默认 real；④ 合并取最坏，永不升级到 real。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRealityState, worstRealityState, REALITY_LABEL } from './reality-state.ts';

test('只有真 LIVE 家族 → real', () => {
  for (const v of ['real', 'ready', 'LIVE', 'LIVE_SWARM']) {
    assert.equal(normalizeRealityState(v), 'real', `${v} 应 real`);
  }
});

test('降级/假数据态 → 绝不 real', () => {
  for (const v of ['fallback', 'FALLBACK', 'MIXED']) assert.equal(normalizeRealityState(v), 'fallback');
  for (const v of ['mock', 'DEMO']) assert.equal(normalizeRealityState(v), 'mock');
  for (const v of ['degraded', 'needs_backend', 'FIX']) assert.equal(normalizeRealityState(v), 'degraded');
});

test('未知/垃圾输入 → missing(安全)，绝不默认 real', () => {
  for (const v of ['', 'live', 'LiVe', 'garbage', 'true', null, undefined, 0, 1, {}, []]) {
    const s = normalizeRealityState(v);
    assert.notEqual(s, 'real', `垃圾输入 ${JSON.stringify(v)} 绝不能 → real`);
    assert.equal(s, 'missing', `垃圾输入 ${JSON.stringify(v)} 应安全归 missing`);
  }
});

test('worst wins：混合永不升级到 real', () => {
  assert.equal(worstRealityState(['real', 'fallback']), 'fallback');
  assert.equal(worstRealityState(['real', 'mock']), 'mock');
  assert.equal(worstRealityState(['real', 'degraded', 'fallback']), 'degraded');
  assert.equal(worstRealityState(['real', 'real']), 'real'); // 只有全真才真
});

test('REAL 标签诚实：只有 real 态能显 REAL/LIVE，降级态不许', () => {
  assert.equal(REALITY_LABEL.real, 'REAL');
  for (const [k, label] of Object.entries(REALITY_LABEL)) {
    if (k === 'real') continue;
    assert.doesNotMatch(label, /REAL|LIVE/i, `降级态 ${k} 的 label「${label}」不能含 REAL/LIVE`);
  }
});

test('[边缘·已知风险] 空信号列表 → real（乐观默认）：调用方禁止用 [] 表示"无数据"', () => {
  // 当前行为：空列表归 real。这是唯一的"假 LIVE"边缘——
  // 防线在调用方：无真实信号时必须显式传 ['missing']/['degraded']，不得传 []。
  assert.equal(worstRealityState([]), 'real');
});
