import assert from 'node:assert/strict';
import test from 'node:test';

import { parseContractTaskReadModel } from './read-model';

function reviewPack(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema_version: 'ContractReviewPackV1',
    review_pack_id: 'pack-1',
    tenant_id: '7',
    task_id: 'task-1',
    mission_contract_id: 'task-1',
    court_review_id: 'review-1',
    evidence_packet_ids: ['evidence-1'],
    jurisdiction: 'CN_MAINLAND',
    language: 'zh-CN',
    contract_type: 'procurement',
    our_role: 'buyer',
    legal_question: 'contract_risk_screening',
    risk_items: [],
    verdict: 'PROCEED_TO_HUMAN_APPROVAL',
    decision_summary: '具备人工批准条件',
    affected_sections: ['contract_review'],
    source_labels: ['TASK_EVIDENCE'],
    engine_tiers: ['deterministic'],
    quality_gate_status: 'PASSED',
    candidate_status: 'CANDIDATE',
    ...overrides,
  };
}

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
    allowed_actions: [],
    blockers: [{ code: 'MISSION_MISSING' }],
    ...overrides,
  };
}

test('accepts an exact generated backend read model', () => {
  const parsed = parseContractTaskReadModel(readModel(), 'task-1');

  assert.equal(parsed.task.task_id, 'task-1');
  assert.deepEqual(parsed.allowed_actions, []);
});

test('rejects a response that is not bound to the requested task id', () => {
  assert.throws(
    () => parseContractTaskReadModel(readModel(), 'task-requested'),
    /requested task/,
  );
});

test('fails closed on an unknown server action', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({ allowed_actions: ['CLIENT_INVENTED_ACTION'] }),
      'task-1',
    ),
    /unknown contract action/,
  );
});

test('fails closed on an unknown blocker', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({ blockers: [{ code: 'UNKNOWN_BLOCKER' }] }),
      'task-1',
    ),
    /unknown contract blocker/,
  );
});

test('fails closed on an unknown effective source class', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({ source_class: 'CLIENT_INFERRED_LIVE' }),
      'task-1',
    ),
    /source class/,
  );
});

test('rejects malformed-present mission and review pack values', () => {
  for (const override of [
    { mission: 'not-an-object' },
    { review_pack: 'not-an-object' },
    {
      review_pack: {
        task_id: 'task-1',
        mission_contract_id: 'task-1',
        tenant_id: '7',
        court_review_id: 'review-1',
      },
    },
  ]) {
    assert.throws(
      () => parseContractTaskReadModel(readModel(override), 'task-1'),
      /invalid|lineage/,
    );
  }
});

test('rejects invalid root identity hash and timestamp', () => {
  for (const override of [
    { read_revision: 'not-a-sha256' },
    { generated_at: 'not-a-timestamp' },
  ]) {
    assert.throws(
      () => parseContractTaskReadModel(readModel(override), 'task-1'),
      /invalid/,
    );
  }
});

test('rejects DECIDE when delivery or blockers contradict adjudication', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({
        allowed_actions: ['DECIDE'],
        blockers: [{ code: 'REVIEW_REVISION_REQUIRED' }],
        mission: {
          state: 'CONFIRMED',
          mission: {
            task_id: 'task-1',
            mission_contract_id: 'task-1',
          },
        },
        review_pack: reviewPack(),
        final_memorial: {
          final_memorial_id: 'final-1',
          final_memorial_version: 1,
          final_memorial_content_hash: 'c'.repeat(64),
          court_review_id: 'review-1',
          status: 'ready_for_decision',
          source_label: 'LIVE',
        },
        delivery: {
          manifest_id: 'manifest-1',
          task_id: 'task-1',
          final_memorial_id: 'final-1',
          final_memorial_version: 1,
          delivery_formula_version: 'w06-v1',
          delivery_revision: 1,
          payload_hash: 'b'.repeat(64),
          artifacts: [{
            artifact_id: 'artifact-1',
            kind: 'JSON',
            mime_type: 'application/json',
            byte_size: 64,
            content_hash: 'd'.repeat(64),
            lineage_hash: 'e'.repeat(64),
            status: 'STORED',
            download_url: '/api/artifacts/artifact-1/download',
          }],
          overall_status: 'PARTIAL',
        },
      }),
      'task-1',
    ),
    /contradictory/,
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
      'task-1',
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
      'task-1',
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
  const exactPack = reviewPack();
  const exactDelivery = {
    manifest_id: 'manifest-1',
    task_id: 'task-1',
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    delivery_formula_version: 'w06-v1',
    delivery_revision: 1,
    payload_hash: 'c'.repeat(64),
    artifacts: [{
      artifact_id: 'artifact-1',
      kind: 'JSON',
      mime_type: 'application/json',
      byte_size: 64,
      content_hash: 'd'.repeat(64),
      lineage_hash: 'e'.repeat(64),
      status: 'STORED',
      download_url: '/api/artifacts/artifact-1/download',
    }],
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
    {
      review_pack: {
        ...exactPack,
        court_review_id: 'review-other',
      },
    },
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
        review_pack: exactPack,
        ...override,
      }), 'task-1'),
      /lineage/,
    );
  }
});
