import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBingbuDepartmentOpinion,
  classifyBingbuSalesRevenueQuestion,
  evaluateBingbuQualityGate,
  runBingbuCROSalesOfficeLoopV1,
  runBingbuCROSalesOfficeReview,
} from './bingbu-cro-sales-office.ts';

test('客户要求正式报价：兵部必须触发户部和刑部，并阻止自动外发', () => {
  const opinion = runBingbuCROSalesOfficeReview({ text: '客户这周要求正式报价，要不要发？', sourceLabel: 'MIXED' });
  assert.equal(opinion.salesRevenueQuestionType, 'QUOTE_STRATEGY');
  assert.equal(opinion.position, '复核');
  assert.ok(opinion.requiredSubOffices.includes('pricing_deal_desk'));
  assert.ok(opinion.crossDepartmentReviews.includes('finance'));
  assert.ok(opinion.crossDepartmentReviews.includes('justice'));
  assert.equal(opinion.maySendExternally, false);
  assert.ok(opinion.humanConfirmationRequired);
  assert.ok(opinion.generatedArtifactsAvailable.includes('报价前检查清单'));
});

test('客户预算和承诺：必须触发锦衣卫来源核验', () => {
  const opinion = runBingbuCROSalesOfficeReview({ text: '客户说有预算并口头承诺下月采购，销售是否继续推进？', sourceLabel: 'MIXED' });
  assert.equal(opinion.salesRevenueQuestionType, 'LEAD_QUALIFICATION');
  assert.ok(opinion.customerClaims.includes('客户预算声明'));
  assert.ok(opinion.customerClaims.includes('客户承诺/确认声明'));
  assert.ok(opinion.crossDepartmentReviews.includes('jinyiwei'));
  assert.ok(opinion.crossDepartmentReviews.includes('justice'));
});

test('竞品更便宜：必须触发锦衣卫、礼部、刑部', () => {
  const opinion = runBingbuCROSalesOfficeReview({ text: '竞品更便宜，销售怎么回应客户？', sourceLabel: 'LIVE' });
  assert.equal(opinion.salesRevenueQuestionType, 'NEGOTIATION_STRATEGY');
  assert.ok(opinion.crossDepartmentReviews.includes('jinyiwei'));
  assert.ok(opinion.crossDepartmentReviews.includes('ritual'));
  assert.ok(opinion.crossDepartmentReviews.includes('justice'));
  assert.ok(opinion.generatedArtifactsAvailable.includes('竞品 battlecard'));
});

test('AI 销售自动发消息：质门阻断自动外发并要求人工确认', () => {
  const opinion = runBingbuCROSalesOfficeReview({ text: 'AI 销售 agent 能不能自动给客户发消息？', sourceLabel: 'MIXED' });
  const gate = evaluateBingbuQualityGate(opinion);
  assert.equal(opinion.salesRevenueQuestionType, 'SALES_ORG_EXECUTION');
  assert.equal(opinion.maySendExternally, false);
  assert.ok(opinion.crossDepartmentReviews.includes('ritual'));
  assert.ok(opinion.humanConfirmationRequired);
  assert.equal(gate.signal, 'RED');
  assert.ok(gate.gateResults.some((item) => item.gate === 'no_auto_send_customer_message' && item.status === 'pass'));
});

