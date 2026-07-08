import assert from 'node:assert/strict';
import test from 'node:test';

import { synthesizeDealVerdict } from './deal-verdict.ts';

/**
 * 兵部跨部裁决合成回归（2026-07-01）。会咬：删刑部合规拼接 → 高风险账期不进裁决用例红。
 */

test('成本+条款 → 三档报价 + 刑部拦 + 一句裁决', () => {
  const v = synthesizeDealVerdict({
    opportunityName: '天伟-引瞄控制器电池',
    customer: '西安天伟电子',
    cost: 1234,
    paymentTerms: '合同生效后10天内30%预付款，发货前40%，余款收到货物后的6个月',
  });
  assert.equal(v.quotes.length, 3);
  assert.equal(v.quotes.find((q) => q.tier === '标准')?.sell, 1763);
  assert.equal(v.compliance.verdict, 'flag', '6个月账期应被刑部 flag');
  assert.ok(v.recommendation.includes('标准'));
  assert.ok(v.recommendation.includes('锁违约金') || v.recommendation.includes('缩账期'));
  assert.equal(v.writeBack.chaotang_quote_std, 1763);
});

test('成本缺 → 不编报价，诚实', () => {
  const v = synthesizeDealVerdict({ opportunityName: 'x', customer: 'y', cost: null });
  assert.equal(v.quotes.length, 0);
  assert.equal(v.recommendedTier, null);
  assert.ok(v.recommendation.includes('成本未核定'));
});

test('无条款 → 合规默认 ok，不误报', () => {
  const v = synthesizeDealVerdict({ opportunityName: 'x', customer: 'y', cost: 1000 });
  assert.equal(v.compliance.verdict, 'ok');
});

test('写回带 source 标记（幂等/审计）', () => {
  const v = synthesizeDealVerdict({ opportunityName: 'x', customer: 'y', cost: 1000 });
  assert.equal(v.writeBack.chaotang_source, '朝堂·御前裁决');
});
