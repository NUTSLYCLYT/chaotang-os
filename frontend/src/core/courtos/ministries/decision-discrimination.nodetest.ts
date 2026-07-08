/** node --test —— 决策信号判别力回归(2026-06-24 · 锁 Deming 闭环成果,防退回"总灯永远红")。
 *
 * 用确定性 heuristic 路径(runMinistryReview,无 LLM·快·稳)钉死判别力:
 *   - 真高危(独家/预付款/合同) → 总灯 RED + 人工确认。
 *   - benign 小额预算 → **不得 RED**(decision-eval 抓出的 RED-bias,修后锁死防回退)。
 *   - 信息不足模糊题 → **不得 RED**(GRAY/YELLOW 级)。
 * 真 agent(LLM)质量另由 scripts/decision-eval.mjs 测(慢·有方差,不进阻断门)。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMinistryReview } from './ministry-review-loop.ts';

test('真高危(独家+预付款+合同) → 总灯 RED + 人工确认', () => {
  const r = runMinistryReview({
    taskId: 't1',
    originalQuestion: '签独家股权合作合同,含预付款50万与保证收益条款,要不要签?',
    sourceLabel: 'LIVE',
  });
  assert.equal(r.overallSignal, 'RED', '真红旗事项总灯应 RED');
  assert.equal(r.humanApprovalRequired, true, '不可逆/法律责任应触发人工确认门');
});

test('benign 小额预算(有ROI) → 不得 RED(锁 RED-bias 修复·防退回)', () => {
  const r = runMinistryReview({
    taskId: 't2',
    originalQuestion: '审批市场部建设预算8万,预期ROI 3倍,3个月回收,要不要批?',
    sourceLabel: 'LIVE',
  });
  assert.notEqual(r.overallSignal, 'RED', 'benign 小额预算不得被假否决为 RED(无判别力之源)');
});

test('信息不足模糊题 → 不得 RED(缺证是 GRAY/补证,非否决)', () => {
  const r = runMinistryReview({
    taskId: 't3',
    originalQuestion: '我们要不要做这个项目?',
    sourceLabel: 'LIVE',
  });
  assert.notEqual(r.overallSignal, 'RED', '信息不足应走补证(GRAY/YELLOW),不得误判 RED');
});
