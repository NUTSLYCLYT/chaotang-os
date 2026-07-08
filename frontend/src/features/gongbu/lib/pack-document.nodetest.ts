import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packToDocument } from './pack-document.ts';

const META = { docNo: '工字〔2026〕第042号', date: '2026-06-29', handler: '研发司·李工' };

test('LIVE派发→已派发真蜂群+sizing待回填(诚实不编)', () => {
  const d = packToDocument({
    requirement: '60V32Ah三轮电池包·低温-20℃', sourceLabel: 'LIVE_SWARM', traceId: '20260629_x',
    selectedCells: [{ model: 'LFP-32Ah', spec: '磷酸铁锂 32Ah' }], resultFilled: false,
  }, META);
  assert.equal(d.deptName, '工部');
  assert.equal(d.deptKind, '研发专用章');
  assert.match(d.title, /PACK 技术方案/);
  assert.match(d.bluf, /已派发后端 jiqun pack_rd 蜂群|LIVE_SWARM/);
  assert.match(d.bluf, /待回填|禁对外报价/);
  // 派发标真,真实sizing标缺
  assert.ok(d.evidence!.some((e) => e.source === 'real' && /已派发/.test(e.text)));
  assert.ok(d.evidence!.some((e) => e.source === 'missing' && /sizing|成本拆分/.test(e.text)));
});

test('FALLBACK→不替后端编sizing(铁律9诚实)', () => {
  const d = packToDocument({ requirement: 'X方案', sourceLabel: 'FALLBACK' }, META);
  assert.match(d.bluf, /未达真蜂群|不替后端编|重派/);
  assert.ok(d.evidence!.some((e) => e.source === 'missing'));
});

test('已回填→真实sizing标真', () => {
  const d = packToDocument({ requirement: 'Y方案', sourceLabel: 'LIVE_SWARM', resultFilled: true }, META);
  assert.ok(d.evidence!.some((e) => e.source === 'real' && /sizing|成本拆分/.test(e.text)));
});

test('产线锁+禁对外报价进风险(铁律9)', () => {
  const d = packToDocument({ requirement: 'Z', sourceLabel: 'LIVE_SWARM', productionLocks: ['军工保密'] }, META);
  assert.ok(d.risks!.some((r) => /禁.*对外承诺.*报价|铁律9/.test(r)));
  assert.ok(d.risks!.some((r) => /产线锁：军工保密/.test(r)));
});
