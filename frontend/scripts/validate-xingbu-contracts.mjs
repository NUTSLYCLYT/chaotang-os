import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/xingbu.clo_cco_office.registry.yaml',
  'loops/court_unified_decision.loop.yaml',
  'loops/xingbu_clo_cco_office.loop.yaml',
  'schemas/XingbuCLOCCOOpinionV1.json',
  'schemas/XingbuSubOfficeReviewV1.json',
  'schemas/LegalRiskEvidencePackV1.json',
  'schemas/XingbuInteractionCardV1.json',
  'schemas/XingbuGeneratedArtifactV1.json',
  'schemas/XingbuPrivacyPolicyV1.json',
  'schemas/XingbuQualityGateResultV1.json',
  'prompts/departments/xingbu/clo_cco_chief.system.md',
  'prompts/departments/xingbu/contract_office.system.md',
  'prompts/departments/xingbu/corporate_governance.system.md',
  'prompts/departments/xingbu/compliance.system.md',
  'prompts/departments/xingbu/dispute_litigation.system.md',
  'prompts/departments/xingbu/employment_law.system.md',
  'prompts/departments/xingbu/ip_confidentiality.system.md',
  'prompts/departments/xingbu/legal_operations.system.md',
  'prompts/departments/xingbu/quality_gate.system.md',
  'evals/xingbu_clo_cco_office.golden.jsonl',
];

const p0Offices = [
  '刑部尚书',
  '契约司',
  '公司司',
  '合规司',
  '争讼司',
  '劳法司',
  '知产司',
  '法运司',
];

const p1Reserved = [
  '数据隐私司',
  '国际贸易司',
  '采购供应商法务司',
  '政策监管司',
  'AI 治理司',
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
  'no_legal_certainty_without_jurisdiction_and_evidence',
  'high_risk_requires_human_confirmation',
  'no_contract_signing_without_contract_source',
  'no_external_commitment_without_authority',
  'equity_or_governance_requires_corporate_review',
  'payment_or_penalty_requires_hubu_review',
  'labor_action_requires_libu_review',
  'dispute_requires_evidence_preservation',
  'ip_or_confidentiality_requires_ip_review',
  'seal_or_signature_requires_authority_check',
  'privacy_sensitive_data_guard',
  'no_irreversible_legal_action_without_approval',
  'fallback_cannot_be_final_legal_basis',
];

const artifactTypes = [
  '合同风险清单',
  '合同条款审查意见',
  '签署权限检查清单',
  '合同补证清单',
  '对外承诺风险清单',
  '正式报价法律风险提示',
  '股权条款风险清单',
  '股东/合伙人决策事项清单',
  '付款/违约金/保证金风险清单',
  '劳动风险证据清单',
  'PIP / 辞退前法律风险清单',
  '律师函/争议事项材料清单',
  '诉讼/仲裁证据保全清单',
  'NDA / 保密协议审查清单',
  '知识产权归属检查清单',
  '印章/签署授权审批单',
  '外部律师委托事项清单',
  '法务复核单',
  '高风险人工确认弹窗文案',
  '客户沟通限制话术',
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
assert(/^\s*-\s*id:\s*justice\b/m.test(departmentsRegistry), 'departments registry must register 刑部 (id: justice)');
assert(departmentsRegistry.includes('CLO Office'), 'departments registry must define 刑部 as CLO Office');
assert(departmentsRegistry.includes('General Counsel Office'), 'departments registry must define General Counsel Office');
assert(departmentsRegistry.includes('CCO Office'), 'departments registry must define CCO Office');
assert(departmentsRegistry.includes('Legal Operations'), 'departments registry must define Legal Operations');

const registry = read('config/xingbu.clo_cco_office.registry.yaml');
assert(registry.includes('court_unified_decision_loop_v1'), 'xingbu registry must reference unified loop');
for (const token of p0Offices) {
  assert(registry.includes(token), `xingbu registry missing P0 office: ${token}`);
}
for (const token of p1Reserved) {
  assert(registry.includes(token), `xingbu registry missing reserved office: ${token}`);
}
for (const field of swarmCardFields) {
  assert(registry.includes(`${field}:`), `xingbu Swarm Card missing field: ${field}`);
}
for (const gate of qualityGates) {
  assert(registry.includes(gate), `xingbu registry missing quality gate: ${gate}`);
}

const loopFiles = contractReaddir('loops')
  .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*xingbu_special_review/m.test(content), `loop must not introduce xingbu_special_review: ${file}`);
}

const loop = read('loops/xingbu_clo_cco_office.loop.yaml');
assert(loop.includes('court_unified_decision_loop_v1'), 'xingbu loop must plug into court_unified_decision_loop_v1');
for (const step of [
  'receive_xingbu_work_order',
  'classify_legal_risk_question',
  'collect_legal_evidence',
  'run_xingbu_sub_offices',
  'synthesize_clo_cco_position',
  'xingbu_quality_gate',
  'return_to_junjichu',
]) {
  assert(loop.includes(step), `xingbu loop missing step: ${step}`);
}
for (const gate of qualityGates) {
  assert(loop.includes(gate) || registry.includes(gate), `missing xingbu quality gate: ${gate}`);
}

const opinionSchema = JSON.stringify(JSON.parse(read('schemas/XingbuCLOCCOOpinionV1.json')));
assert(opinionSchema.includes('source_label'), 'XingbuCLOCCOOpinionV1 must include source_label');
assert(opinionSchema.includes('jurisdictionOrScopeGap'), 'XingbuCLOCCOOpinionV1 must include jurisdictionOrScopeGap');
assert(opinionSchema.includes('forbiddenActions'), 'XingbuCLOCCOOpinionV1 must include forbiddenActions');

const artifactSchema = JSON.stringify(JSON.parse(read('schemas/XingbuGeneratedArtifactV1.json')));
for (const art of artifactTypes) {
  assert(artifactSchema.includes(art), `XingbuGeneratedArtifactV1 missing artifact type: ${art}`);
}

const qualitySchema = JSON.stringify(JSON.parse(read('schemas/XingbuQualityGateResultV1.json')));
for (const gate of qualityGates) {
  assert(qualitySchema.includes(gate), `XingbuQualityGateResultV1 missing gate: ${gate}`);
}

const goldenLines = read('evals/xingbu_clo_cco_office.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 20, 'xingbu golden eval must include at least 20 cases');

const ids = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
  assert(item.jurisdiction_or_scope_gap === true || item.jurisdiction_or_scope_gap === false, `golden case must specify jurisdiction_or_scope_gap: ${item.id}`);
  assert(Array.isArray(item.must_include_gaps) && item.must_include_gaps.length > 0, `golden case must check evidence or missing evidence: ${item.id}`);
  assert('must_require_human_confirmation' in item, `golden case must check human confirmation: ${item.id}`);
  assert(Array.isArray(item.must_cross_review), `golden case must declare cross review departments: ${item.id}`);
  assert(item.must_next_best_action === true, `golden case must require next_best_action: ${item.id}`);
  assert(item.must_can_generate_artifact === true, `golden case must support generated artifacts: ${item.id}`);
  assert(Array.isArray(item.expected_artifact) && item.expected_artifact.length > 0, `golden case must name generated artifacts: ${item.id}`);
  assert(item.must_forbid_irreversible_actions === true, `golden case must forbid irreversible actions: ${item.id}`);
  assert(item.must_archivable === true, `golden case must be archivable: ${item.id}`);
}

console.log(`Xingbu CLO/CCO Office contracts 2.0 OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
