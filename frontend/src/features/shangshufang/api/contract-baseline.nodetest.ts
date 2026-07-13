import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const adapterSource = readFileSync(new URL('../../../lib/jiqun-api.ts', import.meta.url), 'utf8');

test('formal Shangshufang backend paths remain aligned across frontend adapters', () => {
  for (const path of [
    '/api/shangshufang/draft-edict',
    '/api/shangshufang/confirm-edict',
    '/api/shangshufang/tasks/${encodeURIComponent(taskId)}/status',
    '/api/shangshufang/tasks/${encodeURIComponent(taskId)}/decision',
  ]) {
    assert.match(apiSource, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const path of [
    '/api/court/shangshufang/draft-edict',
    '/api/court/shangshufang/confirm-edict',
    '/api/court/shangshufang/tasks/${encodeURIComponent(taskId)}/status',
    '/api/court/shangshufang/tasks/${encodeURIComponent(taskId)}/decision',
  ]) {
    assert.match(adapterSource, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('frontend exposes its current five-value source-label subset and records missing contracts', () => {
  assert.match(
    adapterSource,
    /ShangshufangSourceLabel = 'LIVE' \| 'LIVE_SWARM' \| 'MIXED' \| 'FALLBACK' \| 'DEMO'/,
  );
  assert.doesNotMatch(adapterSource, /'LIVE_ENGINE'/);
  assert.doesNotMatch(adapterSource, /engineTier\s*:/);
});
