import assert from 'node:assert/strict';
import test from 'node:test';

import type { ContractTaskReadModelV1 } from '@/lib/contracts/backend-openapi-2026-07-21';
import {
  contractReviewUiPolicy,
  isContractActionAllowed,
} from './action-policy';

function model(
  overrides: Partial<ContractTaskReadModelV1> = {},
): ContractTaskReadModelV1 {
  return {
    schema_version: 'ContractTaskReadModelV1',
    read_revision: 'a'.repeat(64),
    generated_at: '2026-07-27T00:00:00Z',
    source_class: 'ADJUDICABLE',
    task: {
      task_id: 'task-1',
      tenant_id: 7,
      status: 'reviewing',
      source_label: 'LIVE',
      raw_question: '审查采购合同',
    },
    allowed_actions: [],
    blockers: [],
    ...overrides,
  };
}

test('never invents an action absent from the server response', () => {
  const value = model({ allowed_actions: ['DOWNLOAD_ARTIFACT'] });

  assert.equal(isContractActionAllowed(value, 'DOWNLOAD_ARTIFACT'), true);
  assert.equal(isContractActionAllowed(value, 'DECIDE'), false);
  assert.equal(contractReviewUiPolicy(value).canDownload, true);
  assert.equal(
    contractReviewUiPolicy(model({ allowed_actions: [] })).canDownload,
    false,
  );
});

test('PARTIAL after refresh is not delivered or resumable', () => {
  const value = model({
    allowed_actions: ['DOWNLOAD_ARTIFACT'],
    blockers: [{ code: 'PARTIAL_RECOVERY_REQUIRES_HARDENING' }],
    delivery: {
      manifest_id: 'manifest-1',
      task_id: 'task-1',
      final_memorial_id: 'final-1',
      final_memorial_version: 1,
      delivery_formula_version: 'w06-v1',
      delivery_revision: 1,
      payload_hash: 'b'.repeat(64),
      artifacts: [],
      overall_status: 'PARTIAL',
    },
  });

  const policy = contractReviewUiPolicy(value);
  assert.equal(policy.deliveryState, 'PARTIAL');
  assert.equal(policy.isDelivered, false);
  assert.equal(policy.canResume, false);
});

test('archive state requires an exact receipt', () => {
  assert.equal(contractReviewUiPolicy(model()).isArchived, false);
  assert.equal(
    contractReviewUiPolicy(model({
      archive_receipt: {
        archive_id: 'archive-1',
        task_id: 'task-1',
        final_memorial_id: 'final-1',
        final_memorial_version: 1,
        final_memorial_content_hash: 'c'.repeat(64),
        archived_at: '2026-07-27T00:00:00Z',
        source_label: 'LIVE',
      },
    })).isArchived,
    true,
  );
});

test('effective FALLBACK remains visibly non-live even when task source is LIVE', () => {
  const policy = contractReviewUiPolicy(model({
    source_class: 'FALLBACK',
  }));

  assert.equal(policy.sourceState, 'FALLBACK');
  assert.equal(policy.isLive, false);
});
