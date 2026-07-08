import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFeasibilityEnvelope,
  stripProductionFields,
  isProductionAssetField,
} from './gongbu-feasibility-envelope.ts';

test('诚实闸: 验真未过 → FALLBACK,绝不冒充 LIVE_SWARM', () => {
  const notVerified = buildFeasibilityEnvelope({
    jiqunOk: true,
    sessionId: '20260622_120000_abc',
    reverify: { verified: false, reason: 'trace 不可兑现' },
  });
  assert.equal(notVerified.sourceLabel, 'FALLBACK');

  const noSession = buildFeasibilityEnvelope({ jiqunOk: false, sessionId: null, reverify: null });
  assert.equal(noSession.sourceLabel, 'FALLBACK');
  assert.equal(noSession.confidence, 0);

  const verified = buildFeasibilityEnvelope({
    jiqunOk: true,
    sessionId: '20260622_120000_abc',
    reverify: { verified: true, reason: 'session 可兑现' },
  });
  assert.equal(verified.sourceLabel, 'LIVE_SWARM');
});

test('出参剥离命门(§13.2#9): 产线资产字段整体上锁,内容绝不进 consult', () => {
  const finalOutput = {
    需求规格: '12V 1100Wh，-30℃ ≥80%，循环≥2000',
    BMS选型方案: 'JDBMS-4S60A-HC，60A>56A需求',
    PACK工艺方案: '铝壳+气凝胶保温，低温加热膜',
    售前成本核算: '整包BOM成本2025元，电芯报价待核', // 产线资产:含报价/成本
    供应链可行性评估: '供应商力通新能源，交期15天', // 产线资产:含供应商/交期
  };
  const { consult, lockedProductionFields } = stripProductionFields(finalOutput);

  // 产线资产字段被锁(只露名字)
  assert.ok(lockedProductionFields.includes('售前成本核算'));
  assert.ok(lockedProductionFields.includes('供应链可行性评估'));
  // 锁字段内容绝不进 consult —— 老板拿不到一个可"采纳"的报价/供应商/交期
  assert.equal(consult['售前成本核算'], undefined);
  assert.equal(consult['供应链可行性评估'], undefined);
  const allConsultText = Object.values(consult).join(' ');
  assert.doesNotMatch(allConsultText, /2025元|力通新能源|交期15天/, '产线数字/供应商不得泄漏进咨询面');

  // 定性可行性字段放行(老板能看"能不能造")
  assert.ok('需求规格' in consult);
  assert.ok('BMS选型方案' in consult);
  assert.ok('PACK工艺方案' in consult);
});

test('剥离识别: 含成本/报价/BOM/供应链/供应商/毛利/交期/价格/采购 标记 → 产线资产', () => {
  for (const f of ['售前成本核算', 'BOM成本', '供应链可行性评估', '供应商清单', '毛利率分析', '交期承诺', '报价单']) {
    assert.equal(isProductionAssetField(f), true, `${f} 应判为产线资产`);
  }
  for (const f of ['BMS选型方案', '需求规格', '通信协议适配方案', '结构热设计方案', 'PACK工艺方案']) {
    assert.equal(isProductionAssetField(f), false, `${f} 是定性咨询字段,不该被锁`);
  }
});
