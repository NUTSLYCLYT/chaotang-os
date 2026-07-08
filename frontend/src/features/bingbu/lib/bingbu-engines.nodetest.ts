import test from 'node:test';
import assert from 'node:assert/strict';

import type { BingbuSalesItem, SalesRiskLevel } from '../../../lib/contracts/bingbu-sales.ts';
import { evaluateSalesItem } from './bingbu-engines.ts';

function item(over: Partial<BingbuSalesItem>): BingbuSalesItem {
  return {
    id: 't', title: 't', command: '', status: 'pending_review', priority: 'P1',
    counterparty: '—', stage: '—', amount: '—', risk_level: 'medium' as SalesRiskLevel,
    recommendation: '', terms: [], industry: '—', delivery: '—', prepayment: '—',
    asked_count: 1, created_at: '', updated_at: '', ...over,
  };
}

test('正式报价问题 → 识别为报价策略 + 需户部/刑部跨审（不静默放行）', () => {
  const ev = evaluateSalesItem(item({ command: '给客户甲发正式报价，八折，付款条件 90 天，要不要签？' }));
  assert.equal(ev.questionType, 'QUOTE_STRATEGY');
  assert.ok(ev.crossReviews.includes('户部'), '报价需户部复核');
  assert.ok(ev.crossReviews.includes('刑部'), '报价/付款需刑部复核');
});

test('高风险销售动作（合同/独家）→ 升维复核 + 须人工确认 + 红灯', () => {
  const ev = evaluateSalesItem(item({ command: '客户要求签独家代理合同，含违约金条款，是否承诺？' }));
  assert.equal(ev.position, '复核');
  assert.equal(ev.humanConfirmationRequired, true);
  assert.equal(ev.signal, 'RED');
});

test('每张卡必有唯一下一步（onePrimarySalesAction，不留空）', () => {
  const ev = evaluateSalesItem(item({ command: '展会拿到一条线索，要不要继续跟？' }));
  assert.ok(ev.nextAction.length > 0, '必须输出唯一销售下一步');
});

test('讲解四段齐全且 grounded 在该卡判断上（不编）', () => {
  const ev = evaluateSalesItem(item({ command: '客户压价要谈判，竞品报价更低，怎么回复？' }));
  for (const key of ['type', 'position', 'cross', 'gate'] as const) {
    assert.ok(ev.explain[key].length > 0, `讲解缺 ${key}`);
  }
  // 谈判+竞品 → 应识别为谈判策略
  assert.equal(ev.questionType, 'NEGOTIATION_STRATEGY');
});
