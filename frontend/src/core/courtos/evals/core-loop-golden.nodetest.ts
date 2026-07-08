import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const goldenPath = path.join(root, 'dev/contracts/evals/courtos_core_loop.golden.jsonl');

type GoldenCase = {
  case_id: string;
  question: string;
  expected_schemas: string[];
  expected_departments: string[];
  assertions: Record<string, boolean>;
  risk_keywords: string[];
  expected_verdict_family: string[];
  notes: string;
};

function readGoldenCases(): GoldenCase[] {
  const raw = fs.readFileSync(goldenPath, 'utf8').trim();
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as GoldenCase);
}

test('CourtOS core golden eval file is readable and covers the MVP contract', () => {
  const cases = readGoldenCases();
  assert.equal(cases.length >= 5, true);
  for (const item of cases) {
    assert.ok(item.case_id);
    assert.ok(item.question.length >= 5);
    assert.ok(item.expected_schemas.includes('DraftEdictV1'));
    assert.ok(item.expected_schemas.includes('ReviewPlanV1'));
    assert.ok(item.expected_schemas.includes('MemorialV1'));
    assert.equal(item.assertions.has_source_label, true);
    assert.equal(item.assertions.has_evidence_or_missing_evidence, true);
    assert.equal(item.assertions.has_next_order, true);
    assert.equal(item.assertions.can_archive_to_shiguan, true);
    assert.ok(item.expected_departments.includes('jinyiwei_intelligence'));
  }
});

test('CourtOS core golden high-risk cases require human confirmation', () => {
  const cases = readGoldenCases();
  const highRisk = cases.filter((item) =>
    item.risk_keywords.some((keyword) => /合同|股权|正式报价|客户承诺|签字|法律责任/.test(keyword)),
  );
  assert.equal(highRisk.length >= 3, true);
  for (const item of highRisk) {
    assert.equal(item.assertions.high_risk_human_confirmation_required, true, item.case_id);
    assert.ok(
      item.expected_verdict_family.includes('RECHECK') ||
        item.expected_verdict_family.includes('NEED_EVIDENCE'),
      item.case_id,
    );
  }
});
