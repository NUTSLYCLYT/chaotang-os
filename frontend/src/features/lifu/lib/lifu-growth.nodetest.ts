import { test } from 'node:test';
import assert from 'node:assert/strict';

import { channelROI, rankChannels } from './lifu-growth.ts';

test('CAC/ROAS/ROI 计算', () => {
  const r = channelROI({ channel: '公众号', spend: 10000, conversions: 50, revenue: 30000, clicks: 5000 });
  assert.equal(r.cac, 200); // 10000/50
  assert.equal(r.roas, 3); // 30000/10000
  assert.equal(r.roi, 2); // (30000-10000)/10000
  assert.equal(r.conversionRate, 0.01);
  assert.equal(r.verdict, 'scale'); // roas>=2
});

test('薄数据不下定论(转化<10 → keep 观察,不砍不重投)', () => {
  const r = channelROI({ channel: '新渠道', spend: 5000, conversions: 3, revenue: 20000 });
  assert.equal(r.thin, true);
  assert.equal(r.verdict, 'keep'); // 即便 ROAS 高也先观察
  assert.match(r.reason, /样本薄|观察/);
});

test('亏损渠道判砍', () => {
  const r = channelROI({ channel: 'SEM', spend: 20000, conversions: 40, revenue: 10000 });
  assert.equal(r.verdict, 'cut');
  assert.ok((r.roas ?? 9) < 1);
});

test('缺营收 → insufficient,不编 ROI', () => {
  const r = channelROI({ channel: '抖音', spend: 8000, conversions: 20 });
  assert.equal(r.roas, null);
  assert.equal(r.roi, null);
  assert.equal(r.verdict, 'insufficient');
});

test('排序 + 预算搬家建议(看真数据投)', () => {
  const d = rankChannels([
    { channel: '公众号', spend: 10000, conversions: 50, revenue: 30000 },
    { channel: 'SEM', spend: 20000, conversions: 40, revenue: 10000 },
  ]);
  assert.equal(d.ranked[0].channel, '公众号'); // ROAS 高排前
  assert.match(d.recommendation, /公众号/);
  assert.match(d.recommendation, /SEM/);
  assert.match(d.recommendation, /搬|加投|砍/);
});
