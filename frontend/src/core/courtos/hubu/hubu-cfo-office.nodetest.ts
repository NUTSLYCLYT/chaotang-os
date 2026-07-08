import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHubuDepartmentOpinion, classifyHubuFinanceQuestion, evaluateHubuQualityGate, runHubuCFOOfficeLoopV1, runHubuCFOOfficeReview } from './hubu-cfo-office.ts';

test('客户要求正式报价：必须补成本、毛利、付款条件、有效期', () => {
  const opinion = runHubuCFOOfficeReview({ text: '客户这周要求我们给正式报价，要不要发？', sourceLabel: 'MIXED' });
  assert.equal(opinion.financeQuestionType, '报价审查');
  assert.equal(opinion.cfoPosition, '补证');
  assert.ok(opinion.requiredSubOffices.includes('cost_pricing'));
  assert.ok(opinion.requiredSubOffices.includes('treasury_cash'));
  assert.ok(opinion.requiredSubOffices.includes('audit_control'));
  for (const gap of ['成本表', '目标毛利率', '付款条件', '报价有效期']) {
    assert.ok(opinion.missingEvidence.includes(gap), gap);
  }
  assert.match(opinion.recommendedNextAction, /成本表/);
});

test('AI 公司合作投资：必须识别投入、ROI、最坏情况、止损点', () => {
  const opinion = runHubuCFOOfficeReview({
    text: '请判断厦门 AI 公司合作是否值得推进，重点看投入边界、股权风险、销售打法和 90 天执行路径。',
    sourceLabel: 'MIXED',
  });
  assert.equal(opinion.financeQuestionType, '投资评审');
  assert.ok(opinion.requiredSubOffices.includes('investment_review'));
  assert.ok(opinion.requiredSubOffices.includes('fpna_budget'));
  assert.ok(opinion.missingEvidence.includes('ROI 假设'));
  assert.ok(opinion.missingEvidence.includes('最坏情况'));
  assert.ok(opinion.missingEvidence.includes('止损点'));
});

test('招聘大客户销售负责人：必须看薪酬预算、回本逻辑、现金影响、止损', () => {
  const opinion = runHubuCFOOfficeReview({ text: '我们要不要现在招聘一个大客户销售负责人？', sourceLabel: 'MIXED' });
  assert.equal(opinion.financeQuestionType, '招聘/组织成本判断');
  assert.ok(opinion.requiredSubOffices.includes('fpna_budget'));
  assert.ok(opinion.requiredSubOffices.includes('treasury_cash'));
  assert.ok(opinion.missingEvidence.includes('薪酬预算'));
  assert.ok(opinion.missingEvidence.includes('回本逻辑'));
  assert.ok(opinion.missingEvidence.includes('试用期止损条件'));
});

test('合作合同：户部必须审付款、收入确认、违约金、现金影响并人工确认', () => {
  const opinion = runHubuCFOOfficeReview({ text: '这个合作合同能不能直接签？', sourceLabel: 'MIXED' });
  assert.equal(opinion.financeQuestionType, '合同财务条款审查');
  assert.ok(opinion.humanConfirmationRequired);
  assert.ok(opinion.requiredSubOffices.includes('treasury_cash'));
  assert.ok(opinion.requiredSubOffices.includes('controller_books'));
  assert.ok(opinion.requiredSubOffices.includes('audit_control'));
});

test('质量门：FALLBACK/DEMO 和缺数字不得准奏', () => {
  const opinion = runHubuCFOOfficeReview({ text: '客户这周要求我们给正式报价，要不要发？', sourceLabel: 'FALLBACK' });
  const gate = evaluateHubuQualityGate(opinion);
  assert.notEqual(gate.verdict, 'APPROVE');
  assert.notEqual(gate.signal, 'GREEN');
});

