import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'schemas/CompanyPeopleAdminProfileV1.json',
  'schemas/LibuComplexityProfileV1.json',
  'schemas/LibuAdaptiveInteractionV1.json',
  'config/libu_complexity_profiles.yaml',
  'loops/libu_adaptive_chro_cao.loop.yaml',
  'evals/libu_adaptive_complexity.golden.jsonl',
];

const read = (rel) => contractRead(rel);
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

for (const rel of requiredFiles) assert(contractExists(rel), `missing required file: ${rel}`);
for (const rel of requiredFiles.filter((r) => r.endsWith('.json'))) JSON.parse(read(rel));

// ── config: 5 modes ─────────────────────────────────────
const cfg = read('config/libu_complexity_profiles.yaml');
for (const mode of ['founder_assistant', 'small_team_hr', 'growth_hrd', 'chro_cao', 'group_enterprise']) {
  assert(cfg.includes(`mode: ${mode}`), `complexity config missing mode: ${mode}`);
}
// 8 升维规则
const escalations = [
  'termination_or_discipline_always_escalate',
  'compensation_always_involve_hubu',
  'labor_risk_always_involve_xingbu',
  'sales_role_always_involve_bingbu',
  'admin_cost_always_involve_hubu',
  'lease_or_contract_admin_always_involve_xingbu',
  'ai_agent_role_always_involve_junjichu_and_xingbu',
  'privacy_sensitive_data_requires_permission_guard',
];
for (const e of escalations) assert(cfg.includes(e), `complexity config missing escalation rule: ${e}`);
// 用户可选 6 + 不可绕过 6
for (const c of ['brief', 'management_detail', 'professional_detail', 'enter_junjichu_deep_review', 'generate_artifact', 'request_department_review']) {
  assert(cfg.includes(c), `config missing user_choice: ${c}`);
}
for (const f of ['high_risk_requires_human_confirmation', 'xingbu_review_for_labor_risk', 'hubu_review_for_compensation_or_admin_cost', 'source_label_required', 'evidence_or_gap_required', 'privacy_sensitive_data_guard']) {
  assert(cfg.includes(f), `config missing non_negotiable_floor: ${f}`);
}

// ── loop: 7 steps, composes existing, no per-size loops ──
const loop = read('loops/libu_adaptive_chro_cao.loop.yaml');
for (const step of ['load_company_profile', 'determine_libu_mode', 'classify_people_admin_question', 'apply_escalation_rules', 'select_enabled_sub_offices', 'render_adaptive_interaction', 'quality_gate']) {
  assert(loop.includes(step), `adaptive loop missing step: ${step}`);
}
assert(loop.includes('libu_chro_cao_office_loop_v1'), 'adaptive loop must compose libu_chro_cao_office_loop_v1 (not replace)');
assert(loop.includes('court_unified_decision_loop_v1'), 'adaptive loop must plug into court_unified_decision_loop_v1');
for (const e of escalations) assert(loop.includes(e), `adaptive loop missing escalation rule: ${e}`);
// 不得创建多套 per-size 流程
const loopFiles = contractReaddir('loops').filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*libu_(small_company|enterprise|founder|group)_loop/m.test(content), `must not introduce per-size loop: ${file}`);
}

// ── golden: ≥20 + 行为断言 ──────────────────────────────
const cases = read('evals/libu_adaptive_complexity.golden.jsonl')
  .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
assert(cases.length >= 20, 'adaptive golden must include at least 20 cases');
const ids = new Set();
for (const c of cases) {
  assert(c.id && c.input, `golden case missing id/input: ${JSON.stringify(c)}`);
  assert(!ids.has(c.id), `duplicate golden id: ${c.id}`);
  ids.add(c.id);
  assert(c.source_label_required === true, `golden case must require source_label: ${c.id}`);
  assert(typeof c.employee_count === 'number', `golden case missing employee_count: ${c.id}`);
  assert(c.expected_mode, `golden case missing expected_mode: ${c.id}`);
  assert(c.expected_default_view, `golden case missing expected_default_view: ${c.id}`);
}
// 小公司默认 brief
assert(
  cases.some((c) => c.expected_mode === 'founder_assistant' && c.expected_default_view === 'brief'),
  'must have a founder_assistant case defaulting to brief',
);
// 高风险小公司自动升维（小规模但 must_escalate + 人工确认）
assert(
  cases.some((c) => c.employee_count <= 50 && c.must_escalate === true && c.must_human_confirmation === true),
  'must have a small-company high-risk case that auto-escalates with human confirmation',
);
// 中大型可展开专业分奏
assert(
  cases.some((c) => (c.expected_mode === 'chro_cao' || c.expected_mode === 'group_enterprise') && c.expected_default_view === 'professional_detail'),
  'must have a mid/large case defaulting to professional_detail',
);
// group_enterprise 预留能力
assert(
  cases.some((c) => c.expected_mode === 'group_enterprise' && Array.isArray(c.expected_reserved)),
  'must have a group_enterprise case with reserved capabilities',
);

console.log(`Libu adaptive complexity OK: ${requiredFiles.length} files, ${cases.length} golden cases, 5 modes, ${escalations.length} escalation rules`);
