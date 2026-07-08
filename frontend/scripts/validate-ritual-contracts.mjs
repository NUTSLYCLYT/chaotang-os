import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/rites_brand_comms.registry.yaml',
  'loops/rites_brand_comms_office.loop.yaml',
  'schemas/RitesCMOCCOOpinionV1.json',
  'schemas/RitesSubOfficeReviewV1.json',
  'schemas/BrandCommsEvidencePackV1.json',
  'schemas/RitesInteractionCardV1.json',
  'schemas/RitesGeneratedArtifactV1.json',
  'schemas/RitesMessageRiskPolicyV1.json',
  'schemas/RitesQualityGateResultV1.json',
  'prompts/departments/rites/cmo_cco_chief.system.md',
  'prompts/departments/rites/brand_strategy.system.md',
  'prompts/departments/rites/customer_insight.system.md',
  'prompts/departments/rites/content_copy.system.md',
  'prompts/departments/rites/partnership_pitch.system.md',
  'prompts/departments/rites/pr_reputation.system.md',
  'prompts/departments/rites/channel_campaign.system.md',
  'prompts/departments/rites/message_quality_gate.system.md',
  'evals/rites_brand_comms_office.golden.jsonl',
];

const p0SubOffices = [
  '礼部尚书',
  '品牌司',
  '客群司',
  '文宣司',
  '招商司',
  '公关司',
  '传播渠道司',
  '审辞司',
];

const qualityGates = [
  'source_label_required',
  'no_external_message_without_review',
  'no_unverified_claims',
  'no_roi_or_revenue_claim_without_hubu_review',
  'no_legal_or_contract_claim_without_xingbu_review',
  'no_price_or_delivery_commitment_without_review',
  'no_exaggerated_marketing_claim',
  'competitor_claims_require_evidence',
  'crisis_comms_requires_human_confirmation',
  'sensitive_data_requires_permission_guard',
  'ai_generated_external_content_requires_review',
  'one_primary_message_required',
  'audience_and_goal_required',
];

const artifactTypes = [
  '客户回复草稿',
  '销售话术',
  '招商话术',
  '公司介绍',
  '产品介绍',
  '官网文案',
  '宣传册文案',
  'Pitch Deck 大纲',
  '合作方案大纲',
  '销售 PPT 大纲',
  '客户会议议程',
  '展会话术',
  '公众号 / 朋友圈 / 小红书 / LinkedIn 草稿',
  '新闻稿',
  '媒体 Q&A',
  '危机回应 holding statement',
  '舆情回应草稿',
  '品牌定位卡',
  '客户价值主张卡',
  '竞品对比话术',
  'FAQ',
  '对外邮件草稿',
  '招商落地页文案',
  '案例故事草稿',
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
  JSON.parse(read(rel));
}

const departmentsRegistry = read('config/departments.registry.yaml');
assert(departmentsRegistry.includes('id: rites_brand_comms'), 'departments registry must include rites_brand_comms protocol department');
assert(departmentsRegistry.includes('CMO/CCO Office'), 'rites department must be CMO/CCO Office');
assert(departmentsRegistry.includes('review_skill: brand_comms_message_risk_review'), 'ritual review skill must use brand comms message risk review');
assert(!departmentsRegistry.includes('skill.department.libu.rites'), 'ritual must not use libu naming');

const registry = read('config/rites_brand_comms.registry.yaml');
assert(registry.includes('code_name: rites_brand_comms'), 'rites registry must use rites_brand_comms code name');
assert(!registry.includes('libu_'), 'rites registry must not contain libu_ naming');
for (const token of p0SubOffices) {
  assert(registry.includes(token), `rites registry missing P0 office: ${token}`);
}
for (const token of ['增长司', '数据司', '国际司', '社群司', 'AI创意司']) {
  assert(registry.includes(token), `rites registry missing reserved office: ${token}`);
}
for (const gate of qualityGates) {
  assert(registry.includes(gate), `rites registry missing quality gate: ${gate}`);
}
for (const artifactType of artifactTypes) {
  assert(registry.includes(artifactType), `rites registry missing artifact type: ${artifactType}`);
}

const loop = read('loops/rites_brand_comms_office.loop.yaml');
for (const step of [
  'receive_rites_work_order',
  'classify_brand_comms_question',
  'collect_brand_comms_evidence',
  'run_rites_sub_offices',
  'synthesize_cmo_cco_position',
  'rites_quality_gate',
  'return_to_junjichu',
]) {
  assert(loop.includes(step), `rites loop missing step: ${step}`);
}
assert(loop.includes('court_unified_decision_loop_v1'), 'rites loop must be attached to unified court loop');
assert(!loop.includes('rites_special_review'), 'rites loop must not create rites_special_review');

const opinionSchemaText = JSON.stringify(JSON.parse(read('schemas/RitesCMOCCOOpinionV1.json')));
for (const token of ['sourceLabel', 'source_label', 'audience', 'goal', 'channel', 'messageRiskLevel', 'nextBestAction', 'highRiskRequiresHumanConfirmation', 'mayPublish']) {
  assert(opinionSchemaText.includes(token), `RitesCMOCCOOpinionV1 missing ${token}`);
}
assert(opinionSchemaText.includes('"const":false') || opinionSchemaText.includes('"const": false'), 'RitesCMOCCOOpinionV1 must forbid direct publish');

const artifactSchemaText = JSON.stringify(JSON.parse(read('schemas/RitesGeneratedArtifactV1.json')));
for (const artifactType of artifactTypes) {
  assert(artifactSchemaText.includes(artifactType), `RitesGeneratedArtifactV1 missing artifact type: ${artifactType}`);
}

const goldenLines = read('evals/rites_brand_comms_office.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 20, 'rites golden eval must include at least 20 cases');
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
  assert(item.audience_required === true && item.goal_required === true && item.channel_required === true, `golden case must require audience/goal/channel: ${item.id}`);
  assert(item.evidence_or_gap_required === true, `golden case must require evidence or gap: ${item.id}`);
  assert(item.message_risk_level, `golden case must include message_risk_level: ${item.id}`);
  assert(Object.hasOwn(item, 'high_risk_requires_human_confirmation'), `golden case must define human confirmation: ${item.id}`);
  assert(item.must_output_next_best_action === true, `golden case must require next_best_action: ${item.id}`);
  assert(item.must_support_artifact === true, `golden case must support generated artifact: ${item.id}`);
  assert(item.must_forbid_direct_publish === true, `golden case must forbid direct publish: ${item.id}`);
  assert(item.archive_ready_required === true, `golden case must be archive ready: ${item.id}`);
}

console.log(`Rites Brand Comms Office contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
