import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCourtUnifiedDecisionLoop } from './unified-decision-loop.ts';
import {
  buildUnifiedArchiveLearningRecord,
  buildUnifiedEvoMapEvent,
  extractUnifiedReusableLessons,
  inferUnifiedFailureMode,
} from './unified-learning.ts';

test('史馆学习记录沉淀户部 CFO 缺证、风险和质量门', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_hubu_archive_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const record = buildUnifiedArchiveLearningRecord({
    result,
    userAction: 'request_evidence',
    createdAt: '2026-06-17T12:00:00.000Z',
  });

  assert.equal(record.taskId, 'task_hubu_archive_quote');
  assert.equal(record.sourceLabel, result.sourceLabel);
  assert.ok(record.missingEvidence.length > 0);
  assert.ok(record.reusableLessons.some((item) => item.includes('户部')));
  assert.ok(record.reusableLessons.some((item) => item.includes('缺证') || item.includes('补齐')));
});

test('EvoMap 事件记录用户动作和下一版改进建议', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_hubu_evomap_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const event = buildUnifiedEvoMapEvent({
    result,
    userAction: 'request_evidence',
    createdAt: '2026-06-17T12:30:00.000Z',
  });

  assert.equal(event.schema_version, 'EvoMapEventV1');
  assert.ok(event.event_id.startsWith('evomap_task_hubu_evomap_quote_'));
  assert.equal(event.task_id, result.taskId);
  assert.equal(event.loop_trace_id, result.loopTraceId);
  assert.equal(event.loop_id, 'court_unified_decision_loop_v1');
  assert.equal(event.user_action, 'request_evidence');
  assert.equal(event.created_at, '2026-06-17T12:30:00.000Z');
  assert.equal(event.auto_apply, false);
  assert.equal(event.loopId, 'court_unified_decision_loop_v1');
  assert.equal(event.userAction, 'request_evidence');
  assert.equal(event.sourceLabel, result.sourceLabel);
  assert.ok(event.learnedPreference.includes('补证'));
  assert.ok(event.recommendedChange.includes('兵部 CRO') || event.recommendedChange.includes('户部 CFO Office') || event.recommendedChange.includes('质门'));
});

test('学习层不伪造真实历史：FALLBACK/DEMO 标记为来源问题', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_hubu_fallback_learning',
    rawQuestion: '判断是否推进普通客户沟通。',
    sourceLabel: 'FALLBACK',
  });

  assert.equal(inferUnifiedFailureMode(result), 'source_not_live');
  const lessons = extractUnifiedReusableLessons(result);
  assert.ok(lessons.some((item) => item.includes('质门') || item.includes('来源')));
});

test('史馆学习记录沉淀工部交付缺证和不可承诺边界', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_gongbu_archive_delivery',
    rawQuestion: '客户要求 30 天交付储能项目，但目前没有 BOM、设备交期和验收标准，销售想承诺一定能交付。',
  });
  const record = buildUnifiedArchiveLearningRecord({
    result,
    userAction: 'request_recheck',
    createdAt: '2026-06-18T12:00:00.000Z',
  });

  assert.ok(record.deliveryLearning);
  assert.equal(record.deliveryLearning?.deliveryCommitmentRisk, true);
  assert.ok(record.deliveryLearning?.forbiddenActions.length);
  assert.ok(record.deliveryLearning?.crossDepartmentReviews.includes('justice'));
  assert.ok(record.reusableLessons.some((item) => item.includes('工部')));
  assert.ok(record.reusableLessons.some((item) => item.includes('不得提前承诺') || item.includes('交付质门')));
});

test('史馆学习记录沉淀兵部报价边界和销售下一步', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_bingbu_archive_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const record = buildUnifiedArchiveLearningRecord({
    result,
    userAction: 'request_evidence',
    createdAt: '2026-06-18T13:00:00.000Z',
  });

  assert.ok(record.salesLearning);
  assert.equal(record.salesLearning?.questionType, 'QUOTE_STRATEGY');
  assert.equal(record.salesLearning?.maySendExternally, false);
  assert.ok(record.salesLearning?.crossDepartmentReviews.includes('finance'));
  assert.ok(record.salesLearning?.crossDepartmentReviews.includes('justice'));
  assert.ok(record.reusableLessons.some((item) => item.includes('兵部')));
  assert.ok(record.reusableLessons.some((item) => item.includes('正式报价') || item.includes('客户要求')));
});

test('EvoMap 针对兵部正式报价给出下一版改进建议', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_bingbu_evomap_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const event = buildUnifiedEvoMapEvent({
    result,
    userAction: 'request_evidence',
  });

  assert.equal(event.loopId, 'court_unified_decision_loop_v1');
  assert.equal(event.loopTraceId, result.loopTraceId);
  assert.equal(event.failureMode, 'quality_gate_blocked');
  assert.ok(event.recommendedChange.includes('兵部 CRO / Sales / RevOps Office'));
  assert.ok(event.recommendedChange.includes('报价前检查清单'));
});

test('EvoMap 针对工部交付承诺风险给出下一版改进建议', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_gongbu_evomap_delivery',
    rawQuestion: '客户要求 30 天交付，销售想对外说一定按时交付。',
  });
  const event = buildUnifiedEvoMapEvent({
    result,
    userAction: 'request_recheck',
  });

  assert.equal(event.loopId, 'court_unified_decision_loop_v1');
  assert.equal(event.loopTraceId, result.loopTraceId);
  assert.equal(event.failureMode, 'quality_gate_blocked');
  assert.ok(event.recommendedChange.includes('工部 CTO/CPO Office'));
  assert.ok(event.recommendedChange.includes('固定交期') || event.recommendedChange.includes('交付能力'));
});
