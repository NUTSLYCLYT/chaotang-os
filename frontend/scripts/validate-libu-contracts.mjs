import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/libu.chro_cao_office.registry.yaml',
  'loops/libu_chro_cao_office.loop.yaml',
  'schemas/LibuCHROCAOOpinionV1.json',
  'schemas/LibuSubOfficeReviewV1.json',
  'schemas/PeopleAdminEvidencePackV1.json',
  'schemas/PeopleAdminInteractionCardV1.json',
  'schemas/LibuGeneratedArtifactV1.json',
  'schemas/LibuPrivacyPolicyV1.json',
  'schemas/LibuQualityGateResultV1.json',
  'prompts/departments/libu/chro_cao_chief.system.md',
  'prompts/departments/libu/org_design.system.md',
  'prompts/departments/libu/talent_acquisition.system.md',
  'prompts/departments/libu/performance.system.md',
  'prompts/departments/libu/total_rewards.system.md',
  'prompts/departments/libu/hr_operations.system.md',
  'prompts/departments/libu/employee_relations.system.md',
  'prompts/departments/libu/admin_operations.system.md',
  'prompts/departments/libu/quality_gate.system.md',
  'evals/libu_chro_cao_office.golden.jsonl',
];

function read(rel) {
  return contractRead(rel);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const rel of requiredFiles) {
  assert(contractExists(rel), `missing required file: ${rel}`);
}

for (const rel of requiredFiles.filter((item) => item.endsWith('.json'))) {
  JSON.parse(read(rel));
}

const registry = read('config/libu.chro_cao_office.registry.yaml');
for (const token of ['吏部尚书', '官制司', '选才司', '考功司', '薪酬司', '人事司', '劳关司', '行政司']) {
  assert(registry.includes(token), `libu registry missing P0 office: ${token}`);
}

// 每个 P0 子司必须有完整 Swarm Card 字段
for (const field of [
  'name',
  'purpose',
  'trigger',
  'inputs',
  'must_answer',
  'must_not',
  'tools_allowed',
  'tools_forbidden',
  'output_schema',
  'quality_gates',
  'eval_cases',
]) {
  assert(registry.includes(`${field}:`), `libu Swarm Card missing field: ${field}`);
}

const departmentsRegistry = read('config/departments.registry.yaml');
assert(/^\s*-\s*id:\s*personnel\b/m.test(departmentsRegistry), 'departments registry must register 吏部 (id: personnel)');
assert(
  registry.includes('real_world_equivalent: CHRO + CAO Office'),
  'libu registry must define 吏部 as CHRO + CAO Office',
);

// 吏部不得脱离统一 Loop / 不得新建特殊流程
const loopFiles = contractReaddir('loops')
  .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*libu_special_review/m.test(content), `loop must not introduce libu_special_review: ${file}`);
}

const loop = read('loops/libu_chro_cao_office.loop.yaml');
assert(loop.includes('court_unified_decision_loop_v1'), 'libu loop must declare it plugs into court_unified_decision_loop_v1');
// loop 必须包含 7 个步骤
for (const step of [
  'receive_libu_work_order',
  'classify_people_admin_question',
  'collect_people_admin_evidence',
  'run_libu_sub_offices',
  'synthesize_chro_cao_position',
  'libu_quality_gate',
  'return_to_junjichu',
]) {
  assert(loop.includes(step), `libu loop missing step: ${step}`);
}
for (const gate of [
  'source_label_required',
  'owner_or_gap_required',
  'role_scope_required',
  'hiring_requires_budget_and_success_criteria',
  'compensation_requires_hubu_review',
  'termination_requires_evidence_and_xingbu_review',
  'labor_risk_requires_xingbu_review',
  'admin_cost_requires_budget_source',
  'no_people_decision_without_context',
  'privacy_sensitive_data_guard',
  'ai_agent_role_requires_permission_review',
  'high_risk_requires_human_confirmation',
  'no_irreversible_hr_action_without_approval',
]) {
  assert(loop.includes(gate) || registry.includes(gate), `missing libu quality gate: ${gate}`);
}

const opinionSchema = JSON.stringify(JSON.parse(read('schemas/LibuCHROCAOOpinionV1.json')));
assert(
  opinionSchema.includes('sourceLabel') || opinionSchema.includes('source_label'),
  'LibuCHROCAOOpinionV1 must include source label',
);

// 吏部生成材料类型契约
const artifactSchema = JSON.stringify(JSON.parse(read('schemas/LibuGeneratedArtifactV1.json')));
for (const art of ['JD_岗位说明书', 'PIP绩效改进计划', 'RACI表', '销售提成方案草案', 'AI_Agent权限审批单', '办公室搬迁方案']) {
  assert(artifactSchema.includes(art), `LibuGeneratedArtifactV1 missing artifact type: ${art}`);
}

const goldenLines = read('evals/libu_chro_cao_office.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 20, 'libu golden eval must include at least 20 cases');
const ids = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
}

console.log(`Libu CHRO/CAO Office contracts 2.0 OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
