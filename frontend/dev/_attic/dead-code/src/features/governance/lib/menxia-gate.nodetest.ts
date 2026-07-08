/**
 * 门下封驳闸回归断言(铁律4:把"门下不该长出笔和秤"钉成测试)。跑: pnpm test:node
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { menxiaGate, type MenxiaInput, type MenxiaRuling } from './menxia-gate.ts';

function baseInput(overrides: Partial<MenxiaInput> = {}): MenxiaInput {
  return {
    ancestralViolations: [],
    touchesProductionAsset: false,
    irreversible: false,
    blastRadius: 'L0',
    humanSignoffPresent: false,
    criticalEvidenceGaps: [],
    ...overrides,
  };
}

// ── 制衡内核:违祖训不可绕过 ──
test('门下:违祖训硬约束→必 veto,不可绕过', () => {
  const r = menxiaGate(baseInput({ ancestralViolations: ['不得对外承诺独家'] }));
  assert.equal(r.verdict, 'veto');
});

test('门下:违祖训即使人工已签也 veto(祖训高于一切)', () => {
  const r = menxiaGate(baseInput({ ancestralViolations: ['违宪条款'], humanSignoffPresent: true }));
  assert.equal(r.verdict, 'veto');
});

// ── 高风险强制人工门 ──
test('门下:触产线资产且无人工签→veto强制人工门', () => {
  const r = menxiaGate(baseInput({ touchesProductionAsset: true }));
  assert.equal(r.verdict, 'veto');
  assert.ok(r.reason.includes('人工'));
});

test('门下:不可逆/L4 无签→veto', () => {
  assert.equal(menxiaGate(baseInput({ irreversible: true })).verdict, 'veto');
  assert.equal(menxiaGate(baseInput({ blastRadius: 'L4' })).verdict, 'veto');
});

test('门下:高风险但人工已签→不因高风险 veto(放行或按缺证)', () => {
  const r = menxiaGate(baseInput({ touchesProductionAsset: true, humanSignoffPresent: true }));
  assert.notEqual(r.verdict, 'veto');
});

// ── 缺证退回 ──
test('门下:仅缺证→reback 退回补证', () => {
  const r = menxiaGate(baseInput({ criticalEvidenceGaps: ['缺合同正本'] }));
  assert.equal(r.verdict, 'reback');
});

test('门下:无违祖训/无未签高危/证齐→pass', () => {
  assert.equal(menxiaGate(baseInput()).verdict, 'pass');
});

// ── type 层红线:门下是一枚印,不是笔也不是秤 ──
test('门下输出不含 score / draft 字段(禁退化成打分/拟稿)', () => {
  const r: MenxiaRuling = menxiaGate(baseInput());
  const keys = Object.keys(r).sort();
  assert.deepEqual(keys, ['reason', 'verdict'], '门下只能产 verdict+reason');
  assert.ok(!('score' in r), '门下禁返回 score(那是军机处的秤)');
  assert.ok(!('draft' in r), '门下禁返回 draft(那是丞相的笔)');
});
