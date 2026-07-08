/**
 * CourtOS 黄金任务评测（EvalLoop）· 离线、确定性（走 mock 六部启发式）：
 *   pnpm eval:court
 * 防回归：以后任何改动若破坏这三条主线，eval 立刻红。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMinistryReview } from '../ministries/ministry-review-loop.ts';
import { runYushitaiAudit } from '../ministries/yushitai-auditor.ts';
import { synthesizeImperialReport } from '../ministries/imperial-report-synthesizer.ts';

function runCase(question: string, sourceLabel: 'LIVE' | 'FALLBACK' = 'LIVE') {
  const review = runMinistryReview({ taskId: 'eval', originalQuestion: question, sourceLabel });
  const audit = runYushitaiAudit({ review, draftVerdict: '补证', draftSourceLabel: sourceLabel });
  const report = synthesizeImperialReport({ review, audit });
  return { review, audit, report };
}

test('黄金1 · 储能项目：缺证 → 不准奏 + 有后令 + 来源', () => {
  const { review, report } = runCase('判断 100MWh 冷库储能项目是否推进,重点投入边界/现金/BOM/交付');
  assert.ok(review.selectedMinistries.includes('finance'));
  assert.ok(review.selectedMinistries.includes('works'));
  assert.ok(review.missingEvidence.length > 0, '应识别缺证');
  assert.notEqual(report.verdict, 'APPROVE', '缺证禁准奏');
  assert.ok(report.nextAction.length > 0, '必须有唯一后令');
  assert.ok(report.sourceLabel, 'source 必填');
});

test('黄金2 · AI公司合作(股权)：刑部红灯 → 复核 + 人工确认 + 御史台阻断准奏', () => {
  const { audit, report, review } = runCase('厦门 AI 公司合作是否推进,含股权风险与独家合作合同');
  assert.ok(review.vetoes.includes('justice'), '刑部应否决');
  assert.equal(report.verdict, 'RECHECK');
  assert.equal(report.needsHumanConfirmation, true, '高风险须人工确认');
  // 若有人想对红灯案准奏，御史台必拦
  const sneaky = runYushitaiAudit({ review, draftVerdict: '准奏', draftSourceLabel: 'LIVE' });
  assert.equal(sneaky.passed, false);
});

test('黄金3 · 报价复盘：无旧案不伪造历史 + 给补救后令', () => {
  const { report } = runCase('上次这个报价为什么被打回,这次怎么避免');
  // 当前无史馆召回 → 不得编造"历史结论"，verdict 不为无条件准奏，且给下一步
  assert.notEqual(report.verdict, 'APPROVE');
  assert.ok(report.nextAction.length > 0);
  assert.ok(report.sourceLabel);
});

test('门 · FALLBACK 来源禁无条件准奏', () => {
  const { report } = runCase('所有证据 ROI 现金 BOM 交期 验收 客户 DRI 里程碑 都齐全', 'FALLBACK');
  assert.notEqual(report.verdict, 'APPROVE');
});
