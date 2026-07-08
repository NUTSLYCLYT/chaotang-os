import { test } from 'node:test';
import assert from 'node:assert/strict';

import { referenceClass, type PastCase } from './reference-class.ts';

const NOW = '2026-06-28T00:00:00.000Z';

function mkCase(id: string, summary: string, outcome: PastCase['outcome'], daysAgo: number, confirmed = true): PastCase {
  const decidedAt = new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
  return { id, summary, outcome, decidedAt, confirmed };
}

test('★死线:史馆同类案 < 5 → analogy_only,不给概率分布(防假统计)', () => {
  const cases = [
    mkCase('c1', '收购上游供应商 扩产能', 'success', 30),
    mkCase('c2', '收购竞品 整合市场', 'failed', 60),
  ];
  const r = referenceClass('要不要收购这家供应商', cases, { nowIso: NOW });
  assert.equal(r.mode, 'analogy_only');
  assert.equal(r.thickness, 'thin');
  assert.deepEqual(r.distribution, {});
  assert.ok(r.usedCaseIds.length <= 2);
});

test('样本足(≥5 同类) → base_rate 概率分布 + 可溯源', () => {
  const cases = [
    mkCase('a1', '收购供应商 扩产能 整合', 'success', 10),
    mkCase('a2', '收购供应商 降成本', 'success', 40),
    mkCase('a3', '收购供应商 失败 整合难', 'failed', 80),
    mkCase('a4', '收购上游 供应商 成功', 'success', 120),
    mkCase('a5', '收购供应商 被阻 合规', 'blocked', 200),
    mkCase('a6', '收购 供应商 整合 成功', 'success', 15),
    mkCase('z1', '员工绩效考核 调薪', 'success', 5), // 不相关,应被相似度滤掉
  ];
  const r = referenceClass('收购这家供应商 扩产能', cases, { nowIso: NOW });
  assert.equal(r.mode, 'base_rate');
  assert.ok(['medium', 'thick'].includes(r.thickness));
  // 分布应以 success 为主(6 个收购案里 success 占多)
  assert.ok((r.distribution.success ?? 0) > (r.distribution.failed ?? 0));
  // 不相关的绩效案不该进来
  assert.ok(!r.usedCaseIds.includes('z1'));
  // 概率和 ≈ 1
  const sum = Object.values(r.distribution).reduce<number>((a, b) => a + (b ?? 0), 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
});

test('信任加权:待验案(confirmed=false)计入厚度但不计入结果分布', () => {
  const cases = [
    mkCase('p1', '收购供应商 整合', 'success', 10, true),
    mkCase('p2', '收购供应商 降本', 'success', 12, true),
    mkCase('p3', '收购供应商 扩产', 'success', 14, true),
    mkCase('p4', '收购供应商 合规', 'success', 16, true),
    mkCase('p5', '收购供应商 失败', 'failed', 18, false), // 待验:计厚度不计分布
  ];
  const r = referenceClass('收购供应商', cases, { nowIso: NOW });
  assert.equal(r.mode, 'base_rate');
  // 待验的 failed 不该把 success 拉下来(effectiveN=已兑现数)
  assert.equal(r.effectiveN, 4);
  assert.equal(r.distribution.success, 1); // 4 个已兑现全 success
});
