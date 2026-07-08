import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLane, classifyLenses, groupByLane, INDUSTRY_LANES } from './industry-classify.ts';
import type { IntelSignal } from '../../../lib/contracts/intel.ts';

function sig(title: string, summary = '', industry = '电池'): IntelSignal {
  return {
    id: title, category: 'neutral', level: 'info', title, summary, region: 'CN', regionLabel: '中国',
    industry, credibility: 'medium', sources: [], firstSeenAt: '2026-07-05T00:00:00Z', lastUpdatedAt: '2026-07-05T00:00:00Z',
  };
}

test('竞品名 → competitor 道', () => {
  assert.equal(classifyLane(sig('宁德时代麒麟电池良率爬坡')), 'competitor');
  assert.equal(classifyLane(sig('比亚迪刀片二代对外报价')), 'competitor');
});

test('原材料 → upstream 道', () => {
  assert.equal(classifyLane(sig('碳酸锂价格周环比下跌')), 'upstream');
});

test('法规 → policy 道', () => {
  assert.equal(classifyLane(sig('欧盟电池法碳足迹申报强制生效')), 'policy');
});

test('招标订单 → customer 道', () => {
  assert.equal(classifyLane(sig('某储能集采8GWh开标')), 'customer');
});

test('都不匹配 → other（诚实兜底，不硬塞）', () => {
  assert.equal(classifyLane(sig('今天天气不错')), 'other');
});

test('透镜可多标：碳酸锂涨价 → finance 标签', () => {
  const lenses = classifyLenses(sig('碳酸锂价格大涨，锂价创新高'));
  assert.ok(lenses.includes('finance'));
});

test('透镜：欧盟出口管制 → geopolitics 标签', () => {
  assert.ok(classifyLenses(sig('欧盟收紧出口管制与关税')).includes('geopolitics'));
});

test('透镜：AI 材料筛选 → ai 标签', () => {
  assert.ok(classifyLenses(sig('AI 材料筛选加速固态电池研发')).includes('ai'));
});

test('透镜：高管变动 → people 标签', () => {
  assert.ok(classifyLenses(sig('某车企电芯采购负责人离职换人')).includes('people'));
});

test('groupByLane 覆盖全部五道 + other，且不丢信号', () => {
  const signals = [sig('宁德扩线'), sig('碳酸锂'), sig('欧盟法规'), sig('招标集采'), sig('固态电池研发'), sig('无关内容')];
  const groups = groupByLane(signals);
  const total = [...groups.values()].reduce((n, arr) => n + arr.length, 0);
  assert.equal(total, signals.length); // 不丢
  assert.equal(groups.size, INDUSTRY_LANES.length + 1); // 五道 + other
  assert.equal(groups.get('competitor')!.length, 1);
  assert.equal(groups.get('other')!.length, 1);
});
