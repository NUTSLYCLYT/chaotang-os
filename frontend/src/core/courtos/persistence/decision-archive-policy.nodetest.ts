import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDecisionArchiveAllowed,
  mapDecisionActionToUnifiedUserAction,
  retrospectiveStatusForDecision,
  statusAfterArchive,
  statusFromDecisionAction,
} from './decision-archive-policy.ts';

test('裁决动作映射到史馆/EvoMap 用户动作', () => {
  assert.equal(mapDecisionActionToUnifiedUserAction('adopt'), 'accept');
  assert.equal(mapDecisionActionToUnifiedUserAction('reject'), 'reject');
  assert.equal(mapDecisionActionToUnifiedUserAction('request_evidence'), 'request_evidence');
  assert.equal(mapDecisionActionToUnifiedUserAction('recheck'), 'request_recheck');
  assert.equal(mapDecisionActionToUnifiedUserAction('followup'), 'follow_up');
});

test('准奏遇到人工确认要求时不能静默归档', () => {
  assert.throws(
    () =>
      assertDecisionArchiveAllowed({
        action: 'adopt',
        humanConfirmed: false,
        humanConfirmationRequired: true,
        qualityPassed: true,
        sourceLabel: 'MIXED',
      }),
    /human_confirmation_required/,
  );
});

test('准奏遇到质门阻断或弱来源时必须人工确认', () => {
  assert.throws(
    () =>
      assertDecisionArchiveAllowed({
        action: 'adopt',
        humanConfirmed: false,
        humanConfirmationRequired: false,
        qualityPassed: false,
        sourceLabel: 'MIXED',
      }),
    /quality_gate_confirmation_required/,
  );
  assert.throws(
    () =>
      assertDecisionArchiveAllowed({
        action: 'adopt',
        humanConfirmed: false,
        humanConfirmationRequired: false,
        qualityPassed: true,
        sourceLabel: 'DEMO',
      }),
    /weak_source_confirmation_required/,
  );
});

test('补证、复核、追问允许进入预归档但不标记终局归档', () => {
  assert.doesNotThrow(() =>
    assertDecisionArchiveAllowed({
      action: 'request_evidence',
      humanConfirmed: false,
      humanConfirmationRequired: true,
      qualityPassed: false,
      sourceLabel: 'FALLBACK',
    }),
  );
  assert.equal(statusAfterArchive('request_evidence'), 'awaiting_evidence');
  assert.equal(statusAfterArchive('recheck'), 'rechecking');
  assert.equal(statusAfterArchive('followup'), 'followuping');
  assert.equal(retrospectiveStatusForDecision('request_evidence'), 'awaiting_evidence');
});

test('批示归档进入 archived，驳回保持 rejected 不入史馆终局', () => {
  assert.equal(statusFromDecisionAction('adopt'), 'adopted');
  assert.equal(statusFromDecisionAction('reject'), 'rejected');
  assert.equal(statusAfterArchive('adopt'), 'archived');
  assert.equal(statusAfterArchive('reject'), 'rejected');
  assert.equal(retrospectiveStatusForDecision('adopt'), 'not_started');
  assert.equal(retrospectiveStatusForDecision('reject'), 'rejected');
});
