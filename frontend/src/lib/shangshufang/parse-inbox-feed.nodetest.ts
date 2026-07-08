/**
 * 收件箱五源 feed 边界校验 · 金标 + 反例评测集（离线单测，即为交后端的 eval fixtures）：
 *   npx tsx --test src/lib/shangshufang/parse-inbox-feed.nodetest.ts
 *
 * 这些用例就是 handoff 给后端的「什么算对」：后端调 agent prompt 调到能过金标、被反例拒，即达标。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInboxFeed } from './parse-inbox-feed.ts';

// ── 金标正例：一条真实、可裁、带真证据的军机处待裁项 ───────────────────────────
const GOLDEN_ITEM = {
  id: 'junjichu-case-20260705-001',
  title: '客户要求正式报价，军机处会审待陛下裁决',
  tag: '军机处 · 会审待决',
  priority: 'urgent',
  origin: 'bing_bu',
  source: 'turso',
  suggestedCommand: '请就正式报价边界下旨。',
  citations: [{ source: '销售记录', snippet: '客户 2026-07-05 要求今日给正式报价。' }],
  recommendedMinisters: ['hu_bu', 'xing_bu'],
};

test('金标：真实待裁项全部通过、零拒收', () => {
  const r = parseInboxFeed({ success: true, data: { sourceMode: 'real', items: [GOLDEN_ITEM] } });
  assert.equal(r.sourceMode, 'real');
  assert.equal(r.items.length, 1);
  assert.equal(r.rejected.length, 0);
  assert.equal(r.items[0]!.origin, 'bing_bu');
});

test('金标·空态诚实：real + 空 items = 今天没有，不拒、不冒充', () => {
  const r = parseInboxFeed({ success: true, data: { sourceMode: 'real', items: [] } });
  assert.equal(r.sourceMode, 'real');
  assert.equal(r.items.length, 0);
  assert.equal(r.rejected.length, 0);
});

test('反例·sourceMode 缺失 → 判 unavailable、拒渲染（区分「读不到」）', () => {
  const r = parseInboxFeed({ data: { items: [GOLDEN_ITEM] } });
  assert.equal(r.sourceMode, 'unavailable');
  assert.equal(r.items.length, 0);
  assert.ok(r.rejected.length >= 1);
});

test('反例·非法 origin（marketing 不在 11 码）→ 丢弃该项', () => {
  const bad = { ...GOLDEN_ITEM, origin: 'marketing' };
  const r = parseInboxFeed({ data: { sourceMode: 'real', items: [bad] } });
  assert.equal(r.items.length, 0);
  assert.ok(r.rejected.some((x) => x.reason.includes('形状非法')));
});

test('反例·占位/伪造证据 → 丢弃该项（锦衣卫可信度门）', () => {
  const faked = { ...GOLDEN_ITEM, id: 'x-fake', citations: [{ source: '待补', snippet: '示例证据待接入' }] };
  const r = parseInboxFeed({ data: { sourceMode: 'real', items: [faked] } });
  assert.equal(r.items.length, 0);
  assert.ok(r.rejected.some((x) => x.id === 'x-fake' && x.reason.includes('占位')));
});

test('反例·空 snippet 证据 → 丢弃', () => {
  const empty = { ...GOLDEN_ITEM, id: 'x-empty', citations: [{ source: 'x', snippet: '   ' }] };
  const r = parseInboxFeed({ data: { sourceMode: 'real', items: [empty] } });
  assert.equal(r.items.length, 0);
});

test('混合：真项保留、脏项剔除，不整批崩', () => {
  const dirty = { ...GOLDEN_ITEM, id: 'x-dirty', origin: 'nope' };
  const r = parseInboxFeed({ data: { sourceMode: 'real', items: [GOLDEN_ITEM, dirty] } });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0]!.id, GOLDEN_ITEM.id);
  assert.equal(r.rejected.length, 1);
});
