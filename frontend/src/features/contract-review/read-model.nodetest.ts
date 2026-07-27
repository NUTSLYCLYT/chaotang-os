import assert from 'node:assert/strict';
import test from 'node:test';

import { parseContractTaskReadModel } from './read-model';

function readModel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    allowed_actions: ['DOWNLOAD_ARTIFACT', 'DECIDE'],
    blockers: [],
    ...overrides,
  };
}

test('accepts an exact generated backend read model', () => {
  const parsed = parseContractTaskReadModel(readModel());

  assert.equal(parsed.task.task_id, 'task-1');
  assert.deepEqual(parsed.allowed_actions, ['DOWNLOAD_ARTIFACT', 'DECIDE']);
});

test('fails closed on an unknown server action', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({ allowed_actions: ['CLIENT_INVENTED_ACTION'] }),
    ),
    /unknown contract action/,
  );
});

test('fails closed on an unknown blocker', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({ blockers: [{ code: 'UNKNOWN_BLOCKER' }] }),
    ),
    /unknown contract blocker/,
  );
});

test('fails closed on an unknown effective source class', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({ source_class: 'CLIENT_INFERRED_LIVE' }),
    ),
    /source class/,
  );
});

test('rejects mission identity that does not bind to the requested task', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({
        mission: {
          state: 'CONFIRMED',
          mission: {
            task_id: 'task-other',
            mission_contract_id: 'task-1',
          },
        },
      }),
    ),
    /lineage/,
  );
});

test('rejects an invalid public delivery shape', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({
        delivery: {
          manifest_id: 'manifest-1',
          overall_status: 'READY',
          resume_token: 'must-not-be-public',
        },
      }),
    ),
    /invalid contract delivery/,
  );
});

test('rejects contradictory task, final, delivery and receipt lineage', () => {
  const exactFinal = {
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    final_memorial_content_hash: 'b'.repeat(64),
    court_review_id: 'review-1',
    status: 'archived',
    source_label: 'LIVE',
  };
  const exactDelivery = {
    manifest_id: 'manifest-1',
    task_id: 'task-1',
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    delivery_formula_version: 'w06-v1',
    delivery_revision: 1,
    payload_hash: 'c'.repeat(64),
    artifacts: [],
    overall_status: 'READY',
  };
  const exactReceipt = {
    archive_id: 'archive-1',
    task_id: 'task-1',
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    final_memorial_content_hash: 'b'.repeat(64),
    archived_at: '2026-07-27T00:00:00Z',
    source_label: 'LIVE',
  };

  for (const override of [
    { delivery: { ...exactDelivery, task_id: 'task-other' } },
    { delivery: { ...exactDelivery, final_memorial_version: 2 } },
    {
      archive_receipt: {
        ...exactReceipt,
        final_memorial_content_hash: 'd'.repeat(64),
      },
    },
  ]) {
    assert.throws(
      () => parseContractTaskReadModel(readModel({
        final_memorial: exactFinal,
        ...override,
      })),
      /lineage/,
    );
  }
});
