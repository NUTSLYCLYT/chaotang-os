import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBU_OFFICES, LIBU_OFFICE_NAMES, officeByCode, LIBU_SWARM_RESOURCES } from './libu-personnel-admin-office.ts';

test('6司:3HR+3行政', () => {
  assert.equal(LIBU_OFFICES.length, 6);
  assert.equal(LIBU_OFFICES.filter((o) => o.group === 'hr').length, 3);
  assert.equal(LIBU_OFFICES.filter((o) => o.group === 'admin').length, 3);
});
test('铨叙司引擎已建,其余planned', () => {
  assert.equal(officeByCode('appraisal_tenure')?.engine, 'built');
  assert.equal(officeByCode('qualification_cert')?.engine, 'planned');
});
test('行政侧含申报/资质(军工电池厂命脉)', () => {
  assert.equal(LIBU_OFFICE_NAMES.policy_declaration, '申报司');
  assert.equal(LIBU_OFFICE_NAMES.qualification_cert, '资质司');
  assert.match(officeByCode('qualification_cert')?.duty ?? '', /军工|装备承制/);
});
test('蜂群资源:吏部执行蜂群在册', () => {
  assert.ok(LIBU_SWARM_RESOURCES.some((s) => s.id === 'personnel_execution_swarm'));
});
