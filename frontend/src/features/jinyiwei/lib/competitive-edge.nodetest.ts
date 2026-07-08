import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marginHealth, competitiveEdge } from './competitive-edge.ts';
test('毛利健康灯:40%🟢/20%🟡/10%🔴', () => {
  assert.equal(marginHealth(40).light, 'good');
  assert.equal(marginHealth(20).light, 'mid');
  assert.equal(marginHealth(10).light, 'bad');
  assert.equal(marginHealth(null).light, 'unknown');
});
test('竞争优势:无外部价→⚪缺基准(不编竞品价)', () => {
  const r = competitiveEdge('sell', 2500, null);
  assert.equal(r.light, 'unknown');
  assert.match(r.note, /不编竞品价|待核实/);
});
test('采购侧:买得便宜→🟢优势', () => {
  assert.equal(competitiveEdge('buy', 1400, 1600).light, 'good');
  assert.equal(competitiveEdge('buy', 1800, 1600).light, 'bad');
});
test('销售侧:卖价不高于市场→🟢有竞争力', () => {
  assert.equal(competitiveEdge('sell', 2400, 2500).light, 'good');
  assert.equal(competitiveEdge('sell', 3000, 2500).light, 'bad');
});
