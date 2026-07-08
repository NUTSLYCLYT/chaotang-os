import { test } from 'node:test';
import assert from 'node:assert/strict';

import { relationshipHealth, type Stakeholder } from './lifu-relationship.ts';

const NOW = '2026-06-29T00:00:00.000Z';
function ago(days: number): string {
  return new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
}

test('久未联系的活跃关系→该跟进(关系将凉)', () => {
  const list: Stakeholder[] = [
    { id: 's1', name: '某局长', type: 'gov', stage: 'negotiating', lastContact: ago(45), nextAction: '约饭' },
    { id: 's2', name: '某合作方', type: 'partner', stage: 'engaged', lastContact: ago(5), nextAction: '发方案' },
  ];
  const h = relationshipHealth(list, NOW);
  const ids = h.needsFollowUp.map((a) => a.id);
  assert.ok(ids.includes('s1')); // 45天未联系
  assert.ok(!ids.includes('s2')); // 5天前联系过+有下一步
});

test('活跃关系无接触记录 / 无下一步 → 该跟进', () => {
  const list: Stakeholder[] = [
    { id: 'a', name: 'A', type: 'media', stage: 'contacted' }, // 无 lastContact
    { id: 'b', name: 'B', type: 'client_exec', stage: 'engaged', lastContact: ago(3) }, // 无 nextAction
  ];
  const h = relationshipHealth(list, NOW);
  assert.equal(h.needsFollowUp.length, 2);
});

test('dormant/cold 不催;阶段分布统计', () => {
  const list: Stakeholder[] = [
    { id: 'd', name: 'D', type: 'other', stage: 'dormant', lastContact: ago(200) },
    { id: 'c', name: 'C', type: 'other', stage: 'cold' },
  ];
  const h = relationshipHealth(list, NOW);
  assert.equal(h.needsFollowUp.length, 0); // 非活跃阶段不催
  assert.equal(h.byStage.dormant, 1);
  assert.equal(h.byStage.cold, 1);
});
