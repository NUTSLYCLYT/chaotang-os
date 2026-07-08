import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/gongbu.cto_cpo_delivery_office.registry.yaml',
  'loops/court_unified_decision.loop.yaml',
  'loops/gongbu_cto_cpo_delivery_office.loop.yaml',
  'schemas/GongbuCTOCPOOpinionV1.json',
  'schemas/GongbuSubOfficeReviewV1.json',
  'schemas/DeliveryEvidencePackV1.json',
  'schemas/GongbuInteractionCardV1.json',
  'schemas/GongbuGeneratedArtifactV1.json',
  'schemas/GongbuDeliveryRiskPolicyV1.json',
  'schemas/GongbuQualityGateResultV1.json',
  'prompts/departments/gongbu/cto_cpo_chief.system.md',
  'prompts/departments/gongbu/solution_architecture.system.md',
  'prompts/departments/gongbu/bom_supply_chain.system.md',
  'prompts/departments/gongbu/schedule_capacity.system.md',
  'prompts/departments/gongbu/quality_acceptance.system.md',
  'prompts/departments/gongbu/field_implementation.system.md',
  'prompts/departments/gongbu/delivery_operations.system.md',
  'prompts/departments/gongbu/delivery_commitment_gate.system.md',
  'prompts/departments/gongbu/quality_gate.system.md',
  'evals/gongbu_cto_cpo_delivery_office.golden.jsonl',
];

const p0Offices = [
  '工部尚书',
  '方案司',
  '物料司',
  '进度司',
  '质量司',
  '现场司',
  '交付司',
  '承诺司',
];

const p1Reserved = [
  '数据工程司',
  '安全司',
  'AI 工程司',
  '国际交付司',
  '售后运维司',
];

const swarmCardFields = [
  'id',
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
];

const qualityGates = [
  'source_label_required',
  'evidence_or_gap_required',
  'no_delivery_commitment_without_bom_and_schedule',
  'no_fixed_date_without_capacity_and_dependencies',
  'formal_delivery_commitment_requires_xingbu_review',
  'price_or_cost_claim_requires_hubu_review',
  'customer_timeline_requires_war_review',
  'scope_change_requires_personnel_or_owner_review',
  'acceptance_requires_test_plan_and_acceptance_criteria',
  'supplier_lock_requires_contract_and_supply_evidence',
  'safety_or_compliance_risk_requires_human_confirmation',
  'no_auto_external_delivery_commitment',
  'high_risk_requires_human_confirmation',
  'one_primary_delivery_next_action_required',
  'fallback_cannot_be_final_delivery_basis',
];

const artifactTypes = [
  'BOM 缺口清单',
  '技术方案审查意见',
  'MVP 范围卡',
  '交付可行性报告',
  '交期风险清单',
  '供应链风险清单',
  '现场勘查清单',
  '施工/部署前置条件清单',
  '验收标准草案',
  '测试计划大纲',
  '质量风险清单',
  '客户交付口径草稿',
  '不可承诺事项清单',
  '变更控制单',
  '里程碑计划草案',
  '供应商补证清单',
  '产能评估清单',
  '交付复盘卡',
  '高风险人工确认弹窗文案',
  '跨部门复核单',
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

const departmentsRegistry = read('config/departments.registry.yaml');
assert(/^\s*-\s*id:\s*works\b/m.test(departmentsRegistry), 'departments registry must register 工部 (id: works)');
assert(departmentsRegistry.includes('CTO Office'), 'departments registry must define 工部 as CTO Office');
assert(departmentsRegistry.includes('CPO Office'), 'departments registry must define 工部 as CPO Office');
assert(departmentsRegistry.includes('交付与供应链办公室'), 'departments registry must define delivery/supply chain office');

const registry = read('config/gongbu.cto_cpo_delivery_office.registry.yaml');
assert(registry.includes('court_unified_decision_loop_v1'), 'gongbu registry must reference unified loop');
assert(!registry.includes('司是 agent'), 'registry must not define offices as permanent agents');
for (const token of p0Offices) {
  assert(registry.includes(token), `gongbu registry missing P0 office: ${token}`);
}
for (const token of p1Reserved) {
  assert(registry.includes(token), `gongbu registry missing reserved office: ${token}`);
}
for (const field of swarmCardFields) {
  assert(registry.includes(`${field}:`), `gongbu Swarm Card missing field: ${field}`);
}
for (const gate of qualityGates) {
  assert(registry.includes(gate), `gongbu registry missing quality gate: ${gate}`);
}

const loopFiles = contractReaddir('loops')
  .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*gongbu_special_review/m.test(content), `loop must not introduce gongbu_special_review: ${file}`);
}

