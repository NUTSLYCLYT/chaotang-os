import test from 'node:test';
import assert from 'node:assert/strict';

import { isMinistryLive, MINISTRY_TO_DEPT_CODE } from './department-vitrine.ts';

// 铁律4 回归：真徽 ⟺ v1 注册且上架了办公厅。2026-07 礼部暂不定，预期同步为 5。
test('v1 已上架五部亮真徽，礼部暂不定不亮真徽', () => {
  assert.equal(isMinistryLive('hubu'), true, '户部已注册办公厅');
  assert.equal(isMinistryLive('bingbu'), true, '兵部已注册办公厅');
  assert.equal(isMinistryLive('gongbu'), true, '工部已注册办公厅');
  assert.equal(isMinistryLive('libu'), true, '吏部已注册办公厅');
  assert.equal(isMinistryLive('libu2'), false, '礼部 1.0 暂不定，不上架办公厅');
  assert.equal(isMinistryLive('xingbu'), true, '刑部已注册办公厅');
});

test('未知 key 不得亮真徽（诚实兜底）', () => {
  assert.equal(isMinistryLive('not-a-ministry'), false);
  assert.equal(isMinistryLive(''), false);
});

test('v1 恰好 5 个真部门（礼部暂不定）', () => {
  const liveCount = Object.keys(MINISTRY_TO_DEPT_CODE).filter(isMinistryLive).length;
  assert.equal(liveCount, 5, 'v1 真部门应恰好 5 个；礼部暂不定，变了需同步预期');
});
