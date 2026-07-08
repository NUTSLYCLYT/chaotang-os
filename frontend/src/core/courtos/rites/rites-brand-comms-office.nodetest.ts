import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRitesDepartmentOpinion,
  classifyRitesBrandCommsQuestion,
  evaluateRitesQualityGate,
  runRitesBrandCommsOfficeLoopV1,
  runRitesBrandCommsOfficeReview,
} from './rites-brand-comms-office.ts';

test('客户要求正式报价：礼部必须联动户部和刑部，且不得直接外发', () => {
  const opinion = runRitesBrandCommsOfficeReview({
    text: '客户这周要求正式报价，销售该怎么回复？',
    sourceLabel: 'MIXED',
  });

  assert.equal(opinion.brandCommsQuestionType, '正式报价表达');
  assert.ok(opinion.requiredSubOffices.includes('rites_content_copy'));
  assert.ok(opinion.requiredSubOffices.includes('rites_message_quality_gate'));
  assert.ok(opinion.requiredCrossReviews.includes('户部'));
  assert.ok(opinion.requiredCrossReviews.includes('刑部'));
  assert.ok(opinion.missingEvidence.includes('报价依据'));
  assert.ok(opinion.missingEvidence.includes('成本边界'));
  assert.ok(opinion.missingEvidence.includes('报价有效期'));
  assert.equal(opinion.highRiskRequiresHumanConfirmation, true);
  assert.equal(opinion.mayPublish, false);
  assert.equal(opinion.generatedArtifacts[0]?.mayPublish, false);
});

test('招商材料写保底收益：审辞司必须阻断', () => {
  const opinion = runRitesBrandCommsOfficeReview({
    text: '招商材料能不能写保底收益，客户问 ROI 能不能承诺？',
    sourceLabel: 'MIXED',
  });
  const gate = evaluateRitesQualityGate(opinion);

  assert.equal(opinion.brandCommsQuestionType, '招商材料');
  assert.equal(opinion.messageRiskLevel, 'BLOCKED');
  assert.equal(opinion.position, '禁止外发');
  assert.ok(opinion.forbiddenExpressions.includes('保底收益'));
  assert.ok(opinion.requiredCrossReviews.includes('户部'));
  assert.ok(opinion.requiredCrossReviews.includes('刑部'));
  assert.equal(gate.signal, 'RED');
  assert.notEqual(gate.verdict, 'APPROVE');
  assert.ok(gate.blockingIssues.includes('blocked_message_risk'));
});

test('危机和媒体回应：必须触发公关、刑部、军机处和人工确认', () => {
  const opinion = runRitesBrandCommsOfficeReview({
    text: '发生客户投诉并出现舆情，媒体采访公司，第一小时怎么回应？',
    sourceLabel: 'MIXED',
  });
  const gate = evaluateRitesQualityGate(opinion);

  assert.equal(opinion.brandCommsQuestionType, '危机沟通');
  assert.ok(opinion.requiredSubOffices.includes('rites_pr_reputation'));
  assert.ok(opinion.requiredCrossReviews.includes('公关司'));
  assert.ok(opinion.requiredCrossReviews.includes('刑部'));
  assert.ok(opinion.requiredCrossReviews.includes('军机处'));
  assert.equal(opinion.highRiskRequiresHumanConfirmation, true);
  assert.ok(gate.requiredActions.includes('crisis_comms_requires_human_confirmation'));
  assert.equal(opinion.mayPublish, false);
});

test('AI 生成对外文案：必须进入审辞司质门，不能直接发', () => {
  const opinion = runRitesBrandCommsOfficeReview({
    text: 'AI 生成的对外文案能不能直接发？',
    sourceLabel: 'MIXED',
  });
  const gate = evaluateRitesQualityGate(opinion);

  assert.equal(opinion.brandCommsQuestionType, 'AI生成内容审查');
  assert.ok(opinion.requiredSubOffices.includes('rites_message_quality_gate'));
  assert.equal(opinion.messageRiskLevel, 'HIGH');
  assert.equal(opinion.highRiskRequiresHumanConfirmation, true);
  assert.ok(gate.requiredActions.includes('ai_generated_external_content_requires_review'));
  assert.equal(opinion.generatedArtifacts[0]?.draftStatus, 'NEEDS_REVIEW');
  assert.equal(opinion.mayPublish, false);
});