test('统一部门意见兼容 DepartmentOpinion，并携带 CFO 明细', () => {
  const departmentOpinion = buildHubuDepartmentOpinion({
    draftEdict: {
      originalQuestion: '客户这周要求我们给正式报价，要不要发？',
      refinedQuestion: '请军机处会审报价。',
      decisionType: '报价与投入判断',
      knownFacts: [],
      unknownGaps: [],
      expectedOutput: [],
      sourceLabel: 'MIXED',
    },
    sourceLabel: 'MIXED',
  });
  assert.equal(departmentOpinion.departmentId, 'finance');
  assert.equal(departmentOpinion.cfoOpinion?.department, '户部');
  assert.equal(departmentOpinion.cfoOpinion?.financeQuestionType, '报价审查');
  assert.ok(departmentOpinion.summary.includes('CFO Office'));
});

test('hubu_cfo_office_loop_v1 接收 confirmed_edict + intelligence_pack + work_order', () => {
  const result = runHubuCFOOfficeLoopV1({
    confirmedEdict: {
      originalQuestion: '客户这周要求我们给正式报价，要不要发？',
      refinedQuestion: '请户部审查正式报价的成本、毛利、付款条件和报价有效期。',
      decisionType: '报价审查',
      knownFacts: ['客户要求本周获得正式报价'],
      unknownGaps: ['报价审批人'],
      expectedOutput: ['户部分奏', '缺证清单', '下一步'],
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
      departmentId: 'finance',
      focusQuestion: '判断是否允许发送正式报价',
      requiredEvidence: ['成本表', '目标毛利率', '付款条件', '报价有效期'],
      expectedOutputs: ['CFO 立场', '唯一下一步'],
      sourceLabel: 'LIVE',
    },
    sourceLabel: 'LIVE',
  });

  assert.equal(result.loopId, 'hubu_cfo_office_loop_v1');
  assert.equal(result.opinion.department, '户部');
  assert.equal(result.opinion.financeQuestionType, '报价审查');
  assert.equal(result.opinion.sourceLabel, 'MIXED');
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('锦衣卫事实')));
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('军机处户部工单')));
  assert.ok(result.opinion.missingEvidence.includes('客户确认需求范围'));
  assert.notEqual(result.qualityGate.verdict, 'APPROVE');
});

test('buildHubuDepartmentOpinion 可透传情报包和户部工单', () => {
  const departmentOpinion = buildHubuDepartmentOpinion({
    draftEdict: {
      originalQuestion: '是否投资这个 AI 合作项目？',
      refinedQuestion: '请户部审查投入预算、ROI、最坏情况和止损点。',
      decisionType: '投资评审',
      knownFacts: ['合作方要求我们先投入资源'],
      unknownGaps: [],
      expectedOutput: [],
      sourceLabel: 'MIXED',
    },
    intelligencePack: {
      departmentId: 'jinyiwei',
      facts: ['对方尚未提供正式商业计划'],
      evidenceBasis: ['访谈记录'],
      missingEvidence: ['商业计划书'],
      unsupportedClaims: [],
      sourceLabel: 'MIXED',
    },
    departmentWorkOrder: {
      departmentId: 'finance',
      focusQuestion: '判断该投资是否进入下一轮复核',
      sourceLabel: 'MIXED',
    },
    sourceLabel: 'MIXED',
  });

  assert.equal(departmentOpinion.departmentId, 'finance');
  assert.equal(departmentOpinion.cfoOpinion?.financeQuestionType, '投资评审');
  assert.ok(departmentOpinion.evidence.some((item) => item.includes('锦衣卫事实')));
  assert.ok(departmentOpinion.missingEvidence.includes('商业计划书'));
});

test('分类覆盖预算、现金、经营复盘', () => {
  assert.equal(classifyHubuFinanceQuestion('这个费用预算要不要批？'), '预算审批');
  assert.equal(classifyHubuFinanceQuestion('现金流还能撑多久？'), '现金流判断');
  assert.equal(classifyHubuFinanceQuestion('上月经营复盘和预算偏差怎么看？'), '经营复盘');
});
