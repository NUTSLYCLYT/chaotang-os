import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();
const read = (rel) => contractRead(rel);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredFiles = [
  'loops/court_unified_decision.loop.yaml',
  'loops/bingbu_cro_sales_office.loop.yaml',
  'loops/bingbu_adaptive_cro_sales.loop.yaml',
  'config/departments.registry.yaml',
  'config/bingbu_complexity_profiles.yaml',
  'schemas/BingbuCROOpinionV1.json',
  'schemas/BingbuSubOfficeReviewV1.json',
  'schemas/CompanyRevenueProfileV1.json',
  'schemas/BingbuComplexityProfileV1.json',
  'schemas/BingbuAdaptiveInteractionV1.json',
  'evals/bingbu_cro_sales_office.golden.jsonl',
  'evals/bingbu_adaptive_complexity.golden.jsonl',
];

const modes = [
  'founder_sales_assistant',
  'small_team_sales_manager',
  'growth_sales_engine',
  'cro_revops',
  'enterprise_revenue_governance',
];

const adaptiveSteps = [
  'load_company_revenue_profile',
  'determine_bingbu_mode',
  'classify_sales_revenue_question',
  'apply_sales_risk_escalation_rules',
  'select_enabled_sub_offices',
  'render_adaptive_interaction',
  'quality_gate',
];

const escalationRules = [
  'formal_quote_always_involve_hubu_and_xingbu',
  'discount_or_margin_boundary_always_involve_hubu',
  'roi_or_revenue_claim_always_involve_hubu_and_rites_and_xingbu',
  'legal_contract_exclusivity_or_payment_always_involve_xingbu',
  'customer_commitment_always_involve_jinyiwei_and_xingbu',
  'competitor_claim_always_involve_jinyiwei_and_rites_and_xingbu',
  'delivery_or_capability_claim_requires_relevant_department_or_capability_gap',
  'sales_compensation_always_involve_libu_and_hubu',
  'channel_partner_agreement_always_involve_hubu_and_xingbu',
  'ai_sales_message_requires_rites_review_and_human_confirmation',
];

const userChoices = [
  'brief',
  'management_detail',
  'professional_detail',
  'enter_junjichu_deep_review',
  'generate_sales_artifact',
  'request_department_review',
  'generate_followup_message',
  'generate_quote_checklist',
  'generate_account_plan',
  'check_deal_risk',
];

const lockedFloor = [
  'high_risk_requires_human_confirmation',
  'hubu_review_for_quote_discount_roi',
  'xingbu_review_for_contract_commitment_exclusivity',
  'rites_review_for_external_message',
  'jinyiwei_review_for_customer_claim_or_competitor_claim',
  'source_label_required',
  'evidence_or_gap_required',
  'no_auto_send_customer_message',
];

for (const rel of requiredFiles) {
  assert(contractExists(rel), `missing required file: ${rel}`);
}
for (const rel of requiredFiles.filter((item) => item.endsWith('.json'))) {
  JSON.parse(read(rel));
}

const departmentsRegistry = read('config/departments.registry.yaml');
assert(departmentsRegistry.includes('id: war'), 'departments registry must include war department');
assert(departmentsRegistry.includes('CRO Office + Sales / RevOps Office'), 'war department must remain CRO / RevOps');

const baseLoop = read('loops/bingbu_cro_sales_office.loop.yaml');
assert(baseLoop.includes('bingbu_cro_sales_office_loop_v1'), 'must keep existing bingbu_cro_sales_office_loop_v1');
assert(baseLoop.includes('court_unified_decision_loop_v1'), 'base loop must attach to unified decision loop');

const config = read('config/bingbu_complexity_profiles.yaml');
for (const mode of modes) {
  assert(config.includes(`mode: ${mode}`), `bingbu complexity config missing mode: ${mode}`);
}
for (const text of [
  'headcountBand: "1-10"',
  'headcountBand: "10-50"',
  'headcountBand: "50-200"',
  'headcountBand: "200-1000"',
  'headcountBand: "1000+"',
  'defaultView: brief',
  'exposeSubOfficeStructure: false',
  'Regional_Sales',
  'RevOps_Data_Governance',
  'AI_Sales_Governance',
]) {
  assert(config.includes(text), `bingbu complexity config missing token: ${text}`);
}
for (const office of [
  'cro_chief',
  'gtm_strategy',
  'opportunity_pipeline',
  'key_account_attack',
  'pricing_deal_desk',
  'channel_partner',
  'sales_revops',
  'customer_success_growth',
]) {
  assert(config.includes(office), `bingbu complexity config missing office: ${office}`);
}
for (const rule of escalationRules) {
  assert(config.includes(`id: ${rule}`), `bingbu complexity config missing escalation rule: ${rule}`);
}
for (const choice of userChoices) {
  assert(config.includes(`- ${choice}`), `bingbu complexity config missing user choice: ${choice}`);
}
for (const gate of lockedFloor) {
  assert(config.includes(`- ${gate}`), `bingbu complexity config missing non-negotiable gate: ${gate}`);
}

