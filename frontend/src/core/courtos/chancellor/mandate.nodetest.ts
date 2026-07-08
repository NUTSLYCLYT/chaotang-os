/**
 * 丞相核心原语回归断言(铁律4:把"不该发生的事"钉成测试)。
 * 跑: pnpm test:node
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  classifyChancellorAction,
  validateMandate,
  applyRecusal,
  CHANCELLOR_RISK_VOTE_WEIGHT,
  type ChancellorMandate,
} from './mandate.ts';

function completeMandate(overrides: Partial<ChancellorMandate> = {}): ChancellorMandate {
  return {
    question: '是否对 X 客户启用新报价策略?',
    draft: '建议:小步灰度,先内部可逆试点',
    steelmanAgainst: '反方:样本太小,可能把一次侥幸当模式',
    recusal: applyRecusal(false),
    forecast: {
      expectedResult: '试点 2 周内转化不降',
      byDate: '2026-07-09',
      falsifyingMetric: '转化率周环比 < -5%',
      doNothingBaseline: '不做=维持现状,转化平',
    },
    source: 'real',
    ...overrides,
  };
}

// ── 笔/手 自治闸 ──
test('笔/手闸:纯认知动作=consult,无需旨', () => {
  const c = classifyChancellorAction('preview_draft');
  assert.equal(c.mode, 'consult');
  assert.equal(c.requiresDecree, false);
  assert.equal(c.requiresManualGate, false);
});

test('笔/手闸:碰产线/派遣=execute,必有旨+人工门', () => {
  for (const k of ['dispatch', 'jiqun_production', 'submit_production_asset', 'irreversible']) {
    const c = classifyChancellorAction(k);
    assert.equal(c.mode, 'execute', `${k} 应为 execute`);
    assert.equal(c.requiresDecree, true, `${k} 应要旨`);
    assert.equal(c.requiresManualGate, true, `${k} 应过人工门`);
  }
});

test('笔/手闸:未登记动作 fail-safe 归 execute(宁可错判为要旨)', () => {
  const c = classifyChancellorAction('some_unknown_action');
  assert.equal(c.mode, 'execute');
  assert.equal(c.requiresDecree, true);
});

// ── 拟旨三必填 ──
test('三必填:完整拟旨通过校验', () => {
  assert.equal(validateMandate(completeMandate()).valid, true);
});

test('三必填:缺自我反驳位(steelman)即被拒', () => {
  const v = validateMandate(completeMandate({ steelmanAgainst: '  ' }));
  assert.equal(v.valid, false);
  assert.ok(v.missing.some((m) => m.includes('steelman')));
});

test('三必填:缺期望结果回测账字段即被拒', () => {
  const m = completeMandate();
  const v = validateMandate({ ...m, forecast: { ...m.forecast, falsifyingMetric: '' } });
  assert.equal(v.valid, false);
  assert.ok(v.missing.some((x) => x.includes('falsifyingMetric')));
});

// ── 涉徒回避 ──
test('涉徒回避:涉太子案丞相 weight=0 且 role=recused', () => {
  const r = applyRecusal(true);
  assert.equal(r.weight, 0);
  assert.equal(r.role, 'recused');
});

test('涉徒回避:涉太子但未 recused 的拟旨非法(不得自审徒弟)', () => {
  const m = completeMandate({
    recusal: { involvesProtegeTaizi: true, weight: 0, role: 'chair', reason: 'x' },
  });
  const v = validateMandate(m);
  assert.equal(v.valid, false);
  assert.ok(v.missing.some((x) => x.includes('recused')));
});

// ── 零票 ──
test('丞相恒零票:CHANCELLOR_RISK_VOTE_WEIGHT===0(举证非裁判)', () => {
  assert.equal(CHANCELLOR_RISK_VOTE_WEIGHT, 0);
  assert.equal(applyRecusal(false).weight, 0);
});
