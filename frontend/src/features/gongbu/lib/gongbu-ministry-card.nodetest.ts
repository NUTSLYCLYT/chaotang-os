import { test } from 'node:test';
import assert from 'node:assert/strict';

import { caseToGongbuTask, gongbuEngineCard } from './gongbu-ministry-card.ts';
import { evaluateTask } from './gongbu-engines.ts';

/**
 * 断点B 守门断言（工部）：军机处工部会审卡 = 真工部引擎，先会说"不知道"再说"能造"。
 */

test('不臆造(Deming)：新PACK案问"能不能造"、无工程参数 → 工部绝不 GREEN', () => {
  const card = gongbuEngineCard('t1', '低温电池PACK项目 要不要接 能不能造');
  assert.notEqual(card.signal, 'GREEN', `未交付的新案不得拍能造(GREEN)，实际 ${card.signal}`);
  // 工部前端永不判真可行性 —— 缺证必含"真实可行性(需后端)"
  assert.ok(
    card.missingEvidence.some((m: string) => m.includes('真实可行性')),
    '工部缺证必须显性含"真实可行性(需后端)"',
  );
});

test('触产线资产 → GRAY(转后端·前端不判)，且列出上锁字段', () => {
  const card = gongbuEngineCard('t2', '算一下这个PACK的BOM成本和交期，能不能压到目标价');
  assert.equal(card.signal, 'GRAY', `触产线(成本/BOM/交期)应转后端 GRAY，实际 ${card.signal}`);
  assert.ok(card.missingEvidence.some((m: string) => m.includes('产线') || m.includes('后端')));
});

test('本部不适用→弃权(GRAY)：纯营销/HR 案，工部不得伪造"削MVP"越权黄卡(大神会审Deming)', () => {
  for (const q of ['给老客户发个促销邮件，预算3万', '这个月招两个销售，薪资怎么定', '双十一大促投放策略']) {
    const card = gongbuEngineCard('t4', q);
    assert.equal(card.signal, 'GRAY', `off-domain 应弃权 GRAY，实际 ${card.signal}（q=${q}）`);
    assert.match(card.ruling, /弃权/);
    assert.notEqual(card.signal, 'YELLOW', 'off-domain 绝不落"削MVP"越权黄');
  }
});

test('两入口一脑：工部卡的裁决 === 工部页对同一案 evaluateTask 的裁决', () => {
  for (const q of ['低温电池PACK能不能造', '算PACK的BOM成本和交期', '对客户承诺30天交期靠谱吗']) {
    const engineVerdict = evaluateTask(caseToGongbuTask('t3', q)).verdict;
    const card = gongbuEngineCard('t3', q);
    const expect =
      engineVerdict === 'approve'
        ? 'GREEN'
        : engineVerdict === 'reject'
          ? 'RED'
          : engineVerdict === 'review'
            ? 'GRAY'
            : 'YELLOW';
    assert.equal(card.signal, expect, `裁决 ${engineVerdict} 应映射 ${expect}，实际 ${card.signal}（q=${q}）`);
  }
});
