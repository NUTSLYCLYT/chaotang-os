import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildXingbuDepartmentOpinion,
  classifyXingbuLegalRiskQuestion,
  evaluateXingbuQualityGate,
  runXingbuCLOCCOOfficeLoopV1,
  runXingbuCLOCCOOfficeReview,
} from './xingbu-clo-cco-office.ts';

test('合作合同：必须补合同正文、适用地区、主体和授权，且不得直接签', () => {
  const opinion = runXingbuCLOCCOOfficeReview({ text: '这个合作合同能不能直接签？', sourceLabel: 'MIXED' });
  assert.equal(opinion.legalRiskQuestionType, 'CONTRACT_REVIEW');
  assert.ok(opinion.requiredSubOffices.includes('contract_office'));
  assert.ok(opinion.requiredSubOffices.includes('legal_operations'));
  assert.ok(opinion.missingEvidence.includes('合同正文或材料原文'));
  assert.ok(opinion.missingEvidence.includes('适用地区/司法辖区'));
  assert.ok(opinion.missingEvidence.includes('交易主体信息'));
  assert.ok(opinion.missingEvidence.includes('授权记录'));
  assert.equal(opinion.humanConfirmationRequired, true);
  assert.ok(opinion.forbiddenActions.includes('自动签约'));
});

test('正式报价：必须触发户部和兵部复核，并阻止自动外发', () => {
  const opinion = runXingbuCLOCCOOfficeReview({ text: '客户要求我们今天发正式报价，可以直接发吗？', sourceLabel: 'MIXED' });
  const gate = evaluateXingbuQualityGate(opinion);
  assert.equal(opinion.legalRiskQuestionType, 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT');
  assert.ok(opinion.crossDepartmentReviews.includes('finance'));
  assert.ok(opinion.crossDepartmentReviews.includes('war'));
  assert.ok(opinion.missingEvidence.includes('报价依据'));
  assert.ok(opinion.missingEvidence.includes('报价有效期'));
  assert.ok(opinion.missingEvidence.includes('承诺边界'));
  assert.ok(opinion.forbiddenActions.includes('自动发送正式报价'));
  assert.equal(gate.signal, 'RED');
  assert.notEqual(gate.verdict, 'APPROVE');
});

test('股权分红：必须公司司复核、户部联动和人工确认', () => {
  const opinion = runXingbuCLOCCOOfficeReview({ text: '这个合作涉及股权和分红，要不要接受？', sourceLabel: 'MIXED' });
  assert.equal(opinion.legalRiskQuestionType, 'CORPORATE_GOVERNANCE');
  assert.ok(opinion.requiredSubOffices.includes('corporate_governance'));
  assert.ok(opinion.crossDepartmentReviews.includes('finance'));
  assert.ok(opinion.missingEvidence.includes('章程'));
  assert.ok(opinion.missingEvidence.includes('股权表'));
  assert.ok(opinion.missingEvidence.includes('董事会/股东会决议'));
  assert.equal(opinion.humanConfirmationRequired, true);
});

test('劳动辞退：必须联动吏部并触发隐私/人工确认风险', () => {
  const opinion = runXingbuCLOCCOOfficeReview({ text: '员工表现差，能不能直接辞退？', sourceLabel: 'MIXED' });
  assert.equal(opinion.legalRiskQuestionType, 'EMPLOYMENT_LAW');
  assert.ok(opinion.requiredSubOffices.includes('employment_law'));
  assert.ok(opinion.crossDepartmentReviews.includes('personnel'));
  assert.ok(opinion.missingEvidence.includes('劳动合同'));
  assert.ok(opinion.missingEvidence.includes('绩效记录'));
  assert.ok(opinion.forbiddenActions.includes('自动解除劳动关系'));
  assert.equal(opinion.humanConfirmationRequired, true);
});

test('律师函/争议：必须走争讼司和证据保全，不得自动发送律师函', () => {
  const opinion = runXingbuCLOCCOOfficeReview({ text: '客户拖欠付款，我们能不能直接发律师函？', sourceLabel: 'MIXED' });
  assert.equal(opinion.legalRiskQuestionType, 'DISPUTE_LITIGATION');
  assert.ok(opinion.requiredSubOffices.includes('dispute_litigation'));
  assert.ok(opinion.missingEvidence.includes('证据保全清单'));
  assert.ok(opinion.forbiddenActions.includes('自动发送律师函'));
  assert.equal(opinion.humanConfirmationRequired, true);
});

test('AI Agent 对外输出：必须锦衣卫和礼部联动，且人工确认', () => {
  const opinion = runXingbuCLOCCOOfficeReview({ text: 'AI Agent 自动生成客户邮件和对外材料，能不能直接发送？', sourceLabel: 'MIXED' });
  assert.equal(opinion.legalRiskQuestionType, 'AI_AGENT_EXTERNAL_OUTPUT');
  assert.ok(opinion.crossDepartmentReviews.includes('jinyiwei'));
  assert.ok(opinion.crossDepartmentReviews.includes('ritual'));
  assert.ok(opinion.missingEvidence.includes('输出内容样本'));
  assert.ok(opinion.missingEvidence.includes('人工复核记录'));
  assert.equal(opinion.humanConfirmationRequired, true);
});

test('xingbu_clo_cco_office_loop_v1 接收 confirmed_edict + intelligence_pack + work_order', () => {
  const result = runXingbuCLOCCOOfficeLoopV1({
    confirmedEdict: {
      originalQuestion: '客户要求我们今天发正式报价，可以直接发吗？',
      refinedQuestion: '请刑部审查正式报价是否构成对外承诺。',
      decisionType: '正式报价风险',
      knownFacts: ['客户要求今天收到正式报价'],
      unknownGaps: ['报价审批人'],
      expectedOutput: ['刑部分奏', '对外承诺风险清单'],
      sourceLabel: 'LIVE',
    },
    intelligencePack: {
      departmentId: 'jinyiwei',
      facts: ['客户需求范围尚未签字确认'],
      evidenceBasis: ['历史沟通记录'],
      missingEvidence: ['客户确认需求范围'],
      unsupportedClaims: [],
      sourceLabel: 'FALLBACK',
    },
    departmentWorkOrder: {
      departmentId: 'justice',
      focusQuestion: '判断是否允许发送正式报价',
      requiredEvidence: ['报价依据', '授权记录'],
      expectedOutputs: ['风险清单', '禁止动作'],
      sourceLabel: 'LIVE',
    },
    sourceLabel: 'LIVE',
  });

  assert.equal(result.loopId, 'xingbu_clo_cco_office_loop_v1');
  assert.equal(result.opinion.department, '刑部');
  assert.equal(result.opinion.legalRiskQuestionType, 'FORMAL_QUOTE_OR_EXTERNAL_COMMITMENT');
  assert.equal(result.opinion.sourceLabel, 'MIXED');
  assert.equal(result.opinion.source_label, 'MIXED');
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('锦衣卫事实')));
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('军机处刑部工单')));
  assert.ok(result.opinion.missingEvidence.includes('客户确认需求范围'));
  assert.notEqual(result.qualityGate.verdict, 'APPROVE');
});

