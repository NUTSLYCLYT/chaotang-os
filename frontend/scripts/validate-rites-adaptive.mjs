import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();
const requiredFiles = [
  'schemas/CompanyBrandCommsProfileV1.json',
  'schemas/RitesComplexityProfileV1.json',
  'schemas/RitesAdaptiveInteractionV1.json',
  'config/rites_complexity_profiles.yaml',
  'loops/rites_adaptive_brand_comms.loop.yaml',
  'evals/rites_adaptive_complexity.golden.jsonl',
];

const read = (rel) => contractRead(rel);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const rel of requiredFiles) {
  assert(contractExists(rel), `missing required file: ${rel}`);
}
for (const rel of requiredFiles.filter((item) => item.endsWith('.json'))) {
  JSON.parse(read(rel));
}

const config = read('config/rites_complexity_profiles.yaml');
const modes = [
  'founder_expression_assistant',
  'small_team_marketing',
  'growth_cmo',
  'cmo_cco',
  'enterprise_brand_comms',
];
for (const mode of modes) assert(config.includes(`mode: ${mode}`), `missing rites mode: ${mode}`);
assert(config.includes('defaultView: brief'), 'small founder mode must support brief');
assert(config.includes('exposeSubOfficeStructure: false'), 'small modes must hide sub-office structure by default');
assert(config.includes('reservedCapabilities'), 'enterprise mode must reserve future capabilities');

const escalations = [
  'formal_quote_message_always_involve_hubu_and_xingbu',
  'roi_or_revenue_claim_always_involve_hubu_and_xingbu',
  'legal_contract_or_exclusivity_claim_always_involve_xingbu',
  'crisis_or_media_statement_always_escalate',
  'competitor_claims_require_evidence_and_review',
  'customer_commitment_requires_xingbu_review',
  'delivery_or_capability_claim_requires_relevant_department_review',
  'ai_generated_external_content_requires_review',
  'sensitive_data_requires_permission_guard',
];
for (const rule of escalations) assert(config.includes(rule), `missing escalation rule: ${rule}`);
for (const floor of [
  'high_risk_requires_human_confirmation',
  'xingbu_review_for_external_commitment',
  'hubu_review_for_roi_or_quote_claim',
  'source_label_required',
  'evidence_or_gap_required',
  'message_quality_gate',
  'privacy_sensitive_data_guard',
  'no_auto_send_external_content',
]) {
  assert(config.includes(floor), `missing locked floor: ${floor}`);
}
for (const choice of [
  'brief',
  'management_detail',
  'professional_detail',
  'enter_junjichu_deep_review',
  'generate_artifact',
  'request_department_review',
  'generate_variants',
  'rewrite_for_audience',
  'check_message_risk',
]) {
  assert(config.includes(choice), `missing user choice: ${choice}`);
}

const loop = read('loops/rites_adaptive_brand_comms.loop.yaml');
for (const step of [
  'load_company_brand_profile',
  'determine_rites_mode',
  'classify_brand_comms_question',
  'apply_message_risk_escalation_rules',
  'select_enabled_sub_offices',
  'render_adaptive_interaction',
  'quality_gate',
]) {
  assert(loop.includes(step), `adaptive loop missing step: ${step}`);
}
assert(loop.includes('rites_brand_comms_office_loop_v1'), 'adaptive loop must compose rites_brand_comms_office_loop_v1');
assert(loop.includes('court_unified_decision_loop_v1'), 'adaptive loop must plug into court_unified_decision_loop_v1');

const loopFiles = contractReaddir('loops').filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*rites_(small_company|enterprise|founder|group)_loop/m.test(content), `must not introduce per-size rites loop: ${file}`);
}

const cases = read('evals/rites_adaptive_complexity.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));
assert(cases.length >= 20, 'rites adaptive golden must include at least 20 cases');
const ids = new Set();
for (const item of cases) {
  assert(item.id && item.input, `golden case missing id/input: ${JSON.stringify(item)}`);
  assert(!ids.has(item.id), `duplicate golden id: ${item.id}`);
  ids.add(item.id);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
  assert(typeof item.employee_count === 'number', `golden case missing employee_count: ${item.id}`);
  assert(item.expected_mode, `golden case missing expected_mode: ${item.id}`);
  assert(item.expected_default_view, `golden case missing expected_default_view: ${item.id}`);
}
assert(cases.filter((item) => item.employee_count <= 50).length >= 10, 'must include at least 10 small-company cases');
assert(cases.filter((item) => item.employee_count >= 80).length >= 10, 'must include at least 10 mid/large-company cases');
assert(cases.some((item) => item.expected_mode === 'founder_expression_assistant' && item.expected_default_view === 'brief' && item.expose_sub_office_structure === false), 'founder mode must default brief and hide sub offices');
assert(cases.some((item) => item.employee_count <= 50 && item.must_escalate === true && item.must_human_confirmation === true), 'small high-risk cases must auto-escalate with human confirmation');
assert(cases.some((item) => item.expected_mode === 'cmo_cco' && item.expected_default_view === 'professional_detail'), 'mid-sized CMO/CCO must support professional detail');
assert(cases.some((item) => item.expected_mode === 'enterprise_brand_comms' && Array.isArray(item.expected_reserved)), 'enterprise cases must reserve capabilities');

console.log(`Rites adaptive complexity OK: ${requiredFiles.length} files, ${cases.length} golden cases, 5 modes, ${escalations.length} escalation rules`);
