import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiresHumanApproval } from '../harness/human-approval-gate.ts';
import { DEPARTMENT_REGISTRY, enabledDepartmentIds, listDepartments } from './department-registry.ts';
import {
  buildBingbuDepartmentWorkOrder,
  buildGongbuDepartmentWorkOrder,
  buildHubuDepartmentWorkOrder,
  buildIntelligencePack,
  buildInteractionCheckpoint,
  buildRitesDepartmentWorkOrder,
  buildXingbuDepartmentWorkOrder,
  currentEnabledDepartmentNames,
  draftUnifiedEdict,
  planUnifiedReview,
  runCourtUnifiedDecisionLoop,
} from './unified-decision-loop.ts';
import { buildUnifiedLoopViewModel } from './unified-ui-adapter.ts';

test('统一 Loop 使用 registry，不存在五部专线概念', () => {
  assert.deepEqual(enabledDepartmentIds(), ['jinyiwei', 'finance', 'war', 'personnel', 'justice', 'ritual', 'works']);
  assert.equal(DEPARTMENT_REGISTRY.ritual.enabled, true);
  assert.equal(DEPARTMENT_REGISTRY.works.enabled, true);
  assert.ok(currentEnabledDepartmentNames().includes('锦衣卫'));
  assert.equal(listDepartments().length >= enabledDepartmentIds().length, true);
});

test('丞相拟旨保留原问并输出统一奏折字段', () => {
  const draft = draftUnifiedEdict('客户这周要求正式报价，要不要发？');
  assert.equal(draft.originalQuestion, '客户这周要求正式报价，要不要发？');
  assert.ok(draft.refinedQuestion.includes('军机处'));
  assert.deepEqual(draft.expectedOutput, ['圣裁', '分奏', '证据', '风险', '后令', '质门', '来源']);
});

test('军机处定审自动选择当前 enabled 部门', () => {
  const draft = draftUnifiedEdict('客户这周要求正式报价，要不要发？需要审批人和报价有效期。');
  const plan = planUnifiedReview({ taskId: 'task_quote', draftEdict: draft });
  assert.ok(plan.selectedDepartments.includes('jinyiwei'));
  assert.ok(plan.selectedDepartments.includes('finance'));
  assert.ok(plan.selectedDepartments.includes('war'));
  assert.ok(plan.selectedDepartments.includes('personnel'));
  assert.ok(plan.selectedDepartments.includes('justice'));
  assert.equal(plan.selectedDepartments.includes('ritual'), true);
  assert.equal(plan.selectedDepartments.includes('works'), false);
});

test('军机处为户部自动生成 CFO Office work order', () => {
  const draft = draftUnifiedEdict('客户这周要求正式报价，要不要发？需要审批人和报价有效期。');
  const plan = planUnifiedReview({ taskId: 'task_hubu_work_order', draftEdict: draft });
  const intelligencePack = buildIntelligencePack(plan, draft);
  const workOrder = buildHubuDepartmentWorkOrder({ plan, draftEdict: draft, intelligencePack });

  assert.ok(workOrder);
  assert.equal(workOrder?.departmentId, 'finance');
  assert.ok(workOrder?.focusQuestion?.includes('户部 CFO Office'));
  assert.ok(workOrder?.requiredEvidence?.some((item) => item.includes('报价') || item.includes('成本')));
});

test('军机处为兵部自动生成 CRO / Sales / RevOps Office work order', () => {
  const draft = draftUnifiedEdict('客户这周要求正式报价，要不要发？需要销售 owner、商机阶段和客户确认需求。');
  const plan = planUnifiedReview({ taskId: 'task_bingbu_work_order', draftEdict: draft });
  const intelligencePack = buildIntelligencePack(plan, draft);
  const workOrder = buildBingbuDepartmentWorkOrder({ plan, draftEdict: draft, intelligencePack });

  assert.ok(workOrder);
  assert.equal(workOrder?.departmentId, 'war');
  assert.ok(workOrder?.focusQuestion?.includes('兵部 CRO / Sales / RevOps Office'));
  assert.ok(workOrder?.requiredEvidence?.some((item) => item.includes('客户') || item.includes('报价') || item.includes('需求')));
  assert.ok(workOrder?.requestedArtifacts?.includes('报价前检查清单'));
});

