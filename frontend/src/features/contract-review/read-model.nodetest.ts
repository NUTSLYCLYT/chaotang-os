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

function mission(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema_version: 'MissionContractV1',
    mission_contract_id: 'task-1',
    task_id: 'task-1',
    revision: 1,
    jurisdiction: 'CN_MAINLAND',
    language: 'zh-CN',
    contract_type: 'procurement',
    our_role: 'buyer',
    legal_question: 'contract_risk_screening',
    goal: {
      user_intent: '完成采购合同审查',
      biggest_concern: '付款、验收与责任边界',
      risk_tolerance: '',
    },
    constraints: ['不改变商业价格'],
    prohibited_actions: ['不得伪造证据'],
    desired_outcome: {
      required_artifacts: ['PDF', 'DOCX', 'JSON'],
    },
    assumptions: ['合同文本完整'],
    budget_limit_minor: 0,
    deadline_at: '2026-08-01T00:00:00Z',
    read_scope: ['contract:source:v1'],
    plan_digest: 'a'.repeat(64),
    content_digest: 'b'.repeat(64),
    created_at: '2026-07-27T00:00:00+00:00',
    ...overrides,
  };
}

function finalMemorial(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    final_memorial_content_hash: 'c'.repeat(64),
    court_review_id: 'review-1',
    status: 'ready_for_decision',
    source_label: 'LIVE',
    ...overrides,
  };
}

function readyDelivery(): Record<string, unknown> {
  return {
    manifest_id: 'manifest-1',
    task_id: 'task-1',
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    delivery_formula_version: 'w06-v1',
    delivery_revision: 1,
    payload_hash: 'd'.repeat(64),
    artifacts: ['PDF', 'DOCX', 'JSON'].map((kind) => {
      const artifactId = `artifact-${kind.toLowerCase()}`;
      return {
        artifact_id: artifactId,
        kind,
        mime_type: kind === 'PDF'
          ? 'application/pdf'
          : kind === 'DOCX'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/json',
        byte_size: 64,
        content_hash: 'e'.repeat(64),
        lineage_hash: 'f'.repeat(64),
        status: 'STORED',
        download_url: `/api/artifacts/${artifactId}/download`,
      };
    }),
    overall_status: 'READY',
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
    {
      mission: {
        state: 'CONFIRMED',
        mission: {
          task_id: 'task-1',
          mission_contract_id: 'task-1',
        },
      },
    },
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
          mission: mission(),
        },
        review_pack: reviewPack(),
        final_memorial: finalMemorial(),
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

test('rejects DECIDE or REOPEN for an incomplete READY artifact packet', () => {
  const incompleteReady = {
    manifest_id: 'manifest-1',
    task_id: 'task-1',
    final_memorial_id: 'final-1',
    final_memorial_version: 1,
    delivery_formula_version: 'w06-v1',
    delivery_revision: 1,
    payload_hash: 'b'.repeat(64),
    artifacts: [{
      artifact_id: 'artifact-json',
      kind: 'JSON',
      mime_type: 'application/json',
      byte_size: 64,
      content_hash: 'd'.repeat(64),
      lineage_hash: 'e'.repeat(64),
      status: 'STORED',
      download_url: '/api/artifacts/artifact-json/download',
    }],
    overall_status: 'READY',
  };
  const common = {
    blockers: [],
    mission: {
      state: 'CONFIRMED',
      mission: mission(),
    },
    review_pack: reviewPack(),
    delivery: incompleteReady,
  };

  for (const override of [
    {
      ...common,
      allowed_actions: ['DECIDE'],
      final_memorial: {
        final_memorial_id: 'final-1',
        final_memorial_version: 1,
        final_memorial_content_hash: 'c'.repeat(64),
        court_review_id: 'review-1',
        status: 'ready_for_decision',
        source_label: 'LIVE',
      },
    },
    {
      ...common,
      allowed_actions: ['REOPEN_ARCHIVE'],
      final_memorial: {
        final_memorial_id: 'final-1',
        final_memorial_version: 1,
        final_memorial_content_hash: 'c'.repeat(64),
        court_review_id: 'review-1',
        status: 'archived',
        source_label: 'LIVE',
      },
      archive_receipt: {
        archive_id: 'archive-1',
        task_id: 'task-1',
        final_memorial_id: 'final-1',
        final_memorial_version: 1,
        final_memorial_content_hash: 'c'.repeat(64),
        archived_at: '2026-07-27T00:00:00Z',
        source_label: 'LIVE',
      },
    },
  ]) {
    assert.throws(
      () => parseContractTaskReadModel(readModel(override), 'task-1'),
      /contradictory/,
    );
  }
});

test('rejects mission identity that does not bind to the requested task', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({
        mission: {
          state: 'CONFIRMED',
          mission: mission({
            task_id: 'task-other',
          }),
        },
      }),
      'task-1',
    ),
    /lineage/,
  );
});

test('rejects DECIDE when mission and review pack business scope drift', () => {
  assert.throws(
    () => parseContractTaskReadModel(
      readModel({
        allowed_actions: ['DECIDE'],
        blockers: [],
        mission: {
          state: 'CONFIRMED',
          mission: mission(),
        },
        review_pack: reviewPack({
          contract_type: 'sales',
          our_role: 'seller',
        }),
        final_memorial: finalMemorial(),
        delivery: readyDelivery(),
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

test('rejects external or artifact-mismatched download URLs', () => {
  for (const downloadUrl of [
    'https://attacker.example/collect',
    '//attacker.example/collect',
    '/api/artifacts/artifact-other/download',
  ]) {
    const delivery = readyDelivery();
    const artifacts = delivery.artifacts as Record<string, unknown>[];
    artifacts[0] = {
      ...artifacts[0],
      download_url: downloadUrl,
    };

    assert.throws(
      () => parseContractTaskReadModel(
        readModel({
          final_memorial: finalMemorial(),
          delivery,
        }),
        'task-1',
      ),
      /invalid contract delivery/,
    );
  }
});

test('rejects DECIDE when a structured risk item is fallback-derived', () => {
  const fallbackRisk = {
    schema_version: 'ContractRiskItemV1',
    risk_item_id: 'risk-fallback',
    evidence_packet_id: 'evidence-1',
    risk_level: 'medium',
    explanation: '回退来源不得用于正式裁决',
    missing_evidence: ['原文锚点'],
    recommended_revision: '补齐原文后重新审查',
    source_label: 'FALLBACK',
    engine_tier: 'fallback',
  };

  assert.throws(
    () => parseContractTaskReadModel(readModel({
      allowed_actions: ['DECIDE'],
      blockers: [],
      mission: {
        state: 'CONFIRMED',
        mission: mission(),
      },
      review_pack: reviewPack({ risk_items: [fallbackRisk] }),
      final_memorial: finalMemorial(),
      delivery: readyDelivery(),
    }), 'task-1'),
    /contradictory/,
  );
});

test('rejects a non-adjudicable archive receipt source', () => {
  assert.throws(
    () => parseContractTaskReadModel(readModel({
      final_memorial: finalMemorial({ status: 'archived' }),
      archive_receipt: {
        archive_id: 'archive-1',
        task_id: 'task-1',
        final_memorial_id: 'final-1',
        final_memorial_version: 1,
        final_memorial_content_hash: 'c'.repeat(64),
        archived_at: '2026-07-27T00:00:00Z',
        source_label: 'FALLBACK',
      },
    }), 'task-1'),
    /invalid archive receipt/,
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
