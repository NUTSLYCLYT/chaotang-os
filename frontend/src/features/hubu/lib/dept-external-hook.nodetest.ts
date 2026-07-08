import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveConnectors, compareInternalExternal, DEPT_CONNECTOR_PRESET } from './dept-external-hook.ts';

test('预留口子:默认 connected=false(诚实未接)', () => {
  const cs = reserveConnectors(['bookkeeping', 'tax_authority']);
  assert.equal(cs.length, 2);
  assert.ok(cs.every((c) => c.connected === false && c.grade === null));
  assert.match(cs[0].note, /口子已留/);
});

test('记账/税务/审计 都预设了外部口子', () => {
  assert.ok(DEPT_CONNECTOR_PRESET.accountant.includes('bookkeeping'));
  assert.ok(DEPT_CONNECTOR_PRESET.tax.includes('tax_authority'));
  assert.ok(DEPT_CONNECTOR_PRESET.audit_control.includes('audit_log'));
});

test('内外对比:有内外→高/低于同行', () => {
  const r = compareInternalExternal('毛利率', 35, 28, 'industry_benchmark');
  assert.equal(r.verdict, 'above');
  assert.match(r.note, /35.*28.*高于/);
});

test('内外对比:无外部→诚实"口子已留待接",不编', () => {
  const r = compareInternalExternal('税负', 12, null, null);
  assert.equal(r.verdict, 'no_external');
  assert.match(r.note, /口子已留|待接/);
});

test('内外对比:无内部→先上传', () => {
  const r = compareInternalExternal('毛利率', null, 28, 'industry_benchmark');
  assert.equal(r.verdict, 'no_internal');
});
