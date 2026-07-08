/** node --experimental-strip-types --test src/core/courtos/ministries/red-blue-loop.nodetest.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRedBlueLoop } from './red-blue-loop.ts';

test('刑部遇股权合同 → RED + 人工确认', () => {
  const c = runRedBlueLoop({ taskId: 't', ministryId: 'justice', text: '签独家股权合同含预付款' });
  assert.equal(c.signal, 'RED');
  assert.equal(c.needsHumanConfirmation, true);
  assert.equal(c.verdict, 'RECHECK');
});

test('户部缺 ROI → YELLOW/GRAY + 补证', () => {
  const c = runRedBlueLoop({ taskId: 't', ministryId: 'finance', text: '推进储能项目', missingEvidence: ['报价'] });
  assert.ok(c.signal === 'YELLOW' || c.signal === 'GRAY');
  assert.ok(c.missingEvidence.length > 0);
  assert.equal(c.verdict, 'NEED_EVIDENCE');
});

test('工部缺 BOM → YELLOW', () => {
  const c = runRedBlueLoop({ taskId: 't', ministryId: 'works', text: '储能设备施工交付' });
  assert.equal(c.signal, 'YELLOW');
  assert.ok(c.missingEvidence.some((m) => m.includes('BOM')));
});

test('礼部遇保证收益 → RED', () => {
  const c = runRedBlueLoop({ taskId: 't', ministryId: 'ritual', text: '招商话术写保证收益稳赚' });
  assert.equal(c.signal, 'RED');
  assert.equal(c.needsHumanConfirmation, true);
});

test('吏部无 DRI → GRAY(信息不足/补证·非否决)', () => {
  // 修 RED-bias(decision-eval 抓出):缺 DRI 是"信息不足"非"红旗",否则总灯永远 RED、无判别力。
  const c = runRedBlueLoop({ taskId: 't', ministryId: 'personnel', text: '这事要推进' });
  assert.equal(c.signal, 'GRAY');
  assert.notEqual(c.signal, 'RED', '缺 DRI 不得误判为否决红旗');
  assert.ok(c.missingEvidence.some((m) => m.includes('DRI')));
});

test('每张卡都有 sourceLabel + 主手/副手内容', () => {
  const c = runRedBlueLoop({ taskId: 't', ministryId: 'finance', text: 'ROI 现金 预算 都齐' });
  assert.ok(c.sourceLabel);
  assert.ok(c.mainThesis.includes('主手'));
  assert.ok(c.deputyChallenge.includes('副手'));
  assert.ok(c.ruling.length > 0);
});
