import assert from 'node:assert/strict';
import test from 'node:test';

import { buildShallowDepartmentOpinionsV1, loadCourtDepartmentRegistry } from '../departments/registry.ts';
import { buildDeepOfficeOpinionsV1, listDepartmentOfficeProfiles } from '../departments/offices.ts';

test('Goal 7 registers deep Office profiles through the current department registry', () => {
  const registry = loadCourtDepartmentRegistry();
  const byId = new Map(registry.map((entry) => [entry.id, entry]));

  assert.equal(byId.get('jinyiwei')?.office_profile, 'jinyiwei_intelligence_office');
  assert.equal(byId.get('finance')?.office_profile, 'hubu_cfo_office');
  assert.equal(byId.get('war')?.office_profile, 'bingbu_cro_sales_office');
  assert.equal(byId.get('personnel')?.office_profile, 'libu_chro_cao_office');
  assert.equal(byId.get('justice')?.office_profile, 'xingbu_clo_cco_office');
  assert.equal(byId.get('ritual')?.office_profile, 'rites_cmo_cco_office');
  assert.equal(byId.get('works')?.office_profile, 'gongbu_cto_cpo_delivery_office');

  const profiles = listDepartmentOfficeProfiles();
  assert.ok(profiles.length >= 7);
  for (const profile of profiles) {
    assert.equal(profile.output_schema, 'DepartmentOpinionV1');
    assert.ok(profile.evidence_inputs.length >= 4);
    assert.ok(profile.risk_model.length >= 3);
  }
});

test('Goal 7 deep Offices emit DepartmentOpinionV1-compatible results without replacing the unified loop', () => {
  const registry = loadCourtDepartmentRegistry();
  const question = '客户要求正式报价，要不要发？需要客户回复话术、审批人、成本、毛利、付款条件、报价有效期、交付边界和验收条件。';
  const knownFacts = [`用户原问：${question}`, '事项涉及正式报价边界'];
  const deepOpinions = buildDeepOfficeOpinionsV1({
    taskId: 'task_goal7_quote',
    question,
    knownFacts,
    sourceLabel: 'FALLBACK',
    entries: registry,
  });
  assert.equal(deepOpinions.length, registry.length);
  for (const opinion of deepOpinions) {
    assert.equal(opinion.schema_version, 'DepartmentOpinionV1');
    assert.equal(opinion.source_label, 'FALLBACK');
    assert.ok(opinion.summary.includes('深度意见'));
    assert.ok(opinion.evidence.length > 0);
    assert.ok(opinion.missing_evidence.length > 0 || opinion.risks.length > 0);
  }

  const fullOpinions = buildShallowDepartmentOpinionsV1({
    taskId: 'task_goal7_quote',
    question,
    knownFacts,
    sourceLabel: 'FALLBACK',
    registry,
  });
  for (const id of ['jinyiwei', 'finance', 'war', 'personnel', 'justice', 'ritual', 'works']) {
    const opinion = fullOpinions.find((item) => item.department_id === id);
    assert.ok(opinion, `missing ${id}`);
    assert.ok(opinion.summary.includes('深度意见'), `${id} did not use office layer`);
  }
});
