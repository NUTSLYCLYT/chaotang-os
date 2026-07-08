import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGongbuDepartmentOpinion,
  classifyGongbuDeliveryQuestion,
  evaluateGongbuQualityGate,
  runGongbuCTOCPOOfficeLoopV1,
  runGongbuCTOCPOOfficeReview,
} from './gongbu-cto-cpo-office.ts';

test('储能项目：必须补 BOM、设备报价、交期、现场条件和验收标准', () => {
  const opinion = runGongbuCTOCPOOfficeReview({
    text: '判断 100MWh 冷库储能项目是否推进，重点看设备 BOM、交期、施工和验收。',
    sourceLabel: 'MIXED',
  });
  assert.equal(opinion.deliveryQuestionType, 'STORAGE_OR_HARDWARE_PROJECT');
  assert.ok(opinion.requiredSubOffices.includes('bom_supply_chain'));
  assert.ok(opinion.requiredSubOffices.includes('field_implementation'));
  assert.ok(opinion.requiredSubOffices.includes('quality_acceptance'));
  assert.ok(opinion.missingEvidence.includes('BOM'));
  assert.ok(opinion.missingEvidence.includes('设备报价'));
  assert.ok(opinion.missingEvidence.includes('交期'));
  assert.ok(opinion.missingEvidence.includes('现场条件'));
  assert.ok(opinion.missingEvidence.includes('验收标准'));
  assert.equal(opinion.deliveryCommitmentRisk, false);
});

test('客户要求 30 天交付：必须触发刑部、礼部、兵部和人工确认', () => {
  const opinion = runGongbuCTOCPOOfficeReview({ text: '客户要求 30 天交付储能项目，我们能不能答应？', sourceLabel: 'MIXED' });
  const gate = evaluateGongbuQualityGate(opinion);
  assert.equal(opinion.deliveryQuestionType, 'STORAGE_OR_HARDWARE_PROJECT');
  assert.equal(opinion.deliveryCommitmentRisk, true);
  assert.ok(opinion.requiredSubOffices.includes('delivery_commitment_gate'));
  assert.ok(opinion.crossDepartmentReviews.includes('justice'));
  assert.ok(opinion.crossDepartmentReviews.includes('ritual'));
  assert.ok(opinion.crossDepartmentReviews.includes('war'));
  assert.equal(opinion.humanConfirmationRequired, true);
  assert.equal(gate.signal, 'RED');
  assert.notEqual(gate.verdict, 'APPROVE');
});

test('无 BOM 时不得承诺交付，也不得锁定供应商', () => {
  const opinion = runGongbuCTOCPOOfficeReview({ text: '客户要我们先承诺交付，但现在没有 BOM。', sourceLabel: 'MIXED' });
  assert.equal(opinion.deliveryQuestionType, 'BOM_SUPPLY_CHAIN');
  assert.ok(opinion.requiredSubOffices.includes('bom_supply_chain'));
  assert.ok(opinion.requiredSubOffices.includes('delivery_commitment_gate'));
  assert.ok(opinion.missingEvidence.includes('BOM'));
  assert.ok(opinion.forbiddenActions.includes('自动承诺固定交期'));
  assert.ok(opinion.forbiddenActions.includes('自动锁定供应商'));
});

test('验收缺失：必须补验收标准和测试计划，不能确认交付完成', () => {
  const opinion = runGongbuCTOCPOOfficeReview({ text: '项目要上线，但客户验收标准还没写清楚。', sourceLabel: 'MIXED' });
  assert.equal(opinion.deliveryQuestionType, 'QUALITY_ACCEPTANCE');
  assert.ok(opinion.requiredSubOffices.includes('quality_acceptance'));
  assert.ok(opinion.missingEvidence.includes('验收标准'));
  assert.ok(opinion.missingEvidence.includes('测试计划'));
  assert.ok(opinion.forbiddenActions.includes('自动确认交付完成'));
});

