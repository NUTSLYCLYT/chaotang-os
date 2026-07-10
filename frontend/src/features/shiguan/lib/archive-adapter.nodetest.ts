import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeArchiveResponse } from './archive-adapter.ts';

test('normalizes the canonical memorials and decisions archive envelope', () => {
  const result = normalizeArchiveResponse({
    success: true,
    data: {
      memorials: [{
        id: 'mem-1',
        title: '河道修缮奏折',
        sourceDepartment: '工部',
        agentCode: 'gong_bu',
        status: 'approved',
        createdAt: '2026-07-10T08:00:00Z',
      }],
      decisions: [{
        id: 'decision-1',
        memorialId: 'mem-1',
        action: 'approve',
        reviewerName: '皇上',
        createdAt: '2026-07-10T09:00:00Z',
      }],
    },
  });

  assert.equal(result.data.length, 2);
  assert.equal(result.data[0]?.title, '河道修缮奏折');
  assert.equal(result.data[0]?.outcome, 'success');
  assert.equal(result.data[0]?.isGovernance, false);
  assert.equal(result.data[1]?.title, '河道修缮奏折');
  assert.equal(result.data[1]?.isGovernance, true);
  assert.equal(result.meta.total, 2);
});

test('preserves a legacy flat archive response without throwing', () => {
  const legacyRecord = {
    id: 'legacy-1',
    title: '旧档案',
    type: '蜂群任务',
    outcome: 'pending',
    department: '吏部',
    date: '2026-07-01T00:00:00Z',
  };

  const result = normalizeArchiveResponse({ success: true, data: [legacyRecord] });
  assert.deepEqual(result.data, [legacyRecord]);
});

test('returns an empty array for malformed data so page array operations remain safe', () => {
  const result = normalizeArchiveResponse({ success: true, data: { unexpected: true } });
  assert.deepEqual(result.data, []);
  assert.equal(result.meta.total, 0);
});
