import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/bingbu.cro_sales_office.registry.yaml',
  'loops/bingbu_cro_sales_office.loop.yaml',
  'schemas/BingbuCROOpinionV1.json',
  'schemas/BingbuSubOfficeReviewV1.json',
  'schemas/SalesEvidencePackV1.json',
  'schemas/DealStrategyV1.json',
  'schemas/OpportunityReviewV1.json',
  'schemas/RevenueForecastV1.json',
  'schemas/BingbuInteractionCardV1.json',
  'schemas/BingbuGeneratedArtifactV1.json',
  'schemas/BingbuQualityGateResultV1.json',
  'schemas/SalesRiskPolicyV1.json',
  'prompts/departments/bingbu/cro_chief.system.md',
  'prompts/departments/bingbu/gtm_strategy.system.md',
  'prompts/departments/bingbu/opportunity_pipeline.system.md',
  'prompts/departments/bingbu/key_account_attack.system.md',
  'prompts/departments/bingbu/pricing_deal_desk.system.md',
  'prompts/departments/bingbu/channel_partner.system.md',
  'prompts/departments/bingbu/sales_revops.system.md',
  'prompts/departments/bingbu/customer_success_growth.system.md',
  'prompts/departments/bingbu/quality_gate.system.md',
  'evals/bingbu_cro_sales_office.golden.jsonl',
];

const p0Offices = ['兵部尚书', '布阵司', '商机司', '攻坚司', '价策司', '渠道司', '销运司', '客成司'];
const reservedOffices = ['标书司', '赋能司', '数据司', '国际司', '生态司', 'AI 销售司'];
const questionTypes = ['LEAD_QUALIFICATION', 'OPPORTUNITY_REVIEW', 'ACCOUNT_STRATEGY', 'QUOTE_STRATEGY', 'NEGOTIATION_STRATEGY', 'CHANNEL_PARTNER', 'FORECAST_REVIEW', 'WIN_LOSS_REVIEW', 'CUSTOMER_SUCCESS_GROWTH', 'SALES_ORG_EXECUTION'];
const qualityGates = ['source_label_required', 'customer_claims_require_source', 'opportunity_stage_requires_evidence', 'forecast_requires_stage_and_evidence', 'formal_quote_requires_hubu_and_xingbu_review', 'discount_requires_margin_boundary', 'roi_or_revenue_claim_requires_hubu_review', 'external_commitment_requires_xingbu_review', 'customer_message_requires_rites_review_when_high_risk', 'competitor_claims_require_jinyiwei_evidence', 'no_unverified_customer_budget_claim', 'no_price_or_delivery_commitment_without_review', 'no_auto_send_customer_message', 'one_primary_sales_action_required', 'privacy_sensitive_crm_data_guard', 'sales_owner_or_gap_required', 'win_loss_reason_requires_evidence_or_gap'];
const artifacts = ['客户跟进方案', '销售下一步行动卡', '客户会议计划', 'Discovery 问题清单', '客户决策链图', '大客户攻坚计划', '谈判策略', '报价前检查清单', '报价策略草案', '折扣审批建议', '客户回复草稿', '竞品 battlecard', '商机评分卡', 'Pipeline 风险表', 'Forecast 解释卡', 'Win/Loss 复盘', '渠道伙伴计划', '渠道政策草案', '续约/复购计划', '客户成功 QBR 大纲', '销售周会 agenda', '销售 playbook 片段', 'CRM 更新建议', '销售提成建议'];

function read(rel) {
  return contractRead(rel);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const rel of requiredFiles) {
  assert(contractExists(rel), `missing required file: ${rel}`);
}

for (const rel of requiredFiles.filter((item) => item.endsWith('.json'))) {
  JSON.parse(read(rel));
}

const departmentsRegistry = read('config/departments.registry.yaml');
assert(departmentsRegistry.includes('id: war'), 'departments registry must include war department');
assert(departmentsRegistry.includes('CRO Office + Sales / RevOps Office'), 'war department must be CRO Office + Sales / RevOps Office');
assert(departmentsRegistry.includes('skill.department.bingbu.cro_sales_office_review'), 'war department must use bingbu CRO skill');

