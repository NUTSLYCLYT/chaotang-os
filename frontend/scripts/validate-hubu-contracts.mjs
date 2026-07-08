import fs from 'node:fs';
import path from 'node:path';
import { contractExists, contractRead, contractReaddir } from './lib/dev-contract-paths.mjs';

const root = process.cwd();

const requiredFiles = [
  'config/departments.registry.yaml',
  'config/hubu.cfo_office.registry.yaml',
  'loops/hubu_cfo_office.loop.yaml',
  'schemas/HubuCFOOpinionV1.json',
  'schemas/HubuSubOfficeReviewV1.json',
  'schemas/FinanceEvidencePackV1.json',
  'schemas/HubuQualityGateResultV1.json',
  'prompts/departments/hubu/cfo_chief.system.md',
  'prompts/departments/hubu/fpna_budget.system.md',
  'prompts/departments/hubu/treasury_cash.system.md',
  'prompts/departments/hubu/controller_books.system.md',
  'prompts/departments/hubu/cost_pricing.system.md',
  'prompts/departments/hubu/investment_review.system.md',
  'prompts/departments/hubu/audit_control.system.md',
  'prompts/departments/hubu/quality_gate.system.md',
  'evals/hubu_cfo_office.golden.jsonl',
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

const registry = read('config/hubu.cfo_office.registry.yaml');
for (const token of ['户部尚书', '度支司', '金库司', '计簿司', '价本司', '投审司', '稽核司']) {
  assert(registry.includes(token), `hubu registry missing P0 office: ${token}`);
}

const departmentsRegistry = read('config/departments.registry.yaml');
assert(departmentsRegistry.includes('real_world_equivalent: CFO Office'), 'departments registry must define hubu as CFO Office');

const loopFiles = contractReaddir('loops')
  .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'));
for (const file of loopFiles) {
  const content = read('loops/' + file);
  assert(!/^id:\s*five_department_review/m.test(content), `loop must not introduce five_department_review: ${file}`);
}

const loop = read('loops/hubu_cfo_office.loop.yaml');
for (const gate of [
  'source_label_required',
  'no_financial_certainty_without_numbers',
  'cash_risk_must_be_visible',
  'roi_must_mark_assumptions',
  'formal_quote_requires_cost_and_margin',
  'investment_requires_downside_case',
]) {
  assert(loop.includes(gate) || registry.includes(gate), `missing hubu quality gate: ${gate}`);
}

const cfoSchema = JSON.parse(read('schemas/HubuCFOOpinionV1.json'));
const schemaText = JSON.stringify(cfoSchema);
assert(schemaText.includes('sourceLabel') || schemaText.includes('source_label'), 'HubuCFOOpinionV1 must include source label');

const goldenLines = read('evals/hubu_cfo_office.golden.jsonl')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
assert(goldenLines.length >= 5, 'hubu golden eval must include at least 5 cases');
for (const line of goldenLines) {
  const item = JSON.parse(line);
  assert(item.id && item.input, `golden case missing id/input: ${line}`);
  assert(item.source_label_required === true, `golden case must require source_label: ${item.id}`);
}

console.log(`Hubu CFO Office contracts OK: ${requiredFiles.length} files, ${goldenLines.length} golden cases`);