const loop = read('loops/gongbu_cto_cpo_delivery_office.loop.yaml');
assert(loop.includes('court_unified_decision_loop_v1'), 'gongbu loop must plug into court_unified_decision_loop_v1');
for (const step of [
  'receive_gongbu_work_order',
  'classify_delivery_question',
  'collect_delivery_evidence',
  'run_gongbu_sub_offices',
  'synthesize_cto_cpo_position',
  'gongbu_quality_gate',
  'return_to_junjichu',
]) {
  assert(loop.includes(step), `gongbu loop missing step: ${step}`);
}
for (const gate of qualityGates) {
  assert(loop.includes(gate) || registry.includes(gate), `missing gongbu quality gate: ${gate}`);
}

const opinionSchema = JSON.stringify(JSON.parse(read('schemas/GongbuCTOCPOOpinionV1.json')));
assert(opinionSchema.includes('source_label'), 'GongbuCTOCPOOpinionV1 must include source_label');
assert(opinionSchema.includes('deliveryCommitmentRisk'), 'GongbuCTOCPOOpinionV1 must include deliveryCommitmentRisk');
assert(opinionSchema.includes('forbiddenActions'), 'GongbuCTOCPOOpinionV1 must include forbiddenActions');

const artifactSchema = JSON.stringify(JSON.parse(read('schemas/GongbuGeneratedArtifactV1.json')));
for (const art of artifactTypes) {
  assert(artifactSchema.includes(art), `GongbuGeneratedArtifactV1 missing artifact type: ${art}`);
}

const qualitySchema = JSON.stringify(JSON.parse(read('schemas/GongbuQualityGateResultV1.json')));
for (const gate of qualityGates) {
  assert(qualitySchema.includes(gate), `GongbuQualityGateResultV1 missing gate: ${gate}`);
}

const goldenLines = read('evals/gongbu_cto_cpo_delivery_office.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 20, 'gongbu golden eval must include at least 20 cases');

const ids = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
  assert(Array.isArray(item.must_include_offices) && item.must_include_offices.length > 0, `golden case must include offices: ${item.id}`);
  assert(Array.isArray(item.must_include_gaps) && item.must_include_gaps.length > 0, `golden case must check evidence or missing evidence: ${item.id}`);
  assert('delivery_commitment_risk' in item, `golden case must check delivery commitment risk: ${item.id}`);
  assert('must_require_human_confirmation' in item, `golden case must check human confirmation: ${item.id}`);
  assert(Array.isArray(item.must_cross_review), `golden case must declare cross review departments: ${item.id}`);
  assert(item.must_next_best_action === true, `golden case must require next_best_action: ${item.id}`);
  assert(item.must_can_generate_artifact === true, `golden case must support generated artifacts: ${item.id}`);
  assert(Array.isArray(item.expected_artifact) && item.expected_artifact.length > 0, `golden case must name generated artifacts: ${item.id}`);
  assert(item.must_forbid_irreversible_actions === true, `golden case must forbid irreversible actions: ${item.id}`);
  assert(item.must_archivable === true, `golden case must be archivable: ${item.id}`);
}

console.log(`Gongbu CTO/CPO Delivery Office contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