test('军机处为刑部自动生成 CLO/CCO Office work order', () => {
  const draft = draftUnifiedEdict('客户要求正式报价，并希望我们今天确认承诺边界。');
  const plan = planUnifiedReview({ taskId: 'task_xingbu_work_order', draftEdict: draft });
  const intelligencePack = buildIntelligencePack(plan, draft);
  const workOrder = buildXingbuDepartmentWorkOrder({ plan, draftEdict: draft, intelligencePack });

  assert.ok(workOrder);
  assert.equal(workOrder?.departmentId, 'justice');
  assert.ok(workOrder?.focusQuestion?.includes('刑部 CLO/CCO Office'));
  assert.ok(workOrder?.requiredEvidence?.some((item) => item.includes('授权') || item.includes('承诺')));
});

test('军机处为礼部自动生成 CMO/CCO Office work order', () => {
  const draft = draftUnifiedEdict('客户要求正式报价，销售该怎么回复才不形成对外承诺？');
  const plan = planUnifiedReview({ taskId: 'task_rites_work_order', draftEdict: draft });
  const intelligencePack = buildIntelligencePack(plan, draft);
  const workOrder = buildRitesDepartmentWorkOrder({ plan, draftEdict: draft, intelligencePack });

  assert.ok(workOrder);
  assert.equal(workOrder?.departmentId, 'ritual');
  assert.equal(workOrder?.audience, '客户或潜在客户');
  assert.ok(workOrder?.requestedArtifacts?.includes('客户回复草稿'));
  assert.ok(workOrder?.requiredEvidence?.some((item) => item.includes('受众') || item.includes('授权')));
});

test('军机处为工部自动生成 CTO/CPO Delivery Office work order', () => {
  const draft = draftUnifiedEdict('判断 100MWh 冷库储能项目是否推进，重点看 BOM、交期、施工和验收。');
  const plan = planUnifiedReview({ taskId: 'task_gongbu_work_order', draftEdict: draft });
  const intelligencePack = buildIntelligencePack(plan, draft);
  const workOrder = buildGongbuDepartmentWorkOrder({ plan, draftEdict: draft, intelligencePack });

  assert.ok(plan.selectedDepartments.includes('works'));
  assert.ok(workOrder);
  assert.equal(workOrder?.departmentId, 'works');
  assert.ok(workOrder?.focusQuestion?.includes('工部 CTO/CPO Delivery Office'));
  assert.ok(workOrder?.requiredEvidence?.some((item) => item.includes('BOM') || item.includes('交期') || item.includes('验收')));
});

test('真实报价问题生成可裁奏折：有证据或缺口、风险、后令、来源', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  assert.equal(result.loopId, 'court_unified_decision_loop_v1');
  assert.ok(result.states.includes('INTELLIGENCE_READY'));
  assert.ok(result.states.includes('DEPARTMENTS_REVIEWED'));
  assert.ok(result.states.includes('QUALITY_GATED'));
  assert.equal(result.memorial.evidence.length > 0 || result.memorial.missingEvidence.length > 0, true);
  assert.ok(result.memorial.nextAction.length > 0);
  assert.equal(result.memorial.sourceLabel, 'MIXED');
});

test('统一 Loop 户部结果吸收 work order 和情报包进入奏折', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_hubu_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const finance = result.departmentOpinions.find((item) => item.departmentId === 'finance');

  assert.ok(result.departmentWorkOrders.finance);
  assert.ok(finance?.cfoOpinion);
  assert.ok(finance?.summary.includes('户部 CFO Office'));
  assert.ok(result.memorial.departmentSummaries.some((item) => item.departmentId === 'finance' && item.cfoOpinion));
});

test('统一 Loop 兵部结果吸收 work order 和情报包进入奏折', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_bingbu_quote',
    rawQuestion: '客户这周要求正式报价，销售应该怎么推进？',
  });
  const war = result.departmentOpinions.find((item) => item.departmentId === 'war');

  assert.ok(result.departmentWorkOrders.war);
  assert.ok(war?.warOpinion);
  assert.ok(war?.summary.includes('兵部 CRO / Sales / RevOps Office'));
  assert.equal(war?.warOpinion?.salesRevenueQuestionType, 'QUOTE_STRATEGY');
  assert.ok(war?.warOpinion?.crossDepartmentReviews.includes('finance'));
  assert.ok(war?.warOpinion?.crossDepartmentReviews.includes('justice'));
  assert.equal(war?.warOpinion?.maySendExternally, false);
  assert.ok(result.memorial.departmentSummaries.some((item) => item.departmentId === 'war' && item.warOpinion));
});