test('bingbu_cro_sales_office_loop_v1 接收 confirmed_edict + intelligence_pack + work_order', () => {
  const result = runBingbuCROSalesOfficeLoopV1({
    confirmedEdict: {
      originalQuestion: '客户这周要求正式报价，要不要发？',
      refinedQuestion: '请兵部判断报价策略、销售 owner、商机阶段和跨部门复核。',
      decisionType: '报价与客户推进判断',
      knownFacts: ['客户要求本周获得正式报价'],
      unknownGaps: ['客户确认需求范围'],
      expectedOutput: ['兵部分奏', '报价前检查清单', '唯一下一步'],
      sourceLabel: 'LIVE',
    },
    intelligencePack: {
      departmentId: 'jinyiwei',
      facts: ['客户需求范围尚未签字确认'],
      evidenceBasis: ['历史沟通记录显示客户仍在比较方案'],
      missingEvidence: ['客户预算来源'],
      unsupportedClaims: [],
      sourceLabel: 'FALLBACK',
    },
    departmentWorkOrder: {
      departmentId: 'war',
      focusQuestion: '判断是否允许销售发送正式报价',
      requiredEvidence: ['客户确认需求范围', '成本表', '毛利边界', '报价有效期'],
      expectedOutputs: ['CRO 立场', '唯一销售动作'],
      requestedArtifacts: ['报价前检查清单'],
      sourceLabel: 'LIVE',
    },
    sourceLabel: 'LIVE',
  });

  assert.equal(result.loopId, 'bingbu_cro_sales_office_loop_v1');
  assert.equal(result.opinion.department, '兵部');
  assert.equal(result.opinion.salesRevenueQuestionType, 'QUOTE_STRATEGY');
  assert.equal(result.opinion.sourceLabel, 'MIXED');
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('锦衣卫事实')));
  assert.ok(result.opinion.evidenceUsed.some((item) => item.title.includes('军机处兵部工单')));
  assert.ok(result.opinion.missingEvidence.includes('客户预算来源'));
  assert.equal(result.qualityGate.signal, 'RED');
});

test('buildBingbuDepartmentOpinion 兼容 DepartmentOpinion，并携带兵部明细', () => {
  const departmentOpinion = buildBingbuDepartmentOpinion({
    draftEdict: {
      originalQuestion: '竞品报价更低，销售怎么回应？',
      refinedQuestion: '请兵部判断谈判策略和竞品回应边界。',
      decisionType: '客户推进判断',
      knownFacts: ['客户提到竞品报价更低'],
      unknownGaps: [],
      expectedOutput: [],
      sourceLabel: 'MIXED',
    },
    intelligencePack: {
      departmentId: 'jinyiwei',
      facts: ['竞品报价尚未取得原始来源'],
      evidenceBasis: ['客户转述'],
      missingEvidence: ['竞品报价原件'],
      unsupportedClaims: ['竞品价格低只是客户说法'],
      sourceLabel: 'MIXED',
    },
    departmentWorkOrder: {
      departmentId: 'war',
      focusQuestion: '判断如何回应竞品低价',
      sourceLabel: 'MIXED',
    },
    sourceLabel: 'MIXED',
  });

  assert.equal(departmentOpinion.departmentId, 'war');
  assert.equal(departmentOpinion.warOpinion?.department, '兵部');
  assert.equal(departmentOpinion.warOpinion?.salesRevenueQuestionType, 'NEGOTIATION_STRATEGY');
  assert.ok(departmentOpinion.summary.includes('CRO / Sales / RevOps Office'));
  assert.ok(departmentOpinion.evidence.some((item) => item.includes('锦衣卫事实')));
});

test('分类覆盖线索、商机、渠道、forecast、复盘、客户成功', () => {
  assert.equal(classifyBingbuSalesRevenueQuestion('展会线索怎么优先跟进？'), 'LEAD_QUALIFICATION');
  assert.equal(classifyBingbuSalesRevenueQuestion('这个商机跟了两个月还没下单怎么办？'), 'OPPORTUNITY_REVIEW');
  assert.equal(classifyBingbuSalesRevenueQuestion('渠道代理要求独家怎么办？'), 'CHANNEL_PARTNER');
  assert.equal(classifyBingbuSalesRevenueQuestion('本月 forecast 靠不靠谱？'), 'FORECAST_REVIEW');
  assert.equal(classifyBingbuSalesRevenueQuestion('上次报价为什么被打回？'), 'WIN_LOSS_REVIEW');
  assert.equal(classifyBingbuSalesRevenueQuestion('老客户续约风险高怎么办？'), 'CUSTOMER_SUCCESS_GROWTH');
});
