import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredLoopSteps = [
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

const requiredSchemas = [
  'DraftEdictV1.json',
  'ReviewPlanV1.json',
  'DepartmentOpinionV1.json',
  'EvidenceItemV1.json',
  'EvidenceAuditV1.json',
  'ConflictSummaryV1.json',
  'MemorialV1.json',
  'QualityGateResultV1.json',
  'EmperorDecisionV1.json',
  'ShiguanArchiveRecordV1.json',
  'EvoMapEventV1.json',
];

const requiredDepartments = [
  'jinyiwei_intelligence',
  'hubu_cfo',
  'libu_hr_admin',
  'rites_brand_comms',
  'bingbu_sales',
  'xingbu_legal_risk',
  'gongbu_delivery',
];

const requiredRegistryFields = [
  'id',
  'name',
  'type',
  'enabled',
  'display_role',
  'review_skill',
  'output_schema',
  'route_keywords',
  'swarm_bundle',
  'default_participation',
  'complexity_profile',
  'user_visible_summary',
];

const requiredGoldenAssertions = [
  'has_source_label',
  'has_evidence_or_missing_evidence',
  'high_risk_human_confirmation_required',
  'has_next_order',
  'can_archive_to_shiguan',
];

function read(rel) {
  return contractRead(rel);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJsonFile(rel) {
  try {
    return JSON.parse(read(rel));
  } catch (error) {
    throw new Error(`${rel} is not valid JSON: ${error.message}`);
  }
}

function validateLoop() {
  const loop = read('loops/court_unified_decision.loop.yaml');
  for (const step of requiredLoopSteps) {
    assert(loop.includes(`id: ${step}`), `loop missing step ${step}`);
  }
  for (const label of ['LIVE', 'LIVE_SWARM', 'MIXED', 'FALLBACK', 'DEMO']) {
    assert(loop.includes(label), `loop missing source label ${label}`);
  }
  for (const gate of [
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
  ]) {
    assert(loop.includes(`id: ${gate}`) || loop.includes(`- ${gate}`), `loop missing quality gate ${gate}`);
  }
}

function validateRegistry() {
  const registry = read('config/departments.registry.yaml');
  for (const id of requiredDepartments) {
    assert(registry.includes(`id: ${id}`), `registry missing department ${id}`);
  }
  for (const field of requiredRegistryFields) {
    assert(registry.includes(`${field}:`), `registry missing field ${field}`);
  }
}

function validateSchemas() {
  for (const file of requiredSchemas) {
    const schema = parseJsonFile(`schemas/${file}`);
    assert(schema.title === file.replace('.json', ''), `${file} title mismatch`);
    assert(schema.type === 'object', `${file} must be object schema`);
    assert(Array.isArray(schema.required), `${file} missing required array`);
    if (!['EvidenceItemV1.json'].includes(file)) {
      assert(schema.required.includes('source_label'), `${file} must require source_label`);
    }
  }
}

function validateGolden() {
  const raw = read('evals/courtos_core_loop.golden.jsonl').trim();
  const lines = raw.split('\n').filter(Boolean);
  assert(lines.length >= 5, 'golden eval must contain at least 5 cases');
  for (const [index, line] of lines.entries()) {
    let item;
    try {
      item = JSON.parse(line);
    } catch (error) {
      throw new Error(`golden line ${index + 1} is not valid JSON: ${error.message}`);
    }
    assert(typeof item.case_id === 'string' && item.case_id, `golden line ${index + 1} missing case_id`);
    assert(typeof item.question === 'string' && item.question.length >= 5, `golden line ${index + 1} missing question`);
    for (const schema of ['DraftEdictV1', 'ReviewPlanV1', 'MemorialV1']) {
      assert(item.expected_schemas?.includes(schema), `${item.case_id} missing expected schema ${schema}`);
    }
    for (const key of requiredGoldenAssertions) {
      assert(typeof item.assertions?.[key] === 'boolean', `${item.case_id} missing assertion ${key}`);
    }
  }
}

validateLoop();
validateRegistry();
validateSchemas();
validateGolden();

console.log('[courtos-core-protocol] ok');
