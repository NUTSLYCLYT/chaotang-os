/** node --experimental-strip-types --test src/core/courtos/ministries/ministry-review.nodetest.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMinistryReview } from './ministry-review-loop.ts';
import { runYushitaiAudit } from './yushitai-auditor.ts';
import { synthesizeImperialReport } from './imperial-report-synthesizer.ts';

test('储能案：选部→红蓝→御史台→合成 全链', () => {
  const review = runMinistryReview({
    taskId: 'storage',
    originalQuestion: '判断100MWh冷库储能项目是否推进,重点看投入边界与现金风险,设备BOM与交付',
    sourceLabel: 'LIVE',
  });
  // 选了户(finance)/工(works)等 + 默认刑(justice)
  assert.ok(review.selectedMinistries.includes('finance'));
  assert.ok(review.selectedMinistries.includes('works'));
  assert.ok(review.selectedMinistries.includes('justice'));
  assert.ok(review.missingEvidence.length > 0);

  const audit = runYushitaiAudit({ review, draftVerdict: '补证', draftSourceLabel: 'LIVE' });
  const report = synthesizeImperialReport({ review, audit });

  // 缺证 → 不准奏
  assert.notEqual(report.verdict, 'APPROVE');
  assert.ok(report.nextAction.length > 0);
  assert.ok(Object.keys(report.ministrySignals).length >= 3);
  // 诚实标源回归(缺口#2/铁律3):各部红蓝卡是确定性 heuristic 规则,非真 LLM 推理。
  // 哪怕外层报告 sourceLabel=LIVE,合成奏折也不得冒充 LIVE —— 规则路径只能标 FALLBACK。
  assert.notEqual(report.sourceLabel, 'LIVE', '规则红蓝卡不得冒充 LIVE');
  assert.notEqual(report.sourceLabel, 'LIVE_SWARM');
});

test('股权合同案：刑部红灯 → 不准奏 + 人工确认', () => {
  const review = runMinistryReview({
    taskId: 'equity',
    originalQuestion: '签独家股权合作合同,含预付款与保证收益条款',
    sourceLabel: 'LIVE',
  });
  assert.ok(review.vetoes.includes('justice'));
  assert.equal(review.humanApprovalRequired, true);
  assert.equal(review.overallSignal, 'RED');

  const audit = runYushitaiAudit({ review, draftVerdict: '准奏', draftSourceLabel: 'LIVE' });
  // 红灯却想准奏 → 御史台阻断
  assert.equal(audit.passed, false);
  assert.ok(audit.blockingIssues.some((b) => b.includes('红灯')));

  const report = synthesizeImperialReport({ review, audit });
  assert.equal(report.verdict, 'RECHECK');
  assert.equal(report.needsHumanConfirmation, true);
});

test('FALLBACK 来源 → 不许无条件准奏', () => {
  const review = runMinistryReview({
    taskId: 'fb', originalQuestion: 'ROI 现金 预算 BOM 交期 验收 客户 DRI 里程碑 都齐全了',
    sourceLabel: 'FALLBACK',
  });
  const audit = runYushitaiAudit({ review });
  const report = synthesizeImperialReport({ review, audit });
  assert.notEqual(report.verdict, 'APPROVE'); // FALLBACK 不准奏
});

test('御史台：缺 sourceLabel 阻断', () => {
  const review = runMinistryReview({ taskId: 't', originalQuestion: '日常采购' });
  const audit = runYushitaiAudit({ review: { ...review, sourceLabel: undefined as unknown as 'LIVE' } });
  assert.equal(audit.passed, false);
  assert.ok(audit.blockingIssues.some((b) => b.includes('sourceLabel')));
});
