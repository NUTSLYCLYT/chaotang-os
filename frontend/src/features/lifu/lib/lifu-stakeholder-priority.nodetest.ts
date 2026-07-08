import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prioritizeStakeholders, type StakeholderRecord } from './lifu-stakeholder-priority.ts';

function rec(o: Partial<StakeholderRecord> & { id: string }): StakeholderRecord {
  return { name: o.id, recencyDays: 30, frequency: 3, monetary: 10000, power: false, legitimacy: false, urgency: false, interest: false, ...o };
}

test('Definitive(权力+正当+紧迫)排最前;non 垫底', () => {
  const out = prioritizeStakeholders([
    rec({ id: 'low' }),
    rec({ id: 'def', power: true, legitimacy: true, urgency: true }),
  ]);
  assert.equal(out[0].id, 'def');
  assert.equal(out[0].salience.class, 'definitive');
  assert.equal(out[out.length - 1].salience.class, 'non');
});

test('RFM:近期+高频+高额→核心;久未+低→流失/已凉', () => {
  const out = prioritizeStakeholders([
    rec({ id: 'champ', recencyDays: 2, frequency: 20, monetary: 500000 }),
    rec({ id: 'lost', recencyDays: 300, frequency: 1, monetary: 1000 }),
  ]);
  const champ = out.find((x) => x.id === 'champ')!;
  const lost = out.find((x) => x.id === 'lost')!;
  assert.ok(champ.rfm.r >= champ.rfm.r && champ.rfm.f >= 4);
  assert.match(champ.rfm.segment, /Champions|稳定/);
  assert.match(lost.rfm.segment, /Lost|流失|待经营/);
});

test('Mendelow 象限', () => {
  const out = prioritizeStakeholders([
    rec({ id: 'pi', power: true, interest: true }),
    rec({ id: 'p', power: true, interest: false }),
    rec({ id: 'i', power: false, interest: true }),
    rec({ id: 'none' }),
  ]);
  assert.equal(out.find((x) => x.id === 'pi')!.mendelow, 'manage_closely');
  assert.equal(out.find((x) => x.id === 'p')!.mendelow, 'keep_satisfied');
  assert.equal(out.find((x) => x.id === 'i')!.mendelow, 'keep_informed');
  assert.equal(out.find((x) => x.id === 'none')!.mendelow, 'monitor');
});

test('诚实:人工裁量输入被标记(防伪客观)', () => {
  const [withJudge] = prioritizeStakeholders([rec({ id: 'x', power: true, urgency: true })]);
  assert.ok(withJudge.humanJudged.some((h) => h.includes('Salience')));
});

test('空队列不崩', () => {
  assert.deepEqual(prioritizeStakeholders([]), []);
});