const registry = read('config/bingbu.cro_sales_office.registry.yaml');
assert(registry.includes('court_unified_decision_loop_v1'), 'bingbu registry must attach to unified loop');
assert(registry.includes('不创建 bingbu_special_review'), 'bingbu registry must forbid special review');
for (const token of p0Offices) assert(registry.includes(token), `bingbu registry missing P0 office: ${token}`);
for (const token of reservedOffices) assert(registry.includes(token), `bingbu registry missing reserved office: ${token}`);
for (const field of ['id', 'name', 'purpose', 'trigger', 'inputs', 'must_answer', 'must_not', 'tools_allowed', 'tools_forbidden', 'output_schema', 'quality_gates', 'eval_cases']) {
  assert(registry.includes(`${field}:`), `bingbu Swarm Card missing field: ${field}`);
}
for (const questionType of questionTypes) assert(registry.includes(questionType), `bingbu registry missing question type: ${questionType}`);
for (const gate of qualityGates) assert(registry.includes(gate), `bingbu registry missing quality gate: ${gate}`);
for (const artifact of artifacts) assert(registry.includes(artifact), `bingbu registry missing artifact type: ${artifact}`);

const loopFiles = contractReaddir('loops').filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  assert(!/^id:\s*bingbu_special_review/m.test(read('loops/' + file)), `loop must not introduce bingbu_special_review: ${file}`);
}

const loop = read('loops/bingbu_cro_sales_office.loop.yaml');
assert(loop.includes('court_unified_decision_loop_v1'), 'bingbu loop must attach to unified court loop');
for (const step of ['receive_bingbu_work_order', 'classify_sales_revenue_question', 'collect_sales_evidence', 'run_bingbu_sub_offices', 'synthesize_cro_position', 'bingbu_quality_gate', 'return_to_junjichu']) {
  assert(loop.includes(step), `bingbu loop missing step: ${step}`);
}
for (const gate of qualityGates) assert(loop.includes(gate) || registry.includes(gate), `bingbu loop/registry missing gate: ${gate}`);

const opinionSchema = JSON.stringify(JSON.parse(read('schemas/BingbuCROOpinionV1.json')));
for (const token of ['sourceLabel', 'source_label', 'salesOwnerOrGap', 'opportunityStageOrGap', 'onePrimarySalesAction', 'maySendExternally', '"const":false']) {
  assert(opinionSchema.includes(token), `BingbuCROOpinionV1 missing ${token}`);
}
const evidencePackSchema = JSON.stringify(JSON.parse(read('schemas/SalesEvidencePackV1.json')));
for (const token of ['customer_claims', 'opportunity_stage', 'evidence_used', 'missing_evidence']) {
  assert(evidencePackSchema.includes(token), `SalesEvidencePackV1 missing ${token}`);
}
const artifactSchema = JSON.stringify(JSON.parse(read('schemas/BingbuGeneratedArtifactV1.json')));
for (const artifact of artifacts) assert(artifactSchema.includes(artifact), `BingbuGeneratedArtifactV1 missing artifact type: ${artifact}`);

const goldenLines = read('evals/bingbu_cro_sales_office.golden.jsonl').split('\n').map((line) => line.trim()).filter(Boolean);
assert(goldenLines.length >= 20, 'bingbu golden eval must include at least 20 cases');
const ids = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  assert(questionTypes.includes(item.must_question_type), `golden case has invalid question type: ${item.id}`);
  for (const flag of ['source_label_required', 'sales_owner_or_owner_gap_required', 'evidence_or_gap_required', 'opportunity_stage_or_stage_gap_required', 'customer_claims_require_source', 'high_risk_requires_human_confirmation', 'one_primary_sales_action_required', 'must_support_generated_artifact', 'no_auto_send_customer_message', 'must_archivable']) {
    assert(item[flag] === true, `golden case ${item.id} must set ${flag}=true`);
  }
}

console.log(`Bingbu CRO/Sales/RevOps Office contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
