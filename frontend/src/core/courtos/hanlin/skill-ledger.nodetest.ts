/**
 * 翰林院借调账本回归断言(铁律4)。跑: pnpm test:node
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  adoptedRate,
  canPromoteToArmory,
  shouldRetire,
  validateBorrow,
  DEFAULT_STALE_DAYS,
  type SkillRegistryEntry,
  type BorrowRecord,
} from './skill-ledger.ts';

function entry(o: Partial<SkillRegistryEntry> = {}): SkillRegistryEntry {
  return {
    id: 's1', name: '三层摘要模板', origin: 'forge', status: 'incubating',
    capabilityTags: ['summarize'], usedCount: 3, adoptedCount: 2, lastUsedAt: 1_000_000, painPointClaimed: true,
    ...o,
  };
}

// ── 用过才入库 ──
test('入库:used_count=0 永远不得升武库(无死库存)', () => {
  const r = canPromoteToArmory(entry({ usedCount: 0, adoptedCount: 0 }));
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('用过才入库'));
});

test('入库:无认领痛点不得入库', () => {
  assert.equal(canPromoteToArmory(entry({ painPointClaimed: false })).ok, false);
});

test('入库:用过+采纳率达标+认领痛点→可升武库', () => {
  assert.equal(canPromoteToArmory(entry({ usedCount: 4, adoptedCount: 3 })).ok, true);
});

test('入库:采纳率低于阈值→拒', () => {
  assert.equal(canPromoteToArmory(entry({ usedCount: 10, adoptedCount: 1 })).ok, false);
});

test('采纳率:从未借=0(不是1,防零样本伪满分)', () => {
  assert.equal(adoptedRate({ usedCount: 0, adoptedCount: 0 }), 0);
  assert.equal(adoptedRate({ usedCount: 4, adoptedCount: 2 }), 0.5);
});

// ── 90 天零借调退役 ──
test('退役:armory 超90天零借调→退役', () => {
  const now = 1_000_000 + (DEFAULT_STALE_DAYS + 1) * 86_400_000;
  assert.equal(shouldRetire(entry({ status: 'armory' }), now).ok, true);
});

test('退役:armory 入库即从未被借→退役', () => {
  assert.equal(shouldRetire(entry({ status: 'armory', lastUsedAt: null }), 9_999_999).ok, true);
});

test('退役:armory 90天内有借调→留库', () => {
  const now = 1_000_000 + 10 * 86_400_000;
  assert.equal(shouldRetire(entry({ status: 'armory' }), now).ok, false);
});

// ── 借调 SSOT fail-fast(铁律2) ──
const depts = new Set(['finance', 'legal', 'works']);
const ids = new Set(['s1', 's2']);
function rec(o: Partial<BorrowRecord> = {}): BorrowRecord {
  return { skillId: 's1', callerDept: 'finance', loopId: 'L1', ts: 1, outcome: 'adopted', ...o };
}

test('借调:合法部门码+已注册skill→通过', () => {
  assert.equal(validateBorrow(rec(), ids, depts).valid, true);
});

test('借调:借调方非SSOT部门码→fail-fast拒(铁律2,不静默回退)', () => {
  const r = validateBorrow(rec({ callerDept: 'mystery_dept' }), ids, depts);
  assert.equal(r.valid, false);
  assert.ok(r.error?.includes('SSOT'));
});

test('借调:skillId不在registry→拒(禁硬编路径)', () => {
  assert.equal(validateBorrow(rec({ skillId: 'ghost' }), ids, depts).valid, false);
});