test('高风险合同/股权触发刑部红灯和 HumanApprovalGate', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_equity',
    rawQuestion: '请判断这个包含股权、合同、预付款和独家合作的方案能不能直接签。',
  });
  const justice = result.departmentOpinions.find((item) => item.departmentId === 'justice');
  assert.equal(justice?.signal, 'RED');
  assert.ok(result.departmentWorkOrders.justice);
  assert.ok(justice?.xingbuOpinion);
  assert.equal(justice?.xingbuOpinion?.department, '刑部');
  assert.ok(justice?.summary.includes('刑部 CLO/CCO Office'));
  assert.ok(justice?.xingbuOpinion?.forbiddenActions.includes('自动签约'));
  assert.equal(result.memorial.needsHumanConfirmation, true);
  assert.equal(result.memorial.verdict, 'RECHECK');
  assert.equal(
    requiresHumanApproval({
      summary: result.memorial.oneSentence,
      risks: result.memorial.risks,
      sourceLabel: result.memorial.sourceLabel,
      needsHumanConfirmation: result.memorial.needsHumanConfirmation,
      missingEvidence: result.memorial.missingEvidence,
    }, { attemptingAccept: true }),
    true,
  );
});

test('统一 Loop 刑部结果吸收 work order 和情报包进入奏折', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_xingbu_quote',
    rawQuestion: '客户要求我们今天发正式报价，可以直接发吗？',
  });
  const justice = result.departmentOpinions.find((item) => item.departmentId === 'justice');

  assert.ok(result.departmentWorkOrders.justice);
  assert.ok(justice?.xingbuOpinion);
  assert.equal(justice?.xingbuOpinion?.legalRiskQuestionType, 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT');
  assert.ok(justice?.xingbuOpinion?.crossDepartmentReviews.includes('finance'));
  assert.ok(justice?.xingbuOpinion?.crossDepartmentReviews.includes('war'));
  assert.ok(result.memorial.departmentSummaries.some((item) => item.departmentId === 'justice' && item.xingbuOpinion));
  assert.ok(result.memorial.risks.some((item) => item.includes('不可逆') || item.includes('承诺') || item.includes('授权')));
});

test('统一 Loop 礼部结果吸收 work order 和情报包进入奏折', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_rites_quote',
    rawQuestion: '客户要求正式报价，销售该怎么回复才不形成对外承诺？',
  });
  const ritual = result.departmentOpinions.find((item) => item.departmentId === 'ritual');

  assert.ok(result.departmentWorkOrders.ritual);
  assert.ok(ritual?.ritesOpinion);
  assert.ok(ritual?.summary.includes('礼部 CMO/CCO Office'));
  assert.equal(ritual?.ritesOpinion?.brandCommsQuestionType, '正式报价表达');
  assert.ok(ritual?.ritesOpinion?.requiredCrossReviews.includes('户部'));
  assert.ok(ritual?.ritesOpinion?.requiredCrossReviews.includes('刑部'));
  assert.equal(ritual?.ritesOpinion?.mayPublish, false);
  assert.ok(result.memorial.departmentSummaries.some((item) => item.departmentId === 'ritual' && item.ritesOpinion));
});

test('统一 Loop 工部结果吸收 work order 和情报包进入奏折', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_gongbu_storage',
    rawQuestion: '判断 100MWh 冷库储能项目是否推进，重点看 BOM、交期、施工和验收。',
  });
  const works = result.departmentOpinions.find((item) => item.departmentId === 'works');

  assert.ok(result.departmentWorkOrders.works);
  assert.ok(works?.gongbuOpinion);
  assert.ok(works?.summary.includes('工部 CTO/CPO Delivery Office'));
  assert.equal(works?.gongbuOpinion?.deliveryQuestionType, 'STORAGE_OR_HARDWARE_PROJECT');
  assert.ok(works?.missingEvidence.includes('BOM'));
  assert.ok(works?.missingEvidence.includes('验收标准'));
  assert.ok(result.memorial.departmentSummaries.some((item) => item.departmentId === 'works' && item.gongbuOpinion));
});