test('buildXingbuDepartmentOpinion 兼容 DepartmentOpinion，并携带刑部明细', () => {
  const departmentOpinion = buildXingbuDepartmentOpinion({
    draftEdict: {
      originalQuestion: '合同里有独家合作条款，能不能签？',
      refinedQuestion: '请刑部审查独家条款和签署权限。',
      decisionType: '合同风险',
      knownFacts: [],
      unknownGaps: [],
      expectedOutput: ['刑部分奏'],
      sourceLabel: 'MIXED',
    },
    sourceLabel: 'MIXED',
  });
  assert.equal(departmentOpinion.departmentId, 'justice');
  assert.equal(departmentOpinion.xingbuOpinion?.department, '刑部');
  assert.ok(departmentOpinion.summary.includes('CLO/CCO Office'));
  assert.equal(departmentOpinion.needsHumanConfirmation, true);
});

test('分类覆盖合规、知产、法运', () => {
  assert.equal(classifyXingbuLegalRiskQuestion('这个行业许可和监管合规怎么判断？'), 'COMPLIANCE_REVIEW');
  assert.equal(classifyXingbuLegalRiskQuestion('这个 NDA 和商业秘密范围能不能签？'), 'IP_CONFIDENTIALITY');
  assert.equal(classifyXingbuLegalRiskQuestion('这个文件谁能盖章和签字？'), 'LEGAL_OPERATIONS');
});
