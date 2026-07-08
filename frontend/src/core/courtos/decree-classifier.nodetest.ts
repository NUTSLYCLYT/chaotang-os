import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDecree } from './decree-classifier.ts';
test('开创动词→立项', () => {
  for (const c of ['做电动三轮电池包', '开拓华东市场', '研发新BMS']) {
    const r = classifyDecree(c); assert.equal(r.kind, 'initiate'); assert.equal(r.createsProject, true);
  }
});
test('处置动词→裁决,不生立项', () => {
  for (const c of ['准这笔款', '驳回这个报价', '回复这客户']) {
    const r = classifyDecree(c); assert.equal(r.kind, 'dispose'); assert.equal(r.createsProject, false);
  }
});
test('都命中→待澄清不瞎判', () => {
  assert.equal(classifyDecree('做个方案然后批了').kind, 'ambiguous');
});
test('无动词→待澄清', () => { assert.equal(classifyDecree('这个东西').kind, 'ambiguous'); });
