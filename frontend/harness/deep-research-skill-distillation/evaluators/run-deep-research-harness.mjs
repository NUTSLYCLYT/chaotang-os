#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const HARNESS = path.join(ROOT, 'harness/deep-research-skill-distillation');
const REPORT_DIR = path.join(HARNESS, 'reports');

const files = {
  sourcePack: 'source_packs/serenity-bottleneck-investing.source-pack.json',
  learningPack: 'learning_packs/serenity-bottleneck-investing.learning-pack.json',
  distillation: 'skill_distillations/hubu-bottleneck-investing.distillation.json',
  outcomeLedger: 'outcome_ledgers/serenity-bottleneck-investing.outcome-ledger.json',
  skill: 'candidate_skills/hubu-bottleneck-investing/SKILL.md',
  cases: 'golden_cases/serenity-bottleneck-investing.cases.json',
};

async function readJson(rel) {
  return JSON.parse(await readFile(path.join(HARNESS, rel), 'utf8'));
}

async function readText(rel) {
  return readFile(path.join(HARNESS, rel), 'utf8');
}

function pass(name, evidence) {
  return { name, status: 'pass', evidence };
}

function fail(name, evidence) {
  return { name, status: 'fail', evidence };
}

function hasAll(text, terms) {
  const lower = text.toLowerCase();
  return terms.every((term) => lower.includes(term.toLowerCase()));
}

function checkSourcePack(sourcePack) {
  const failures = [];
  if (!Array.isArray(sourcePack.sources) || sourcePack.sources.length < 3) {
    failures.push('source pack needs at least 3 sources');
  }
  for (const source of sourcePack.sources ?? []) {
    for (const field of ['source_id', 'url', 'title', 'publisher', 'accessed_at', 'source_type', 'reliability']) {
      if (!source[field]) failures.push(`${source.source_id ?? 'unknown'} missing ${field}`);
    }
  }
  if (!Array.isArray(sourcePack.claims) || sourcePack.claims.length < 5) {
    failures.push('source pack needs at least 5 claim cards');
  }
  const colors = new Set((sourcePack.claims ?? []).map((claim) => claim.card_color));
  for (const color of ['green', 'yellow', 'red', 'black']) {
    if (!colors.has(color)) failures.push(`missing ${color} evidence claim card`);
  }
  for (const claim of sourcePack.claims ?? []) {
    for (const field of ['claim_id', 'claim', 'source_ids', 'evidence_level', 'confidence', 'uncertainty', 'card_color']) {
      if (!claim[field] || (Array.isArray(claim[field]) && claim[field].length === 0)) {
        failures.push(`${claim.claim_id ?? 'unknown'} missing ${field}`);
      }
    }
  }
  return failures.length ? fail('source_pack', failures) : pass('source_pack', `${sourcePack.sources.length} sources, ${sourcePack.claims.length} claims`);
}

function checkLearningPack(learningPack) {
  const failures = [];
  for (const field of ['beginner_5_min', 'practitioner_30_min', 'expert_memo', 'teach_back']) {
    if (!learningPack[field] || learningPack[field].length < 40) failures.push(`missing or thin ${field}`);
  }
  const ladder = learningPack.scenario_ladder ?? {};
  for (const field of ['base_case', 'bull_case', 'bear_case', 'change_our_mind', 'review_date']) {
    if (!ladder[field] || (Array.isArray(ladder[field]) && ladder[field].length < 2)) {
      failures.push(`scenario_ladder missing ${field}`);
    }
  }
  if ((learningPack.glossary ?? []).length < 5) failures.push('glossary needs at least 5 terms');
  if ((learningPack.quiz ?? []).length < 5) failures.push('quiz needs at least 5 questions');
  return failures.length ? fail('learning_pack', failures) : pass('learning_pack', 'beginner/practitioner/expert/scenario/quiz present');
}

function checkSkill(skillText, distillation) {
  const failures = [];
  const requiredSections = [
    'Non-Advice Boundary',
    'Source Requirements',
    'Workflow',
    'Hard Gates',
    'Output Contract',
    'Evals',
    'Archive Rules',
  ];
  for (const section of requiredSections) {
    if (!skillText.includes(section)) failures.push(`missing section ${section}`);
  }
  for (const gate of distillation.hard_gates ?? []) {
    const key = gate.split('.')[0].toLowerCase();
    if (!skillText.toLowerCase().includes(key.slice(0, 18))) {
      failures.push(`skill does not reflect gate: ${gate}`);
    }
  }
  const outputTerms = ['status:', 'source_ledger:', 'invalidation_points:', 'manual_review_required:', 'shiguan_review_date:'];
  if (!hasAll(skillText, outputTerms)) failures.push('output contract missing required terms');
  return failures.length ? fail('candidate_skill', failures) : pass('candidate_skill', distillation.skill_name);
}

