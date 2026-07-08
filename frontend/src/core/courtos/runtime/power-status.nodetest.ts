import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPT_POWER_STATUS, powerSummary } from './power-status.ts';

test('真北极星:真在工作=live+local,待接=half+missing', () => {
  const s = powerSummary();
  assert.equal(s.total, 8);
  assert.equal(s.workingCount, s.liveCount + s.localCount);
  assert.equal(s.workingCount + s.blockedCount, s.total);
  assert.match(s.note, /真在工作.*待接后端/);
});
test('全部门真数据已在H盘(无缺数据)', () => {
  assert.ok(DEPT_POWER_STATUS.every((d) => d.hasRealData), '数据都在H盘,不该有hasRealData=false');
});
test('工部已端到端真通(LIVE·鉴权token已接)', () => {
  const gongbu = DEPT_POWER_STATUS.find((d) => d.code === 'gongbu');
  assert.equal(gongbu?.liveStatus, 'live');
  assert.equal(gongbu?.blocker, null);
  assert.equal(gongbu?.jiqunFlow, 'flow_pack_rd');
});
test('至少一个部门端到端LIVE(工部真通电)', () => {
  assert.ok(powerSummary().liveCount >= 1, '工部接鉴权后应有≥1端到端LIVE');
});
