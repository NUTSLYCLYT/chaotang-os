import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'schemas/DepartmentOpinionV1.json',
  'schemas/SwarmBriefV1.json',
  'schemas/ImperialMemorialV1.json',
  'schemas/ReportDownloadManifestV1.json',
  'schemas/MemorialV1.json',
  'config/ministry_output_contracts.yaml',
  'config/departments.registry.yaml',
  'evals/ministry_output_contracts.golden.jsonl',
];

const sourceLabels = ['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO'];
const departments = ['jinyiwei', 'finance', 'ritual', 'war', 'personnel', 'justice', 'works'];
const departmentFields = [
  'schema_version',
  'department_id',
  'department_name',
  'role_summary',
  'verdict',
  'signal',
  'one_sentence',
  'key_findings',
  'evidence_used',
  'missing_evidence',
  'risks',
  'conflicts',
  'recommended_actions',
  'conditions_to_proceed',
  'needs_human_confirmation',
  'source_label',
];
const reportFields = [
  'one_sentence_verdict',
  'verdict',
  'overall_signal',
  'next_best_action',
  'ministry_signals',
  'department_summaries',
  'evidence_chain',
  'missing_evidence',
  'risk_register',
  'conflicts',
  'quality_gate',
  'decision_actions',
  'downloadable_artifacts',
  'source_label',
];
const formats = ['PDF', 'DOCX', 'JSON', 'EVIDENCE_ZIP'];

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
  const schema = JSON.parse(read(rel));
  const text = JSON.stringify(schema);
  assert(schema.$schema?.includes('json-schema.org'), `${rel} missing JSON Schema declaration`);
  assert(schema.title, `${rel} missing title`);
  assert(text.includes('source_label'), `${rel} must include source_label`);
  for (const label of sourceLabels) assert(text.includes(label), `${rel} missing source label ${label}`);
}

const departmentSchema = JSON.stringify(JSON.parse(read('schemas/DepartmentOpinionV1.json')));
for (const field of departmentFields) assert(departmentSchema.includes(field), `DepartmentOpinionV1 missing field: ${field}`);
for (const value of ['APPROVE', 'NEED_EVIDENCE', 'RECHECK', 'REJECT', 'GREEN', 'YELLOW', 'RED', 'GRAY']) {
  assert(departmentSchema.includes(value), `DepartmentOpinionV1 missing enum value: ${value}`);
}

const swarmSchema = JSON.stringify(JSON.parse(read('schemas/SwarmBriefV1.json')));
for (const field of ['selected_swarms', 'evidence_chain', 'swarm_findings', 'red_team_challenges', 'unsupported_claims', 'quality_gate_result', 'user_facing_trace']) {
  assert(swarmSchema.includes(field), `SwarmBriefV1 missing field: ${field}`);
}
assert(swarmSchema.includes('LIVE_SWARM'), 'SwarmBriefV1 must support LIVE_SWARM');

const reportSchema = JSON.stringify(JSON.parse(read('schemas/ImperialMemorialV1.json')));
for (const field of reportFields) assert(reportSchema.includes(field), `ImperialMemorialV1 missing field: ${field}`);
for (const action of ['accept', 'request_evidence', 'request_recheck', 'reject', 'follow_up', 'human_confirm_then_archive']) {
  assert(reportSchema.includes(action), `ImperialMemorialV1 missing decision action: ${action}`);
}

const downloadSchema = JSON.stringify(JSON.parse(read('schemas/ReportDownloadManifestV1.json')));
for (const format of formats) assert(downloadSchema.includes(format), `ReportDownloadManifestV1 missing format: ${format}`);

const config = read('config/ministry_output_contracts.yaml');
for (const department of departments) assert(config.includes(`${department}:`), `ministry output config missing department focus: ${department}`);
for (const section of ['shangshufang:', 'junjichu:', 'departments:', 'department_output_contract:', 'swarm_output_contract:', 'final_report_contract:', 'download_contract:']) {
  assert(config.includes(section), `ministry output config missing section: ${section}`);
}
for (const rule of [
  'red_signal_must_not_be_hidden',
  'missing_evidence_cannot_approve',
  'xingbu_red_requires_human_confirmation',
  'swarms_do_not_face_user_directly',
  'no_agent_internal_logs_in_user_ui',
]) {
  assert(config.includes(rule), `ministry output config missing rule: ${rule}`);
}

const registry = read('config/departments.registry.yaml');
for (const department of departments) {
  const block = new RegExp(`- id: ${department}[\\s\\S]*?output_schema: DepartmentOpinionV1[\\s\\S]*?status: active`);
  assert(block.test(registry), `registry department ${department} must output DepartmentOpinionV1 and be active`);
}

const goldenLines = read('evals/ministry_output_contracts.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 5, 'ministry output golden eval must include at least 5 cases');

const seen = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!seen.has(item.id), `duplicate golden id: ${item.id}`);
  seen.add(item.id);
  for (const artifact of ['DepartmentOpinionV1', 'ImperialMemorialV1', 'ReportDownloadManifestV1']) {
    assert(item.must_generate?.includes(artifact), `golden ${item.id} must generate ${artifact}`);
  }
  for (const format of formats) assert(item.download_formats?.includes(format), `golden ${item.id} missing download format ${format}`);
  assert(item.source_label_required === true, `golden ${item.id} must require source_label`);
  assert(item.evidence_or_gap_required === true, `golden ${item.id} must require evidence or gap`);
  assert(Array.isArray(item.expected_departments) && item.expected_departments.length > 0, `golden ${item.id} missing expected departments`);
}

console.log(`Ministry output contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
