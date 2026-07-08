import test from 'node:test';
import assert from 'node:assert/strict';

import { groundingBadge, decisionTrustScore } from './ask-answer-panel.tsx';

test('grounded=true 且接地率高 → 绿色"已校验"', () => {
  const b = groundingBadge({ grounded: true, grounding: { total: 8, grounded: 8, rate: 1 } });
  assert.equal(b.color, '#5FB97A');
  assert.equal(b.warn, false);
  assert.match(b.label, /已校验/);
});

test('grounded=false（终止门未过）→ 红色警示，且 label 绝不含"已校验"（CRITICAL 回归）', () => {
  const b = groundingBadge({ grounded: false, grounding: { total: 5, grounded: 2, rate: 0.4 } });
  assert.equal(b.color, '#E5604D');
  assert.equal(b.warn, true);
  assert.doesNotMatch(b.label, /已校验/, 'grounded=false 时不得呈现为已校验');
});

test('grounded=false 即使接地率显示为高 → 仍红色警示（门优先于率）', () => {
  // 边界：rate 高但终止门判 false（重写后仍有未接地数字）——门说了算。
  const b = groundingBadge({ grounded: false, grounding: { total: 10, grounded: 9, rate: 0.9 } });
  assert.equal(b.warn, true);
  assert.doesNotMatch(b.label, /已校验/);
});

test('接地率中等(<80%)→ 黄色待补据(warn)', () => {
  const b = groundingBadge({ grounded: true, grounding: { total: 10, grounded: 6, rate: 0.6 } });
  assert.equal(b.color, '#E5B84D');
  assert.equal(b.warn, true);
});

test('无数字断言 → 中性，不警示不夸大', () => {
  const b = groundingBadge({ grounded: true, grounding: { total: 0, grounded: 0, rate: 1 } });
  assert.equal(b.warn, false);
  assert.doesNotMatch(b.label, /已校验/);
});

test('decisionTrustScore：接地+证据+冲突声明 → 高可信', () => {
  const t = decisionTrustScore({
    answer: 'x', grounding: { total: 4, grounded: 4, rate: 1 }, grounded: true,
    evidence: ['a', 'b'], conflicts: '此结论涉及付款，需刑部复核',
  });
  assert.ok(t.score >= 80, `应高可信,实际 ${t.score}`);
  assert.equal(t.label, '高可信');
});

test('decisionTrustScore（CRITICAL 回归）：grounded=false → 封顶谨慎,绝不高可信', () => {
  const t = decisionTrustScore({
    answer: 'x', grounding: { total: 5, grounded: 2, rate: 0.4 }, grounded: false,
    evidence: ['a'], conflicts: '会被户部推翻',
  });
  assert.ok(t.score <= 40, `未接地必封顶,实际 ${t.score}`);
  assert.notEqual(t.label, '高可信');
});

test('decisionTrustScore：错误/空答复 → 0 分', () => {
  assert.equal(decisionTrustScore({ error: 'Unauthorized' }).score, 0);
  assert.equal(decisionTrustScore({}).score, 0);
});

test('decisionTrustScore：声明冲突=诚实加分(敢自我怀疑的 AI 更可信)', () => {
  const withC = decisionTrustScore({ answer: 'x', grounding: { total: 0, grounded: 0, rate: 1 }, grounded: true, conflicts: '需刑部复核' });
  const noC = decisionTrustScore({ answer: 'x', grounding: { total: 0, grounded: 0, rate: 1 }, grounded: true, conflicts: '无' });
  assert.ok(withC.score > noC.score, '声明冲突应比"无"得分高');
});
