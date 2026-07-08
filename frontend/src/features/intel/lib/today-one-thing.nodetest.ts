import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTodayOneThing, computeLead, quadrant, pickHeadline } from './today-one-thing.ts';
import type { IntelSignal } from '../../../lib/contracts/intel.ts';

const NOW = Date.parse('2026-07-05T08:00:00Z');

function signal(over: Partial<IntelSignal>): IntelSignal {
  return {
    id: 'x',
    category: 'risk',
    level: 'warning',
    title: 't',
    summary: 's',
    region: 'CN',
    regionLabel: '中国',
    industry: '电池',
    credibility: 'verified',
    sources: [],
    firstSeenAt: '2026-07-02T18:40:00Z',
    lastUpdatedAt: '2026-07-05T07:00:00Z',
    ...over,
  };
}

// —— 铁律4 回归断言：没有仙狐双时间戳，绝不臆造领先度数字 ——
test('无 leadTime → 不当选头条（禁臆造数字）', () => {
  const all = [signal({ id: 'a', leadTime: undefined }), signal({ id: 'b', leadTime: undefined })];
  assert.equal(pickTodayOneThing(all, NOW), null);
});

test('无 edgeFirstSeenAt → computeLead 不可算 = null', () => {
  assert.equal(computeLead(signal({ leadTime: undefined }), NOW), null);
});

// —— Taleb 守卫：早但没核实（trap），绝不当「今日一件事」 ——
test('有领先但低可信（抢跑陷阱）→ 不当选', () => {
  const trap = signal({ id: 'trap', credibility: 'low', leadTime: { edgeFirstSeenAt: '2026-07-02T18:40:00Z' } });
  assert.equal(quadrant(trap), 'trap');
  assert.equal(pickTodayOneThing([trap], NOW), null);
});

// —— 又早又真（gold）才当选 ——
test('gold 象限（又早又真）→ 当选，且高分优先', () => {
  const good = signal({ id: 'good', level: 'warning', credibility: 'verified', leadTime: { edgeFirstSeenAt: '2026-07-02T18:40:00Z' } });
  const hotter = signal({ id: 'hotter', level: 'critical', credibility: 'verified', leadTime: { edgeFirstSeenAt: '2026-07-03T00:00:00Z' } });
  assert.equal(quadrant(good), 'gold');
  assert.equal(pickTodayOneThing([good, hotter], NOW)?.id, 'hotter');
});

// —— 领先小时计算 ——
test('主流未命中 → 至今仍领先（now − 边缘首见），stillLeading=true', () => {
  const r = computeLead(signal({ leadTime: { edgeFirstSeenAt: '2026-07-03T18:00:00Z' } }), NOW);
  assert.equal(r?.stillLeading, true);
  assert.equal(r?.leadHours, 38); // 07-03 18:00 → 07-05 08:00 = 38h
});

test('主流已命中 → 领先=命中−边缘首见，stillLeading=false', () => {
  const r = computeLead(
    signal({ leadTime: { edgeFirstSeenAt: '2026-07-02T00:00:00Z', mainstreamHitAt: '2026-07-03T12:00:00Z' } }),
    NOW,
  );
  assert.equal(r?.stillLeading, false);
  assert.equal(r?.leadHours, 36);
});

test('命中早于首见（脏数据）→ null，不给负数领先', () => {
  const r = computeLead(
    signal({ leadTime: { edgeFirstSeenAt: '2026-07-03T00:00:00Z', mainstreamHitAt: '2026-07-02T00:00:00Z' } }),
    NOW,
  );
  assert.equal(r, null);
});

// —— Rams：仪式重量 = 数据重量。无领先度真数据，卷轴绝不摆「八百里加急+数字」 ——
test('pickHeadline 无 leadTime → brief（今日要情），lead=null，绝不 urgent', () => {
  const all = [signal({ id: 'a', credibility: 'high', leadTime: undefined }), signal({ id: 'b', credibility: 'verified', leadTime: undefined })];
  const h = pickHeadline(all, NOW);
  assert.equal(h?.ceremony, 'brief');
  assert.equal(h?.lead, null); // 领先度整行隐藏，不显数字
});

test('pickHeadline 有 gold（又早又真）→ urgent（八百里加急）+ lead 有值', () => {
  const gold = signal({ id: 'g', level: 'critical', credibility: 'verified', leadTime: { edgeFirstSeenAt: '2026-07-03T18:00:00Z' } });
  const h = pickHeadline([gold, signal({ id: 'x', leadTime: undefined })], NOW);
  assert.equal(h?.ceremony, 'urgent');
  assert.equal(h?.signal.id, 'g');
  assert.ok(h?.lead && h.lead.leadHours > 0);
});

test('pickHeadline 全空 → null（卷轴空态，不硬凑）', () => {
  assert.equal(pickHeadline([], NOW), null);
});

test('pickHeadline brief 取可信×级别最高一条', () => {
  const weak = signal({ id: 'weak', level: 'info', credibility: 'medium', leadTime: undefined });
  const strong = signal({ id: 'strong', level: 'critical', credibility: 'verified', leadTime: undefined });
  assert.equal(pickHeadline([weak, strong], NOW)?.signal.id, 'strong');
});
