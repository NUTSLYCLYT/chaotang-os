import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decreeToProject } from './decree-to-project.ts';

test('开创下旨→是立项+抽字段', () => {
  const d = decreeToProject('做电动三轮电池包，预算8万');
  assert.equal(d.isProject, true);
  assert.notEqual(d.extracted, null);
  assert.match(d.feedback, /开创·立项/);
});
test('处置下旨→是裁决,不建新立项', () => {
  const d = decreeToProject('准这笔120万付款');
  assert.equal(d.isProject, false);
  assert.equal(d.extracted, null);
  assert.match(d.feedback, /处置·裁决|不建新立项/);
});
test('待澄清', () => {
  const d = decreeToProject('这个东西');
  assert.equal(d.isProject, false);
  assert.match(d.feedback, /待澄清|说清/);
});
