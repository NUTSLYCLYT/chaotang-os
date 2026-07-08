import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'loops/court_unified_decision.loop.yaml',
  'config/departments.registry.yaml',
  'schemas/DraftEdictV1.json',
  'schemas/ReviewPlanV1.json',
  'schemas/IntelligencePackV1.json',
  'schemas/DepartmentOpinionV1.json',
  'schemas/SwarmBriefV1.json',
  'schemas/ImperialMemorialV1.json',
  'schemas/ReportDownloadManifestV1.json',
  'schemas/EvidenceItemV1.json',
  'schemas/EvidenceAuditV1.json',
  'schemas/ConflictSummaryV1.json',
  'schemas/MemorialV1.json',
  'schemas/QualityGateResultV1.json',
  'schemas/EmperorDecisionV1.json',
  'schemas/ShiguanArchiveRecordV1.json',
  'schemas/EvoMapEventV1.json',
  'evals/courtos_core_loop.golden.jsonl',
  'evals/ministry_output_contracts.golden.jsonl',
  'config/department_boundary_matrix.yaml',
];

const sourceLabels = ['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO'];
const loopSteps = [
  'prepare_home_context',
  'intake_question',
  'chancellor_draft_edict',
  'emperor_confirm_edict',
  'junjichu_plan_review',
  'run_department_reviews',
  'optional_swarm_deepening',
  'evidence_audit',
  'conflict_check',
  'synthesize_memorial',
  'quality_gate',
  'present_to_emperor',
  'emperor_decision',
  'archive_to_shiguan',
  'evomap_update',
];
const protocolDepartments = [
  'jinyiwei_intelligence',
  'hubu_cfo',
  'libu_hr_admin',
  'rites_brand_comms',
  'bingbu_sales',
  'xingbu_legal_risk',
  'gongbu_delivery',
];
const qualityGates = [
  'source_label_required',
  'no_demo_as_live',
  'no_fallback_as_final_certainty',
  'evidence_or_gap_required',
  'high_risk_requires_human_confirmation',
  'conflict_visible',
  'one_primary_action_required',
  'followup_must_inherit_context',
  'archive_required_after_decision',
  'missing_capability_must_be_disclosed',
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
assert(!fs.existsSync(path.join(root, 'config/ritual.cmo_office.registry.yaml')), 'legacy ritual.cmo_office registry must not exist; use rites_brand_comms only');

for (const rel of requiredFiles.filter((item) => item.endsWith('.json'))) {
  const schema = JSON.parse(read(rel));
  const text = JSON.stringify(schema);
  assert(schema.$schema?.includes('json-schema.org'), `${rel} missing JSON Schema declaration`);
  assert(schema.title, `${rel} missing title`);
  assert(text.includes('source_label'), `${rel} must include source_label`);
  for (const label of sourceLabels) assert(text.includes(label), `${rel} missing source label ${label}`);
}

const loop = read('loops/court_unified_decision.loop.yaml');
for (const step of loopSteps) assert(loop.includes(step), `main loop missing protocol step: ${step}`);
for (const gate of qualityGates) assert(loop.includes(gate), `main loop missing quality gate: ${gate}`);
for (const forbidden of ['five_department_review', 'libu_special_review', 'rites_special_review', 'jinyiwei_special_review']) {
  assert(!new RegExp(`id:\\s*${forbidden}`).test(loop), `main loop must not introduce special flow id: ${forbidden}`);
}
assert(
  loop.includes('optional_swarm_deepening') &&
    loop.includes('default_enabled: false') &&
    loop.includes('This Goal 1 protocol does not execute live swarm'),
  'optional swarm deepening must remain disabled protocol placeholder',
);

const registry = read('config/departments.registry.yaml');
for (const protocolId of protocolDepartments) assert(registry.includes(protocolId), `registry missing protocol id: ${protocolId}`);
for (const field of ['type:', 'display_role:', 'review_skill:', 'output_schema:', 'route_keywords:', 'swarm_bundle:', 'default_participation:', 'complexity_profile:', 'user_visible_summary:']) {
  assert(registry.includes(field), `registry missing supported field: ${field}`);
}

const boundaryMatrix = read('config/department_boundary_matrix.yaml');
for (const requiredBoundary of [
  'customer_decision_chain',
  'channel',
  'formal_quote',
  'employment_and_labor',
  'seal_signature_contract',
  'procurement',
  'delivery_commitment',
  'competitor_claim',
]) {
  assert(boundaryMatrix.includes(`id: ${requiredBoundary}`), `boundary matrix missing ${requiredBoundary}`);
}
for (const gate of [
  'customer_fact_owner_required',
  'channel_commercial_owner_required',
  'quote_number_owner_required',
  'personnel_labor_fact_owner_required',
  'signature_authority_owner_required',
  'procurement_domain_owner_required',
  'delivery_commitment_owner_required',
  'competitor_fact_owner_required',
]) {
  assert(boundaryMatrix.includes(`blocking_gate: ${gate}`), `boundary matrix missing blocking gate ${gate}`);
}
assert(registry.includes('id: rites_brand_comms'), 'rites protocol id must avoid libu naming collision');
assert(!registry.includes('id: ritual'), 'registry must not reintroduce legacy ritual id');
for (const protocolId of protocolDepartments.filter((item) => item !== 'gongbu_delivery')) {
  const protocolBlock = new RegExp(`- id: ${protocolId}[\\s\\S]*?enabled: true`);
  assert(protocolBlock.test(registry), `registry protocol department ${protocolId} must be enabled`);
}
assert(/- id: gongbu_delivery[\s\S]*?enabled: false/.test(registry), 'gongbu_delivery must remain disabled placeholder until ready');
for (const forbidden of ['five_department_review', 'libu_special_review', 'rites_special_review', 'gongbu_special_review', 'jinyiwei_special_review']) {
  const forbiddenFlow = new RegExp(`(id|loop|route|flow):\\s*${forbidden}|${forbidden}\\.loop\\.yaml`);
  assert(!forbiddenFlow.test(registry), `registry must not introduce special flow: ${forbidden}`);
}

const goldenLines = read('evals/courtos_core_loop.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 5, 'core loop golden eval must include at least 5 cases');
const seen = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.case_id && item.question, `golden case missing case_id/question: ${line}`);
  assert(!seen.has(item.case_id), `duplicate golden id: ${item.case_id}`);
  seen.add(item.case_id);
  for (const artifact of ['DraftEdictV1', 'ReviewPlanV1', 'MemorialV1']) {
    assert(item.expected_schemas?.includes(artifact), `golden ${item.case_id} must generate ${artifact}`);
  }
  assert(item.assertions?.has_source_label === true, `golden ${item.case_id} must require source label`);
  assert(item.assertions?.has_evidence_or_missing_evidence === true, `golden ${item.case_id} must require evidence or gap`);
  assert(item.assertions?.has_next_order === true, `golden ${item.case_id} must require next order`);
  assert(item.assertions?.can_archive_to_shiguan === true, `golden ${item.case_id} must be archivable`);
  assert(Array.isArray(item.expected_departments) && item.expected_departments.length > 0, `golden ${item.case_id} missing expected departments`);
}

console.log(`CourtOS core protocol contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
