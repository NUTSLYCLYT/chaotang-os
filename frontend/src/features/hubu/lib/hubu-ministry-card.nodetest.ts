import { test } from 'node:test';
import assert from 'node:assert/strict';

import { caseToHubuProject, hubuEngineCard } from './hubu-ministry-card.ts';
import { evaluateProject } from './hubu-engines.ts';

/**
 * 断点B 守门断言（一案穿堂 Phase 0）：军机处户部会审卡 = 真户部引擎，且不臆造。
 */

test('不臆造(Deming)：问题里没有任何数字 → 户部卡必须缺证(GRAY)，绝不 GREEN/RED', () => {
  const card = hubuEngineCard('t1', '我们要不要接这个新客户的项目？');
  // 无预算/无ROI → 引擎落 hold、grounded=0 → 卡 GRAY(信息不足)
  assert.equal(card.signal, 'GRAY', `无数字应 GRAY，实际 ${card.signal}`);
  assert.notEqual(card.signal, 'GREEN');
  assert.notEqual(card.signal, 'RED');
  // 缺证必须显性列出预算与回报，不能因为"看起来能做"就放行
  assert.ok(card.missingEvidence.some((m: string) => m.includes('预算')), '应缺证:预算金额');
  assert.ok(card.missingEvidence.some((m: string) => m.includes('回报') || m.includes('ROI')), '应缺证:回报/ROI');
});

test('真算(grounded)：给了预算+回报 → 卡由 evaluateProject 直算、灯号随真裁决', () => {
  const q = '低温电池PACK项目，预算50万，预期回报3x，风险中等';
  const card = hubuEngineCard('t2', q);
  // 有据 → 不再是 GRAY 缺证
  assert.notEqual(card.signal, 'GRAY', '有预算+回报不应缺证');
  // mainPlan 里带真中文裁决词（准奏/削减/驳回/缓议之一），证明走了真引擎而非罐头
  assert.match(card.mainPlan, /准奏|削减|驳回|缓议/);
});

test('两入口一脑：户部卡的裁决 === 户部页对同一案 evaluateProject 的裁决', () => {
  for (const q of [
    '我们要不要接这个新客户的项目？',
    '低温电池PACK项目，预算50万，预期回报3x，风险中等',
    '预算200万，回报0.8x，含预付定金', // 单向门 + 回报<1 → reject
  ]) {
    const engineVerdict = evaluateProject(caseToHubuProject(q)).verdict;
    const card = hubuEngineCard('t3', q);
    // 卡的灯号必须由同一个引擎裁决派生：approve↔GREEN / adjust↔YELLOW / reject↔RED / hold↔YELLOW|GRAY
    const expect =
      engineVerdict === 'approve'
        ? 'GREEN'
        : engineVerdict === 'reject'
          ? 'RED'
          : engineVerdict === 'adjust'
            ? 'YELLOW'
            : ['YELLOW', 'GRAY'];
    if (Array.isArray(expect)) {
      assert.ok(expect.includes(card.signal), `hold 应 YELLOW/GRAY，实际 ${card.signal}（q=${q}）`);
    } else {
      assert.equal(card.signal, expect, `裁决 ${engineVerdict} 应映射 ${expect}，实际 ${card.signal}（q=${q}）`);
    }
  }
});
