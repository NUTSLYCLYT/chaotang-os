import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/jinyiwei.intelligence_office.registry.yaml',
  'loops/jinyiwei_intelligence_office.loop.yaml',
  'schemas/JinyiweiIntelligenceOpinionV1.json',
  'schemas/IntelligenceRequirementV1.json',
  'schemas/CollectionPlanV1.json',
  'schemas/IntelligenceSourceV1.json',
  'schemas/ClaimEvidenceV1.json',
  'schemas/SourceReliabilityV1.json',
  'schemas/IntelligencePackV1.json',
  'schemas/IntelligenceGapV1.json',
  'schemas/WatchlistAlertV1.json',
  'schemas/JinyiweiQualityGateResultV1.json',
  'schemas/IntelligencePrivacyPolicyV1.json',
  'prompts/departments/jinyiwei/intelligence_chief.system.md',
  'prompts/departments/jinyiwei/requirements_planning.system.md',
  'prompts/departments/jinyiwei/open_source_research.system.md',
  'prompts/departments/jinyiwei/customer_intel.system.md',
  'prompts/departments/jinyiwei/competitor_intel.system.md',
  'prompts/departments/jinyiwei/archive_recall.system.md',
  'prompts/departments/jinyiwei/fact_verification.system.md',
  'prompts/departments/jinyiwei/early_warning.system.md',
  'prompts/departments/jinyiwei/quality_gate.system.md',
  'evals/jinyiwei_intelligence_office.golden.jsonl',
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

const registry = read('config/jinyiwei.intelligence_office.registry.yaml');
for (const token of ['锦衣卫指挥使', '问牒司', '采风司', '客情司', '竞情司', '档案司', '校验司', '预警司']) {
  assert(registry.includes(token), `jinyiwei registry missing P0 office: ${token}`);
}
for (const reserved of ['图谱司', '政策司', '数据司', '舆情司', '自动监测司', '密级司']) {
  assert(registry.includes(reserved), `jinyiwei registry missing reserved office: ${reserved}`);
}
for (const field of ['id', 'name', 'purpose', 'trigger', 'inputs', 'must_answer', 'must_not', 'tools_allowed', 'tools_forbidden', 'output_schema', 'quality_gates', 'eval_cases']) {
  assert(registry.includes(`${field}:`), `jinyiwei Swarm Card missing field: ${field}`);
}
for (const artifact of ['情报需求单', '信息采集计划', '客户情报卡', '竞品情报卡', '市场简报', '政策核查清单', '项目背景包', '旧案镜鉴', '证据链', '来源可信度表', '传闻/事实/推理区分表', '缺证清单', '风险预警卡', '客户决策链图', '竞品对比表', '行业趋势摘要', '会议纪要提取', '上传文件事实摘要', 'Watchlist 监测项', '情报复盘记录']) {
  assert(registry.includes(artifact), `jinyiwei registry missing artifact type: ${artifact}`);
}

const departmentsRegistry = read('config/departments.registry.yaml');
assert(departmentsRegistry.includes('real_world_equivalent: Chief Intelligence Office'), 'departments registry must define jinyiwei as Chief Intelligence Office');

const loopFiles = contractReaddir('loops').filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*jinyiwei_special_review/m.test(content), `loop must not introduce jinyiwei_special_review: ${file}`);
}

const loop = read('loops/jinyiwei_intelligence_office.loop.yaml');
assert(loop.includes('court_unified_decision_loop_v1'), 'jinyiwei loop must plug into court_unified_decision_loop_v1');
for (const step of ['receive_intelligence_work_order', 'define_intelligence_requirements', 'create_collection_plan', 'collect_authorized_sources', 'process_and_normalize_sources', 'run_intelligence_sub_offices', 'verify_claims_and_sources', 'synthesize_intelligence_pack', 'jinyiwei_quality_gate', 'return_to_junjichu']) {
  assert(loop.includes(step), `jinyiwei loop missing step: ${step}`);
}
for (const gate of ['source_label_required', 'source_type_required', 'no_unauthorized_collection', 'no_private_or_sensitive_data_without_permission', 'no_unverified_claims', 'claim_requires_evidence_or_gap', 'stale_info_must_be_marked', 'source_conflict_must_be_visible', 'model_inference_must_be_marked', 'competitor_claims_require_evidence', 'customer_commitment_requires_source', 'policy_claim_requires_date_and_source', 'privacy_sensitive_data_guard', 'intelligence_pack_must_have_gaps', 'high_risk_requires_human_confirmation', 'no_deceptive_collection_methods', 'no_hacking_or_bypass']) {
  assert(loop.includes(gate) || registry.includes(gate), `missing jinyiwei quality gate: ${gate}`);
}

for (const schema of ['JinyiweiIntelligenceOpinionV1', 'IntelligenceSourceV1', 'ClaimEvidenceV1', 'IntelligencePackV1', 'JinyiweiQualityGateResultV1']) {
  const text = JSON.stringify(JSON.parse(read(`schemas/${schema}.json`)));
  assert(text.includes('sourceLabel'), `${schema} must include sourceLabel`);
}
const sourceSchema = JSON.stringify(JSON.parse(read('schemas/IntelligenceSourceV1.json')));
assert(sourceSchema.includes('sourceType'), 'IntelligenceSourceV1 must include sourceType');
const claimSchema = JSON.stringify(JSON.parse(read('schemas/ClaimEvidenceV1.json')));
for (const claimType of ['FACT', 'CLAIM', 'INFERENCE', 'RUMOR']) {
  assert(claimSchema.includes(claimType), `ClaimEvidenceV1 missing claim type: ${claimType}`);
}

const goldenLines = read('evals/jinyiwei_intelligence_office.golden.jsonl').split('\n').map((line) => line.trim()).filter(Boolean);
assert(goldenLines.length >= 20, 'jinyiwei golden eval must include at least 20 cases');
const ids = new Set();
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(!ids.has(item.id), `duplicate golden case id: ${item.id}`);
  ids.add(item.id);
  for (const flag of ['source_label_required', 'source_type_required', 'evidence_or_gap_required', 'must_distinguish_claim_types', 'must_source_reliability', 'must_mark_stale', 'must_show_source_conflict', 'privacy_sensitive_data_guard', 'no_unauthorized_collection', 'must_archivable']) {
    assert(item[flag] === true, `golden case ${item.id} must set ${flag}=true`);
  }
}

console.log(`Jinyiwei Chief Intelligence Office contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