test('客户案例公开：必须要求客户授权和隐私权限检查', () => {
  const opinion = runRitesBrandCommsOfficeReview({
    text: '客户案例能不能公开，还想放客户 Logo？',
    sourceLabel: 'MIXED',
  });

  assert.equal(opinion.brandCommsQuestionType, '客户案例授权');
  assert.ok(opinion.missingEvidence.includes('客户授权'));
  assert.ok(opinion.missingEvidence.includes('隐私权限'));
  assert.ok(opinion.requiredCrossReviews.includes('隐私权限检查'));
  assert.ok(opinion.requiredCrossReviews.includes('刑部'));
  assert.equal(opinion.highRiskRequiresHumanConfirmation, true);
});

test('rites_brand_comms_office_loop_v1 接收 confirmed_edict + intelligence_pack + work_order', () => {
  const result = runRitesBrandCommsOfficeLoopV1({
    confirmedEdict: {
      originalQuestion: '客户要求正式报价，销售该怎么回复？',
      refinedQuestion: '请礼部生成安全客户回复，并联动户部和刑部审查报价承诺风险。',
      decisionType: '客户表达与报价风险',
      knownFacts: ['客户希望本周收到价格口径'],
      unknownGaps: ['审批人'],
      expectedOutput: ['礼部分奏', '客户回复草稿', '禁用表达'],
      sourceLabel: 'LIVE',
    },
    intelligencePack: {
      departmentId: 'jinyiwei',
      facts: ['客户需求范围尚未签字确认'],
      evidenceBasis: ['历史沟通记录显示客户仍在比较方案'],
      missingEvidence: ['客户确认需求范围'],
      unsupportedClaims: [],
      sourceLabel: 'FALLBACK',
    },
    departmentWorkOrder: {
      departmentId: 'ritual',
      audience: '客户采购负责人',
      goal: '安全回应报价诉求',
      channel: '邮件',
      requestedArtifacts: ['客户回复草稿'],
      requiredEvidence: ['报价依据', '报价有效期'],
      expectedOutputs: ['禁用表达', '下一步'],
      sourceLabel: 'LIVE',
    },
    sourceLabel: 'LIVE',
  });

  assert.equal(result.loopId, 'rites_brand_comms_office_loop_v1');
  assert.equal(result.opinion.department, '礼部');
  assert.equal(result.opinion.brandCommsQuestionType, '正式报价表达');
  assert.equal(result.opinion.sourceLabel, 'MIXED');
  assert.equal(result.opinion.source_label, 'MIXED');
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('锦衣卫事实')));
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('军机处礼部工单')));
  assert.ok(result.opinion.missingEvidence.includes('客户确认需求范围'));
  assert.equal(result.opinion.generatedArtifacts[0]?.artifactType, '客户回复草稿');
  assert.notEqual(result.qualityGate.verdict, 'APPROVE');
});

test('buildRitesDepartmentOpinion 兼容 DepartmentOpinion，并携带礼部明细', () => {
  const departmentOpinion = buildRitesDepartmentOpinion({
    draftEdict: {
      originalQuestion: '招商材料能不能写保底收益？',
      refinedQuestion: '请礼部审查招商话术风险。',
      decisionType: '招商材料审查',
      knownFacts: [],
      unknownGaps: [],
      expectedOutput: ['礼部分奏'],
      sourceLabel: 'MIXED',
    },
    sourceLabel: 'MIXED',
  });

  assert.equal(departmentOpinion.departmentId, 'ritual');
  assert.equal(departmentOpinion.ritesOpinion?.department, '礼部');
  assert.equal(departmentOpinion.ritesOpinion?.messageRiskLevel, 'BLOCKED');
  assert.ok(departmentOpinion.summary.includes('CMO/CCO Office'));
  assert.ok(departmentOpinion.risks.includes('blocked_message_risk'));
  assert.equal(departmentOpinion.needsHumanConfirmation, true);
});

test('分类覆盖品牌定位、公关媒体、竞品回应', () => {
  assert.equal(classifyRitesBrandCommsQuestion('公司官网一句话定位怎么写？'), '品牌定位');
  assert.equal(classifyRitesBrandCommsQuestion('媒体采访公司，哪些话不能说？'), '公关媒体');
  assert.equal(classifyRitesBrandCommsQuestion('竞品说我们不专业，怎么回应？'), '竞品回应');
});
