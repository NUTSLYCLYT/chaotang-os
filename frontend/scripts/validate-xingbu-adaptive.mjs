import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();
const read = (rel) => contractRead(rel);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredFiles = [
  'schemas/CompanyLegalRiskProfileV1.json',
  'schemas/XingbuComplexityProfileV1.json',
  'schemas/XingbuAdaptiveInteractionV1.json',
  'config/xingbu_complexity_profiles.yaml',
  'loops/xingbu_adaptive_clo_cco.loop.yaml',
  'loops/xingbu_clo_cco_office.loop.yaml',
  'evals/xingbu_adaptive_complexity.golden.jsonl',
];

const modes = [
  'founder_legal_safety',
  'small_team_legal_manager',
  'growth_legal_compliance',
  'clo_cco',
  'group_legal_ops',
];

const escalationRules = [
  'contract_signing_always_escalate',
  'external_commitment_always_escalate',
  'equity_or_governance_always_escalate',
  'payment_penalty_or_guarantee_involve_hubu',
  'labor_action_involve_libu',
  'dispute_or_lawyer_letter_involve_dispute_office',
  'ip_or_confidentiality_involve_ip_office',
  'seal_or_signature_involve_legal_ops',
  'compliance_or_license_involve_compliance_office',
  'ai_generated_external_content_involve_junjichu_and_xingbu',
  'privacy_sensitive_data_requires_permission_guard',
];

const userChoices = [
  'brief',
  'management_detail',
  'professional_detail',
  'enter_junjichu_deep_review',
  'generate_artifact',
  'request_department_review',
];

const lockedFloor = [
  'high_risk_requires_human_confirmation',
  'contract_or_commitment_review',
  'equity_or_governance_review',
  'labor_risk_review',
  'source_label_required',
  'evidence_or_gap_required',
  'privacy_sensitive_data_guard',
  'no_irreversible_legal_action_without_approval',
];

for (const rel of requiredFiles) {
  assert(contractExists(rel), `missing required file: ${rel}`);
}
for (const rel of requiredFiles.filter((rel) => rel.endsWith('.json'))) {
  JSON.parse(read(rel));
}

const config = read('config/xingbu_complexity_profiles.yaml');
for (const mode of modes) {
  assert(config.includes(`mode: ${mode}`), `missing mode: ${mode}`);
}
assert(config.includes('headcountBand: "1-10"'), 'missing 1-10 band');
assert(config.includes('defaultView: brief'), 'small company mode must default to brief');
assert(config.includes('exposeSubOfficeStructure: false'), 'small modes must hide sub-office structure');
assert(config.includes('reservedCapabilities'), 'group mode must reserve future capabilities');
for (const rule of escalationRules) {
  assert(config.includes(rule), `config missing escalation rule: ${rule}`);
}
for (const choice of userChoices) {
  assert(config.includes(choice), `config missing user choice: ${choice}`);
}
for (const floor of lockedFloor) {
  assert(config.includes(floor), `config missing locked floor: ${floor}`);
}

const loop = read('loops/xingbu_adaptive_clo_cco.loop.yaml');
for (const step of [
  'load_company_legal_profile',
  'determine_xingbu_mode',
  'classify_legal_risk_question',
  'apply_escalation_rules',
  'select_enabled_sub_offices',
  'render_adaptive_interaction',
  'quality_gate',
]) {
  assert(loop.includes(step), `adaptive loop missing step: ${step}`);
}
assert(loop.includes('xingbu_clo_cco_office_loop_v1'), 'adaptive loop must compose xingbu_clo_cco_office_loop_v1');
assert(loop.includes('court_unified_decision_loop_v1'), 'adaptive loop must plug into court_unified_decision_loop_v1');
for (const rule of escalationRules) {
  assert(loop.includes(rule), `adaptive loop missing escalation rule: ${rule}`);
}

const loopFiles = contractReaddir('loops').filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*xingbu_(small_company|enterprise|founder|group)_loop/m.test(content), `must not introduce per-size loop: ${file}`);
}

const profileSchema = JSON.stringify(JSON.parse(read('schemas/XingbuComplexityProfileV1.json')));
const interactionSchema = JSON.stringify(JSON.parse(read('schemas/XingbuAdaptiveInteractionV1.json')));
for (const mode of modes) {
  assert(profileSchema.includes(mode), `XingbuComplexityProfileV1 missing mode: ${mode}`);
  assert(interactionSchema.includes(mode), `XingbuAdaptiveInteractionV1 missing mode: ${mode}`);
}
for (const floor of lockedFloor) {
  assert(profileSchema.includes(floor), `XingbuComplexityProfileV1 missing floor: ${floor}`);
  assert(interactionSchema.includes(floor), `XingbuAdaptiveInteractionV1 missing floor: ${floor}`);
}

const cases = read('evals/xingbu_adaptive_complexity.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));
assert(cases.length >= 20, 'xingbu adaptive golden must include at least 20 cases');

const ids = new Set();
for (const item of cases) {
  assert(item.id && item.input, `golden case missing id/input: ${JSON.stringify(item)}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  assert(typeof item.employee_count === 'number', `golden case missing employee_count: ${item.id}`);
  assert(item.expected_mode, `golden case missing expected_mode: ${item.id}`);
  assert(item.expected_default_view, `golden case missing expected_default_view: ${item.id}`);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
}

const smallCases = cases.filter((item) => item.employee_count <= 50);
const largeCases = cases.filter((item) => item.employee_count > 50);
assert(smallCases.length >= 10, 'must include at least 10 small-company cases');
assert(largeCases.length >= 10, 'must include at least 10 mid/large-company cases');
assert(smallCases.some((item) => item.expected_default_view === 'brief' && item.expose_sub_office_structure === false), 'small company must default to brief and hide sub-offices');
assert(smallCases.some((item) => item.must_escalate === true && item.must_human_confirmation === true), 'small high-risk cases must auto-escalate with human confirmation');
assert(largeCases.some((item) => item.expected_default_view === 'professional_detail' && item.expose_sub_office_structure === true), 'mid/large cases must allow professional detail');
assert(cases.some((item) => item.expected_escalation?.includes('contract_signing_always_escalate')), 'missing contract signing escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('external_commitment_always_escalate')), 'missing external commitment escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('equity_or_governance_always_escalate')), 'missing equity escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('payment_penalty_or_guarantee_involve_hubu')), 'missing hubu payment escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('labor_action_involve_libu')), 'missing libu labor escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('dispute_or_lawyer_letter_involve_dispute_office')), 'missing dispute escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('ip_or_confidentiality_involve_ip_office')), 'missing IP escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('seal_or_signature_involve_legal_ops')), 'missing legal ops escalation case');
assert(cases.some((item) => item.expected_escalation?.includes('ai_generated_external_content_involve_junjichu_and_xingbu')), 'missing AI external output escalation case');
assert(cases.some((item) => item.expected_reserved?.includes('Data_Privacy')), 'missing group Data Privacy reservation case');
assert(cases.some((item) => item.expected_reserved?.includes('AI_Governance')), 'missing group AI Governance reservation case');

console.log(`Xingbu adaptive complexity OK: ${requiredFiles.length} files, ${cases.length} golden cases, 5 modes, ${escalationRules.length} escalation rules`);