function checkGoldenCases(cases) {
  const failures = [];
  if ((cases.cases ?? []).length < 5) failures.push('needs at least five golden cases');
  const ids = new Set((cases.cases ?? []).map((item) => item.id));
  for (const id of ['verified_chokepoint_good', 'viral_microcap_bad', 'design_win_not_revenue', 'theme_correct_company_wrong', 'after_move_chase']) {
    if (!ids.has(id)) failures.push(`missing case ${id}`);
  }
  for (const item of cases.cases ?? []) {
    if (!item.expected_status || !Array.isArray(item.must_include) || item.must_include.length === 0) {
      failures.push(`${item.id} missing expected status or must_include`);
    }
  }
  return failures.length ? fail('golden_cases', failures) : pass('golden_cases', `${cases.cases.length} cases`);
}

function checkOutcomeLedger(outcomeLedger) {
  const failures = [];
  if ((outcomeLedger.review_plan ?? []).length < 3) failures.push('review plan needs 30/60/90 day checks');
  const days = new Set((outcomeLedger.review_plan ?? []).map((item) => item.day));
  for (const day of [30, 60, 90]) {
    if (!days.has(day)) failures.push(`missing day ${day} review`);
  }
  if ((outcomeLedger.outcome_metrics ?? []).length < 3) failures.push('needs at least 3 outcome metrics');
  return failures.length ? fail('outcome_ledger', failures) : pass('outcome_ledger', '30/60/90 review plan present');
}

function checkGeniusDesignCoverage(sourcePack, learningPack, skillText, outcomeLedger) {
  const failures = [];
  if (!sourcePack.topic || !learningPack.topic || !skillText.includes('Hubu Bottleneck Investing Skill')) {
    failures.push('one-click learn-into-skill chain incomplete');
  }
  const colors = new Set(sourcePack.claims.map((claim) => claim.card_color));
  if (!['green', 'yellow', 'red', 'black'].every((color) => colors.has(color))) {
    failures.push('red/yellow/green/black evidence notebook incomplete');
  }
  if (!skillText.includes('Output Contract') || !skillText.includes('Hard Gates')) {
    failures.push('skill forge incomplete');
  }
  if (!learningPack.scenario_ladder?.change_our_mind?.length) {
    failures.push('qintianjian scenario ladder incomplete');
  }
  if (!outcomeLedger.review_plan?.length) {
    failures.push('shiguan outcome ledger incomplete');
  }
  return failures.length ? fail('genius_design_coverage', failures) : pass('genius_design_coverage', '5/5 designs covered');
}

async function main() {
  const sourcePack = await readJson(files.sourcePack);
  const learningPack = await readJson(files.learningPack);
  const distillation = await readJson(files.distillation);
  const outcomeLedger = await readJson(files.outcomeLedger);
  const skillText = await readText(files.skill);
  const cases = await readJson(files.cases);

  const checks = [
    checkSourcePack(sourcePack),
    checkLearningPack(learningPack),
    checkSkill(skillText, distillation),
    checkGoldenCases(cases),
    checkOutcomeLedger(outcomeLedger),
    checkGeniusDesignCoverage(sourcePack, learningPack, skillText, outcomeLedger),
  ];
  const passed = checks.filter((check) => check.status === 'pass').length;
  const report = {
    suite: 'deep-research-skill-distillation',
    generated_at: new Date().toISOString(),
    passed,
    total: checks.length,
    status: passed === checks.length ? 'pass' : 'fail',
    checks,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(path.join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(
    path.join(REPORT_DIR, 'latest.md'),
    [
      '# Deep Research Skill Distillation Report',
      '',
      `Status: ${report.status}`,
      `Passed: ${passed}/${checks.length}`,
      '',
      ...checks.map((check) => `- ${check.status.toUpperCase()} ${check.name}: ${Array.isArray(check.evidence) ? check.evidence.join('; ') : check.evidence}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'pass') process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
