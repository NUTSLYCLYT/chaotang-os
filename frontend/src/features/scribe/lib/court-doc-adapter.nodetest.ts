import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCourtDocResponse } from './court-doc-adapter.ts';

test('normalizes the /api/scribe/archive-docs success envelope', () => {
  const docs = normalizeCourtDocResponse({
    success: true,
    data: {
      docs: [
        {
          caseId: 'task_a',
          light: 'green',
          headline: '奏折A',
          shielded: null,
          items: [
            { level: 'yellow', title: '下次先测超时', odds: null, impact: null, fix: null, evidenceRef: null },
          ],
          actions: ['open_annals', 'trace_evidence', 'feed_flywheel', 'export_amulet'],
          provenance: { advisors: [], grounding: 'none', gate: 'passed' },
          sourceLabel: 'LIVE',
          signed: true,
          sealedArchive: null,
        },
      ],
    },
  });

  assert.equal(docs.length, 1);
  assert.equal(docs[0]?.caseId, 'task_a');
  assert.equal(docs[0]?.light, 'green');
  assert.equal(docs[0]?.items[0]?.evidenceRef, null);
  assert.equal(docs[0]?.provenance.gate, 'passed');
  assert.equal(docs[0]?.signed, true);
});

test('drops malformed doc entries instead of throwing', () => {
  const docs = normalizeCourtDocResponse({
    success: true,
    data: { docs: [{ caseId: 'bad', light: 'not-a-light', sourceLabel: 'LIVE' }, null, 'oops'] },
  });
  assert.deepEqual(docs, []);
});

test('returns an empty array for malformed/missing data so page array operations remain safe', () => {
  assert.deepEqual(normalizeCourtDocResponse({ success: true, data: {} }), []);
  assert.deepEqual(normalizeCourtDocResponse(null), []);
});
