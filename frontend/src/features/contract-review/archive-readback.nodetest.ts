import assert from 'node:assert/strict';
import test from 'node:test';

import type { ContractTaskReadModelV1 } from '@/lib/contracts/backend-openapi-2026-07-21';
import {
  buildContractArchiveDetail,
  selectArchiveDetail,
} from './archive-readback';

function model(hasReceipt: boolean): ContractTaskReadModelV1 {
  return {
    schema_version: 'ContractTaskReadModelV1',
    read_revision: 'a'.repeat(64),
    generated_at: '2026-07-27T00:00:00Z',
    source_class: 'ADJUDICABLE',
    task: {
      task_id: 'task-1',
      tenant_id: 7,
      status: 'archived',
      source_label: 'LIVE',
      raw_question: '审查采购合同',
    },
    final_memorial: {
      final_memorial_id: 'final-1',
      final_memorial_version: 1,
      final_memorial_content_hash: 'b'.repeat(64),
      court_review_id: 'review-1',
      status: 'archived',
      source_label: 'LIVE',
    },
    delivery: {
      manifest_id: 'manifest-1',
      task_id: 'task-1',
      final_memorial_id: 'final-1',
      final_memorial_version: 1,
      delivery_formula_version: 'w06-v1',
      delivery_revision: 1,
      payload_hash: 'c'.repeat(64),
      artifacts: [],
      overall_status: 'READY',
    },
    archive_receipt: hasReceipt ? {
      archive_id: 'archive-1',
      task_id: 'task-1',
      final_memorial_id: 'final-1',
      final_memorial_version: 1,
      final_memorial_content_hash: 'b'.repeat(64),
      archived_at: '2026-07-27T00:00:00Z',
      source_label: 'LIVE',
    } : null,
    allowed_actions: hasReceipt ? ['REOPEN_ARCHIVE'] : [],
    blockers: [],
  };
}

test('does not create archive detail without an exact receipt', () => {
  assert.equal(buildContractArchiveDetail(model(false)), null);
});

test('maps exact receipt identity into the existing Shiguan detail contract', () => {
  const detail = buildContractArchiveDetail(model(true));

  assert.equal(detail?.id, 'archive-1');
  assert.equal(detail?.sourceLabel, 'LIVE');
  assert.match(detail?.summary ?? '', /final-1/);
  assert.match(detail?.conclusion ?? '', /exact lineage/);
  assert.equal(detail?.decisionChain.at(-1)?.id, 'archive-1');
});

test('preserves LIVE_ENGINE as truthful live provenance in Shiguan', () => {
  const value = model(true);
  value.archive_receipt!.source_label = 'LIVE_ENGINE';

  const detail = buildContractArchiveDetail(value, 'archive-1');

  assert.equal(detail?.sourceLabel, 'LIVE');
});

test('rejects a contradictory exact receipt even for typed input', () => {
  const value = model(true);
  value.archive_receipt = {
    ...value.archive_receipt!,
    final_memorial_content_hash: 'd'.repeat(64),
  };

  assert.equal(buildContractArchiveDetail(value), null);
});

test('rejects an exact receipt that does not match the requested archive id', () => {
  assert.equal(
    buildContractArchiveDetail(model(true), 'archive-tampered'),
    null,
  );
  assert.equal(
    buildContractArchiveDetail(model(true), 'archive-1')?.id,
    'archive-1',
  );
});

test('rejects a receipt when effective source or delivery is not adjudicable', () => {
  const value = model(true);
  value.source_class = 'FALLBACK';
  value.delivery = {
    ...value.delivery!,
    overall_status: 'PARTIAL',
  };
  value.allowed_actions = [];
  value.blockers = [{ code: 'NON_ADJUDICABLE_SOURCE' }];

  assert.equal(buildContractArchiveDetail(value, 'archive-1'), null);
});

test('an exact task request never falls back to indexed detail', () => {
  const indexed = {
    id: 'indexed-1',
  } as ReturnType<typeof buildContractArchiveDetail>;
  const exact = buildContractArchiveDetail(model(true));

  assert.equal(selectArchiveDetail('task-1', null, indexed), null);
  assert.equal(selectArchiveDetail('task-1', exact, indexed, true), null);
  assert.equal(selectArchiveDetail(null, null, indexed), indexed);
});