test('统一 Loop 工部交付承诺触发红灯、刑部礼部兵部联动', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_gongbu_commitment',
    rawQuestion: '客户要求 30 天交付，销售想告诉客户一定能按时交付，这句话能不能说？',
  });
  const works = result.departmentOpinions.find((item) => item.departmentId === 'works');

  assert.ok(works?.gongbuOpinion);
  assert.equal(works?.signal, 'RED');
  assert.equal(works?.gongbuOpinion?.deliveryCommitmentRisk, true);
  assert.ok(works?.gongbuOpinion?.crossDepartmentReviews.includes('justice'));
  assert.ok(works?.gongbuOpinion?.crossDepartmentReviews.includes('ritual'));
  assert.ok(works?.gongbuOpinion?.crossDepartmentReviews.includes('war'));
  assert.equal(result.memorial.needsHumanConfirmation, true);
  assert.equal(result.memorial.verdict, 'RECHECK');
});

test('分歧不能隐藏：推进视角遇到红黄灯时生成冲突', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_conflict',
    rawQuestion: '客户合作机会很好，但正式报价缺少成本边界、审批人和合同授权。',
  });
  assert.ok(result.conflicts.length > 0);
  assert.ok(result.memorial.conflicts.length > 0);
});

test('有效交互检查点一次只问一个最关键问题', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_interaction',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const card = buildInteractionCheckpoint(result.intelligencePack, result.departmentOpinions, result.sourceLabel);
  assert.ok(card);
  assert.ok(card?.question.includes('当前最缺一项材料'));
  assert.deepEqual(card?.actions, ['UPLOAD_EVIDENCE', 'ANSWER_TEXT', 'CONTINUE_WITH_GAPS']);
});

test('FALLBACK/DEMO 不得准奏', () => {
  const fallback = runCourtUnifiedDecisionLoop({
    taskId: 'task_fallback',
    rawQuestion: '判断是否推进普通客户沟通。',
    sourceLabel: 'FALLBACK',
  });
  assert.notEqual(fallback.memorial.verdict, 'APPROVE');
  assert.equal(fallback.memorial.qualityGate.passed, false);
  assert.ok(fallback.memorial.qualityGate.blockingIssues.some((item) => item.includes('FALLBACK')));
});

test('UI ViewModel 只展示业务状态和一个主动作', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_vm',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const vm = buildUnifiedLoopViewModel(result);
  assert.ok(vm.primaryAction.length > 0);
  assert.ok(vm.enabledDepartments.some((item) => item.name === '锦衣卫'));
  assert.equal(vm.sourceLabel, 'MIXED');
  assert.match(vm.headline, /不要直接发送正式报价|补证|推进|复核|采纳/);
});

test('真实正式报价任务第一屏输出业务裁决、材料入口和外发边界', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_quote_first_screen',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const vm = buildUnifiedLoopViewModel(result);
  const brief = vm.formalQuoteDecisionBrief;

  assert.ok(brief);
  assert.equal(vm.headline, '先不要直接发送正式报价。');
  assert.equal(vm.primaryAction, '先发安全回复，并补齐报价前检查清单。');
  assert.equal(brief?.maySendExternally, false);
  assert.equal(brief?.needsHumanConfirmation, true);
  assert.ok(brief?.safeReplyDraft.includes('内部完成成本和审批核对后'));
  assert.ok(brief?.quoteChecklist.some((item) => item.includes('成本表')));
  assert.ok(brief?.quoteChecklist.some((item) => item.includes('报价有效期')));
  assert.ok(brief?.missingEvidence.some((item) => item.includes('客户确认需求范围')));
  assert.ok(brief?.materialActions.includes('生成客户安全回复草稿'));
  assert.ok(brief?.materialActions.includes('生成报价前检查清单'));
  assert.ok(brief?.triggeredDepartments.some((item) => item.id === 'jinyiwei'));
  assert.ok(brief?.triggeredDepartments.some((item) => item.id === 'war'));
  assert.ok(brief?.triggeredDepartments.some((item) => item.id === 'finance'));
  assert.ok(brief?.triggeredDepartments.some((item) => item.id === 'justice'));
  assert.ok(brief?.triggeredDepartments.some((item) => item.id === 'ritual'));
  assert.doesNotMatch(JSON.stringify(brief), /价策司|审辞司|agent|蜂群/i);
});

