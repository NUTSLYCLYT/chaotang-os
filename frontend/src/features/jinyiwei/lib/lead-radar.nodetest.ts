import assert from 'node:assert/strict';
import test from 'node:test';

import { runLeadRadar, gradeLeadCredibility, leadToBingbu, type Lead } from './lead-radar.ts';
import { runTenderRadar, tenderToLead, type Tender } from './tender-radar.ts';

/**
 * 锦衣卫统一线索中台回归（2026-07-01）。会咬：删挡脏/删军品海外门 → 脏情报/违法线索混进合格。
 */
const CRITERIA = {
  keywords: ['锂电池', '电池组', '特种电源'],
  excludeKeywords: ['框架', 'GWh', '集采'],
  maxAmount: 5_000_000,
};

const LEADS: Lead[] = [
  { id: '1', title: '某所特种锂电池组采购', party: '西安某研究所', amount: 3_000_000, category: '军工', channel: 'tender', sourceUrl: 'https://plap.mil.cn/x', sourceName: '军队采购网' },
  { id: '2', title: '国家电投12GWh储能电芯框架集采', party: '国家电投', amount: 900_000_000, category: '储能', channel: 'tender', sourceUrl: 'https://x', sourceName: '必联网' },
  { id: '3', title: '锂电池组采购', party: '', amount: 2_000_000, category: '工业', channel: 'b2b_platform', sourceUrl: '', sourceName: '' },
  { id: '4', title: '海外军品电池组询盘', party: 'Foreign Mil Co', amount: 2_000_000, category: '军工', channel: 'overseas', sourceUrl: 'https://alibaba.com/x', sourceName: 'alibaba.com', overseas: true, militaryRestricted: true },
  { id: '5', title: '某所特种锂电池组采购', party: '西安某研究所', amount: 3_000_000, category: '军工', channel: 'tender', sourceUrl: 'https://plap.mil.cn/x', sourceName: '军队采购网' }, // 去重
];

test('中台一轮：留#1，挡超额#2/脏#3/军品海外#4/去重#5', () => {
  const r = runLeadRadar(LEADS, CRITERIA);
  assert.equal(r.qualified.length, 1);
  assert.equal(r.qualified[0].party, '西安某研究所');
  assert.equal(r.qualified[0].credibility, 'verified');
  assert.ok(r.summary.dirty >= 1);
  assert.equal(r.summary.complianceBlocked, 1, '军品海外必须被合规门拦');
});

test('军品出海 → 合规门拦(刑部红线)', () => {
  const r = runLeadRadar([LEADS[3]], CRITERIA);
  assert.equal(r.qualified.length, 0);
  assert.ok(r.rejected[0].reason.includes('军品出口'));
});

test('脏情报(无来源/无采购方)→ low', () => {
  assert.equal(gradeLeadCredibility({ id: 'x', title: 't', party: '', amount: 1, category: '', channel: 'inbound', sourceUrl: '', sourceName: '' }), 'low');
});

test('合格 → 兵部线索(带渠道+可信度)', () => {
  const lead = leadToBingbu(runLeadRadar(LEADS, CRITERIA).qualified[0]);
  assert.equal(lead.stage, '新线索');
  assert.equal(lead.channel, 'tender');
  assert.equal(lead.credibility, 'verified');
});

test('招标渠道映射：runTenderRadar 委托中台，行为一致', () => {
  const tenders: Tender[] = [{ id: '1', title: '特种锂电池组', buyer: '某所', amount: 3_000_000, category: '军工', sourceUrl: 'https://plap.mil.cn/x', sourceName: '军队采购网' }];
  const r = runTenderRadar(tenders, CRITERIA);
  assert.equal(r.qualified.length, 1);
  assert.equal(tenderToLead(tenders[0]).channel, 'tender');
});
