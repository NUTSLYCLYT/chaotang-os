import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildShallowDepartmentOpinionsV1,
  loadCourtDepartmentRegistry,
  selectRegistryDepartments,
} from '../departments/registry.ts';

const REQUIRED_IDS = [
  'jinyiwei',
  'finance',
  'war',
  'personnel',
  'justice',
  'ritual',
  'works',
];

test('Goal 6 registry exposes current unified departments with protocol metadata', () => {
  const registry = loadCourtDepartmentRegistry();
  const ids = registry.map((entry) => entry.id);
  for (const id of REQUIRED_IDS) assert.ok(ids.includes(id), `missing ${id}`);
  for (const entry of registry) {
    assert.ok(entry.protocol_id);
    assert.ok(entry.runtime_id);
    assert.ok(entry.name);
    assert.ok(entry.output_schema);
    assert.ok(entry.review_skill);
    assert.ok(Array.isArray(entry.route_keywords));
    assert.ok(Array.isArray(entry.required_evidence));
    assert.ok(entry.default_participation);
    assert.ok(entry.complexity_profile);
    assert.ok(entry.user_visible_summary);
  }
});

test('Goal 6 registry selection emits DepartmentOpinionV1 for a formal quote question', () => {
  const question = '客户要求正式报价，要不要发？需要客户话术、审批人、付款条件和报价有效期。';
  const registry = loadCourtDepartmentRegistry();
  const selected = selectRegistryDepartments({ question, registry });
  const selectedIds = selected.map((entry) => entry.id);
  for (const id of ['jinyiwei', 'finance', 'war', 'personnel', 'justice', 'ritual']) {
    assert.ok(selectedIds.includes(id), `selected missing ${id}`);
  }

  const opinions = buildShallowDepartmentOpinionsV1({
    taskId: 'task_goal6_quote',
    question,
    knownFacts: [`用户原问：${question}`],
    sourceLabel: 'FALLBACK',
    registry,
  });
  assert.equal(opinions.length, selected.length);
  for (const opinion of opinions) {
    assert.equal(opinion.schema_version, 'DepartmentOpinionV1');
    assert.ok(REQUIRED_IDS.includes(opinion.department_id));
    assert.equal(opinion.source_label, 'FALLBACK');
    assert.ok(opinion.evidence.length > 0 || opinion.missing_evidence.length > 0);
    assert.ok(opinion.next_order.length > 0);
  }
});