test('UI ViewModel 最终奏折卷轴稳定输出八要素和裁决动作', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_memorial_scroll_quote',
    rawQuestion: '客户这周要求正式报价，要不要发？',
  });
  const vm = buildUnifiedLoopViewModel(result);
  const scroll = vm.memorialScroll;

  assert.equal(scroll.seal, '機密');
  assert.ok(['补证', '复核', '驳回', '准奏'].includes(scroll.verdict));
  assert.ok(scroll.oneSentence.length > 0);
  assert.ok(scroll.ministrySignals.some((item) => item.id === 'jinyiwei'));
  assert.ok(scroll.ministrySignals.some((item) => item.id === 'finance'));
  assert.ok(scroll.ministrySignals.some((item) => item.id === 'war'));
  assert.ok(scroll.redBlueHighlights.length > 0);
  assert.ok(scroll.missingEvidence.length > 0);
  assert.ok(scroll.risks.length > 0);
  assert.ok(scroll.nextAction.length > 0);
  assert.equal(scroll.qualityGate.status, '阻断');
  assert.equal(scroll.sourceLabel, result.sourceLabel);
  assert.equal(scroll.needsHumanConfirmation, true);
  assert.ok(scroll.decisionActions.includes('驳回重拟'));
  assert.ok(scroll.decisionActions.includes('人工确认后归档'));
  assert.doesNotMatch(JSON.stringify(scroll), /价策司|审辞司|agent_\\d+|tool_x/i);
});

test('UI ViewModel 最终奏折卷轴不隐藏部门冲突', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_memorial_scroll_conflict',
    rawQuestion: '客户合作机会很好，但正式报价缺少成本边界、审批人和合同授权。',
  });
  const vm = buildUnifiedLoopViewModel(result);

  assert.ok(result.conflicts.length > 0);
  assert.ok(vm.memorialScroll.conflicts.length > 0);
  assert.match(vm.memorialScroll.conflicts.join('\n'), /户部|刑部|兵部|礼部|工部|吏部/);
});

test('UI ViewModel 默认不展示礼部司、agent 或蜂群 trace', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_rites_vm',
    rawQuestion: '客户要求正式报价，销售该怎么回复才不形成对外承诺？',
  });
  const vm = buildUnifiedLoopViewModel(result);
  const ritual = vm.enabledDepartments.find((item) => item.id === 'ritual');

  assert.ok(ritual);
  assert.ok(ritual?.summary.includes('礼部 CMO/CCO Office'));
  assert.doesNotMatch(ritual?.summary ?? '', /品牌司|客群司|文宣司|招商司|公关司|渠道司|审辞司|rites_|agent|蜂群/i);
});

test('UI ViewModel 默认不展示工部司、agent 或蜂群 trace', () => {
  const result = runCourtUnifiedDecisionLoop({
    taskId: 'task_gongbu_vm',
    rawQuestion: '客户要求 30 天交付，销售想告诉客户一定能按时交付，这句话能不能说？',
  });
  const vm = buildUnifiedLoopViewModel(result);
  const works = vm.enabledDepartments.find((item) => item.id === 'works');

  assert.ok(works);
  assert.ok(works?.summary.includes('工部 CTO/CPO Delivery Office'));
  assert.doesNotMatch(works?.summary ?? '', /方案司|物料司|进度司|质量司|现场司|交付司|承诺司|gongbu_|agent|蜂群/i);
  assert.ok(vm.worksDeliveryBrief);
  assert.equal(vm.worksDeliveryBrief?.needsHumanConfirmation, true);
  assert.ok(vm.worksDeliveryBrief?.forbiddenCommitments.length);
  assert.ok(vm.worksDeliveryBrief?.crossDepartmentReviews.includes('justice'));
  assert.doesNotMatch(JSON.stringify(vm.worksDeliveryBrief), /方案司|物料司|进度司|质量司|现场司|交付司|承诺司|gongbu_|agent|蜂群/i);
});