test('范围变更：必须联动吏部和户部，不能自动扩大 MVP 范围', () => {
  const opinion = runGongbuCTOCPOOfficeReview({ text: '客户临时加需求，要不要直接加进交付范围？', sourceLabel: 'MIXED' });
  assert.equal(opinion.deliveryQuestionType, 'SCOPE_CHANGE');
  assert.ok(opinion.requiredSubOffices.includes('solution_architecture'));
  assert.ok(opinion.requiredSubOffices.includes('delivery_operations'));
  assert.ok(opinion.crossDepartmentReviews.includes('personnel'));
  assert.ok(opinion.forbiddenActions.includes('自动变更 MVP 范围'));
});

test('gongbu_cto_cpo_delivery_office_loop_v1 接收 confirmed_edict + intelligence_pack + work_order', () => {
  const result = runGongbuCTOCPOOfficeLoopV1({
    confirmedEdict: {
      originalQuestion: '客户要求 30 天交付储能项目，我们能不能答应？',
      refinedQuestion: '请工部审查交付可行性和对外交付承诺。',
      decisionType: '交付承诺风险',
      knownFacts: ['客户要求 30 天交付'],
      unknownGaps: ['BOM', '验收标准'],
      expectedOutput: ['工部分奏', '不可承诺事项清单'],
      sourceLabel: 'LIVE',
    },
    intelligencePack: {
      departmentId: 'jinyiwei',
      facts: ['供应商交期尚未核验'],
      evidenceBasis: ['历史沟通记录'],
      missingEvidence: ['供应商交期证明'],
      unsupportedClaims: [],
      sourceLabel: 'FALLBACK',
    },
    departmentWorkOrder: {
      departmentId: 'works',
      focusQuestion: '判断是否允许承诺 30 天交付',
      requiredEvidence: ['关键路径', '产能', '交期依据'],
      expectedOutputs: ['交期风险清单', '客户交付口径草稿'],
      sourceLabel: 'LIVE',
    },
    sourceLabel: 'LIVE',
  });

  assert.equal(result.loopId, 'gongbu_cto_cpo_delivery_office_loop_v1');
  assert.equal(result.opinion.department, '工部');
  assert.equal(result.opinion.sourceLabel, 'MIXED');
  assert.equal(result.opinion.source_label, 'MIXED');
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('锦衣卫事实')));
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('军机处工部工单')));
  assert.ok(result.opinion.missingEvidence.includes('供应商交期证明'));
  assert.notEqual(result.qualityGate.verdict, 'APPROVE');
});

test('buildGongbuDepartmentOpinion 兼容 DepartmentOpinion，并携带工部明细', () => {
  const departmentOpinion = buildGongbuDepartmentOpinion({
    draftEdict: {
      originalQuestion: '客户要求 30 天交付，怎么回复？',
      refinedQuestion: '请工部审查交付承诺边界。',
      decisionType: '交付承诺',
      knownFacts: [],
      unknownGaps: [],
      expectedOutput: ['工部分奏'],
      sourceLabel: 'MIXED',
    },
    sourceLabel: 'MIXED',
  });
  assert.equal(departmentOpinion.departmentId, 'works');
  assert.equal(departmentOpinion.gongbuOpinion?.department, '工部');
  assert.ok(departmentOpinion.summary.includes('CTO/CPO Delivery Office'));
  assert.equal(departmentOpinion.needsHumanConfirmation, true);
});

test('分类覆盖技术、MVP、复盘', () => {
  assert.equal(classifyGongbuDeliveryQuestion('这个 AI 功能技术上能不能做？'), 'TECHNICAL_FEASIBILITY');
  assert.equal(classifyGongbuDeliveryQuestion('这个 SaaS MVP 第一版范围怎么定？'), 'MVP_SCOPE');
  assert.equal(classifyGongbuDeliveryQuestion('这个交付项目为什么延期了，下次怎么避免？'), 'DELIVERY_REVIEW');
});