const adaptiveLoop = read('loops/bingbu_adaptive_cro_sales.loop.yaml');
assert(adaptiveLoop.includes('court_unified_decision_loop_v1'), 'adaptive loop must stay attached to unified decision loop');
assert(adaptiveLoop.includes('bingbu_cro_sales_office_loop_v1'), 'adaptive loop must reuse bingbu_cro_sales_office_loop_v1');
for (const step of adaptiveSteps) {
  assert(adaptiveLoop.includes(step), `adaptive loop missing step: ${step}`);
}
for (const rule of escalationRules) {
  assert(adaptiveLoop.includes(rule), `adaptive loop missing escalation rule: ${rule}`);
}
for (const gate of lockedFloor) {
  assert(adaptiveLoop.includes(gate), `adaptive loop missing locked floor gate: ${gate}`);
}

const loopFiles = contractReaddir('loops').filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*bingbu_small_company_loop/m.test(content), `must not create bingbu_small_company_loop: ${file}`);
  assert(!/^id:\s*bingbu_enterprise_loop/m.test(content), `must not create bingbu_enterprise_loop: ${file}`);
  assert(!/^id:\s*bingbu_special_review/m.test(content), `must not create bingbu_special_review: ${file}`);
}

const companyProfileSchema = JSON.stringify(JSON.parse(read('schemas/CompanyRevenueProfileV1.json')));
const complexitySchema = JSON.stringify(JSON.parse(read('schemas/BingbuComplexityProfileV1.json')));
const adaptiveSchema = JSON.stringify(JSON.parse(read('schemas/BingbuAdaptiveInteractionV1.json')));
for (const mode of modes) {
  assert(companyProfileSchema.includes(mode) || complexitySchema.includes(mode), `schemas missing mode: ${mode}`);
  assert(adaptiveSchema.includes(mode), `adaptive interaction schema missing mode: ${mode}`);
}
for (const choice of userChoices) {
  assert(adaptiveSchema.includes(choice), `adaptive interaction schema missing user choice: ${choice}`);
}
for (const gate of lockedFloor) {
  assert(complexitySchema.includes(gate), `complexity schema missing locked floor gate: ${gate}`);
  assert(adaptiveSchema.includes(gate), `adaptive interaction schema missing locked floor gate: ${gate}`);
}
assert(adaptiveSchema.includes('"const":false'), 'adaptive interaction must forbid auto-send customer messages');

const goldenLines = read('evals/bingbu_adaptive_complexity.golden.jsonl').split('\n').map((line) => line.trim()).filter(Boolean);
assert(goldenLines.length >= 20, 'bingbu adaptive golden eval must include at least 20 cases');
const ids = new Set();
let smallCompanyCount = 0;
let midLargeCompanyCount = 0;
let highRiskSmallCount = 0;
let professionalCount = 0;

for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  assert(modes.includes(item.expected_mode), `golden case ${item.id} has invalid expected_mode`);
  assert(['brief', 'management_detail', 'professional_detail'].includes(item.expected_default_view), `golden case ${item.id} has invalid expected_default_view`);
  for (const flag of ['source_label_required', 'evidence_or_gap_required', 'no_auto_send_customer_message']) {
    assert(item[flag] === true, `golden case ${item.id} must set ${flag}=true`);
  }
  if (item.employee_count <= 40) {
    smallCompanyCount += 1;
    assert(item.expose_sub_office_structure === false, `small company case must not expose sub office structure: ${item.id}`);
    assert(item.expected_default_view === 'brief', `small company case must default brief: ${item.id}`);
    if (item.must_escalate === true) highRiskSmallCount += 1;
  }
  if (item.employee_count >= 80) {
    midLargeCompanyCount += 1;
    if (item.expected_default_view === 'professional_detail' || item.expected_user_choices?.includes('professional_detail')) {
      professionalCount += 1;
    }
  }
  if (item.must_escalate === true) {
    assert(Array.isArray(item.expected_escalation) && item.expected_escalation.length > 0, `escalating case missing expected_escalation: ${item.id}`);
  }
}

assert(smallCompanyCount >= 10, 'adaptive golden eval must include at least 10 small-company cases');
assert(midLargeCompanyCount >= 10, 'adaptive golden eval must include at least 10 mid/large-company cases');
assert(highRiskSmallCount >= 6, 'adaptive golden eval must include high-risk small-company escalation cases');
assert(professionalCount >= 8, 'mid/large-company cases must support professional detail');
for (const rule of escalationRules) {
  assert(goldenLines.some((line) => line.includes(rule)), `golden eval missing escalation coverage: ${rule}`);
}
assert(goldenLines.some((line) => line.includes('RevOps_Data_Governance')), 'golden eval missing RevOps data governance reservation');
assert(goldenLines.some((line) => line.includes('AI_Sales_Governance')), 'golden eval missing AI Sales Governance reservation');

console.log(`Bingbu adaptive complexity contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
