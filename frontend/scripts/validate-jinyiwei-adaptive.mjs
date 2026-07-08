import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'loops/court_unified_decision.loop.yaml',
  'loops/jinyiwei_intelligence_office.loop.yaml',
  'loops/jinyiwei_adaptive_intelligence.loop.yaml',
  'config/departments.registry.yaml',
  'config/jinyiwei_complexity_profiles.yaml',
  'schemas/JinyiweiIntelligenceOpinionV1.json',
  'schemas/IntelligencePackV1.json',
  'schemas/CompanyIntelligenceProfileV1.json',
  'schemas/JinyiweiComplexityProfileV1.json',
  'schemas/JinyiweiAdaptiveInteractionV1.json',
  'evals/jinyiwei_intelligence_office.golden.jsonl',
  'evals/jinyiwei_adaptive_complexity.golden.jsonl',
];

const modes = [
  'founder_info_assistant',
  'small_team_research',
  'growth_intelligence',
  'chief_intelligence_office',
  'enterprise_intelligence_governance',
];

const adaptiveSteps = [
  'load_company_intelligence_profile',
  'determine_jinyiwei_mode',
  'classify_intelligence_question',
  'apply_intelligence_risk_escalation_rules',
  'select_enabled_sub_offices',
  'render_adaptive_interaction',
  'quality_gate',
];

const escalationRules = [
  'customer_commitment_requires_source_verification',
  'competitor_claims_require_evidence',
  'policy_claim_requires_current_source',
  'financial_or_roi_data_requires_hubu_review',
  'legal_or_compliance_info_requires_xingbu_review',
  'external_message_requires_rites_review',
  'people_info_requires_privacy_guard',
  'stale_info_requires_warning',
  'source_conflict_requires_conflict_summary',
  'rumor_must_not_be_treated_as_fact',
];

const userChoices = [
  'brief',
  'evidence_detail',
  'professional_detail',
  'enter_junjichu_deep_review',
  'generate_intelligence_pack',
  'generate_competitor_compare',
  'generate_customer_intel_card',
  'setup_watchlist',
  'request_source_verification',
];

const lockedFloor = [
  'source_label_required',
  'evidence_or_gap_required',
  'source_reliability_required',
  'privacy_sensitive_data_guard',
  'no_unauthorized_collection',
  'no_unverified_claims',
  'stale_info_must_be_marked',
];

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

const config = read('config/jinyiwei_complexity_profiles.yaml');
for (const mode of modes) {
  assert(config.includes(`mode: ${mode}`), `jinyiwei complexity config missing mode: ${mode}`);
}
for (const text of [
  'headcountBand: "1-10"',
  'headcountBand: "10-50"',
  'headcountBand: "50-200"',
  'headcountBand: "200-1000"',
  'headcountBand: "1000+"',
  'defaultView: brief',
  'exposeSubOfficeStructure: false',
  'Knowledge_Graph',
  'Automated_Monitoring',
  'Intelligence_Access_Control',
]) {
  assert(config.includes(text), `jinyiwei complexity config missing token: ${text}`);
}
for (const office of [
  'intelligence_chief',
  'requirements_planning',
  'open_source_research',
  'customer_intel',
  'competitor_intel',
  'archive_recall',
  'fact_verification',
  'early_warning',
]) {
  assert(config.includes(office), `jinyiwei complexity config missing office: ${office}`);
}
for (const rule of escalationRules) {
  assert(config.includes(`id: ${rule}`), `jinyiwei complexity config missing escalation rule: ${rule}`);
}
for (const choice of userChoices) {
  assert(config.includes(`- ${choice}`), `jinyiwei complexity config missing user choice: ${choice}`);
}
for (const gate of lockedFloor) {
  assert(config.includes(`- ${gate}`), `jinyiwei complexity config missing non-negotiable gate: ${gate}`);
}

const adaptiveLoop = read('loops/jinyiwei_adaptive_intelligence.loop.yaml');
assert(adaptiveLoop.includes('court_unified_decision_loop_v1'), 'adaptive loop must stay attached to unified decision loop');
assert(adaptiveLoop.includes('jinyiwei_intelligence_office_loop_v1'), 'adaptive loop must reuse jinyiwei_intelligence_office_loop_v1');
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
  assert(!/^id:\s*jinyiwei_small_company_loop/m.test(content), `must not create jinyiwei_small_company_loop: ${file}`);
  assert(!/^id:\s*jinyiwei_enterprise_loop/m.test(content), `must not create jinyiwei_enterprise_loop: ${file}`);
  assert(!/^id:\s*jinyiwei_special_review/m.test(content), `must not create jinyiwei_special_review: ${file}`);
}

const companyProfileSchema = JSON.stringify(JSON.parse(read('schemas/CompanyIntelligenceProfileV1.json')));
const complexitySchema = JSON.stringify(JSON.parse(read('schemas/JinyiweiComplexityProfileV1.json')));
const adaptiveSchema = JSON.stringify(JSON.parse(read('schemas/JinyiweiAdaptiveInteractionV1.json')));
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

const goldenLines = read('evals/jinyiwei_adaptive_complexity.golden.jsonl').split('\n').map((line) => line.trim()).filter(Boolean);
assert(goldenLines.length >= 20, 'jinyiwei adaptive golden eval must include at least 20 cases');
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
  assert(['brief', 'evidence_detail', 'professional_detail'].includes(item.expected_default_view), `golden case ${item.id} has invalid expected_default_view`);
  for (const flag of lockedFloor) {
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
assert(highRiskSmallCount >= 5, 'adaptive golden eval must include high-risk small-company escalation cases');
assert(professionalCount >= 8, 'mid/large-company cases must support professional detail');

console.log(`Jinyiwei adaptive complexity contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
