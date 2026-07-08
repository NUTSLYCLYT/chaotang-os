import test from 'node:test';
import assert from 'node:assert/strict';

import { backtestDecisions, replayDecision, type PastDecision } from './decision-backtest.ts';

test('老板采纳了高危单(独家合同)→ 回测应列为"漏掉的风险"(核心卖点)', () => {
  const decisions: PastDecision[] = [
    { id: '1', command: '要不要签这个120万独家供货合同？客户要预付款、违约金条款。', action: 'adopt' },
  ];
  const r = backtestDecisions(decisions);
  assert.equal(r.replayed, 1);
  assert.equal(r.missedCount, 1, '采纳了独家+违约金合同,引擎必提示风险');
  assert.ok(r.missed[0].missedRisks.some((x) => /死法地图|人工确认|复核|刑部/.test(x)));
});

test('普通线索跟进被采纳 → 引擎也不提示 → 不算漏(不制造假风险)', () => {
  const r = backtestDecisions([{ id: '2', command: '要不要继续跟这个展会拿到的线索？', action: 'adopt' }]);
  assert.equal(r.missedCount, 0, '低风险线索不该被报成漏风险');
});

test('老板驳回了高危单 → 不算漏(他已经拦了,引擎提示风险也不算他漏)', () => {
  const r = backtestDecisions([{ id: '3', command: '要不要签独家代理合同含违约金？', action: 'reject' }]);
  assert.equal(r.missedCount, 0, '驳回=老板已拦,不算漏');
});

test('无问题文本/过短 → 不回放(诚实,不硬编)', () => {
  const r = backtestDecisions([{ id: '4', command: '', action: 'adopt' }, { id: '5', command: 'ok', action: 'adopt' }]);
  assert.equal(r.replayed, 0);
  assert.equal(r.missedCount, 0);
});

test('replayDecision：独家合同必触死法地图否决', () => {
  const { risks } = replayDecision('签独家供货合同含违约金');
  assert.ok(risks.some((x) => x.includes('死法地图')), '独家+违约金应触死法地图');
});
