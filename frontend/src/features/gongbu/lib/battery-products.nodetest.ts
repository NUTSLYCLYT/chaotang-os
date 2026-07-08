import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BATTERY_CELLS, PACK_SOLUTIONS, findCell, cellsByChemistry, lowTempLimit, selectCellsForTemp } from './battery-products.ts';

test('真数据底座:4 电芯 + PACK 方案,字段完整', () => {
  assert.equal(BATTERY_CELLS.length, 4);
  assert.ok(PACK_SOLUTIONS.length >= 2);
  for (const c of BATTERY_CELLS) {
    assert.ok(c.model && c.priceRange && c.tempRange);
  }
});

test('按型号/化学体系查', () => {
  assert.equal(findCell('LFP-40C-100Ah')?.capacity, '100Ah');
  assert.equal(findCell('不存在'), undefined);
  assert.equal(cellsByChemistry('磷酸铁锂电芯').length, 2);
});

test('温度下限解析', () => {
  assert.equal(lowTempLimit(findCell('LTO-50C-40Ah')!), -50);
  assert.equal(lowTempLimit(findCell('LFP-25C-280Ah')!), -25);
});

test('低温选型初筛:要求 -40°C → 只剩能扛 -40 及以下的,按能量密度降序', () => {
  const fit = selectCellsForTemp(-40);
  // LFP-40C(-40)/NCM-40C(-40)/LTO-50C(-50) 满足;LFP-25C(-25)不满足
  assert.ok(fit.every((c) => (lowTempLimit(c) ?? 99) <= -40));
  assert.ok(!fit.some((c) => c.model === 'LFP-25C-280Ah'));
  // 能量密度降序:NCM(230) 应在 LFP(160)、LTO(70) 之前
  assert.equal(fit[0].model, 'NCM-40C-50Ah');
});
