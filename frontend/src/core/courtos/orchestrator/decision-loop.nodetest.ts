/**
 * DecisionLoop 单测 · 离线：
 *   node --experimental-strip-types --test src/core/courtos/orchestrator/decision-loop.nodetest.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  transition,
  nextState,
  assertValidTransition,
  getAvailableActions,
  getUserFacingStateText,
  shouldAllowUserDecision,
  shouldAllowArchive,
  shouldShowProgress,
  IllegalDecisionTransitionError,
} from './decision-loop.ts';

test('主闭环 happy path 一路走到归档', () => {
  let s = transition('draft', 'refine_intent');
  assert.equal(s, 'intent_refined');
  s = transition(s, 'check_evidence');
  assert.equal(s, 'evidence_checking');
  s = transition(s, 'start_review');
  assert.equal(s, 'reviewing');
  s = transition(s, 'generate_report');
  assert.equal(s, 'report_ready');
  s = transition(s, 'ask_decision');
  assert.equal(s, 'waiting_for_decision');
  s = transition(s, 'accept');
  assert.equal(s, 'accepted');
  s = transition(s, 'archive');
  assert.equal(s, 'archived');
});

test('缺证分支：evidence_checking 可补证或直接会审', () => {
  assert.equal(transition('evidence_checking', 'request_evidence'), 'waiting_for_evidence');
  assert.equal(transition('evidence_checking', 'start_review'), 'reviewing');
  assert.equal(transition('waiting_for_evidence', 'start_review'), 'reviewing');
});

test('裁决四路', () => {
  assert.equal(transition('waiting_for_decision', 'reject'), 'rejected');
  assert.equal(transition('waiting_for_decision', 'follow_up'), 'following_up');
  assert.equal(transition('waiting_for_decision', 'request_recheck'), 'rechecking');
  assert.equal(transition('following_up', 'start_review'), 'reviewing');
  assert.equal(transition('rechecking', 'start_review'), 'reviewing');
});

test('非法迁移抛错', () => {
  assert.throws(() => transition('draft', 'accept'), IllegalDecisionTransitionError);
  assert.throws(() => assertValidTransition('archived', 'archive'));
  assert.equal(nextState('archived', 'archive'), undefined);
});

test('异常随时可 fail（终态除外）', () => {
  assert.equal(transition('reviewing', 'fail'), 'failed');
  assert.equal(transition('draft', 'fail'), 'failed');
  assert.equal(nextState('archived', 'fail'), undefined);
  assert.equal(transition('failed', 'refine_intent'), 'intent_refined'); // 失败可恢复
});

test('每个状态都有中文显示', () => {
  for (const s of [
    'draft', 'intent_refined', 'evidence_checking', 'waiting_for_evidence',
    'reviewing', 'report_ready', 'waiting_for_decision', 'accepted',
    'rejected', 'following_up', 'rechecking', 'archived', 'failed',
  ] as const) {
    assert.ok(getUserFacingStateText(s).length > 0);
  }
});

test('裁决/归档/进度判定', () => {
  assert.equal(shouldAllowUserDecision('waiting_for_decision'), true);
  assert.equal(shouldAllowUserDecision('reviewing'), false);
  assert.equal(shouldAllowArchive('accepted'), true);
  assert.equal(shouldAllowArchive('rejected'), false);
  assert.equal(shouldAllowArchive('reviewing'), false);
  assert.equal(shouldShowProgress('reviewing'), true);
  assert.equal(shouldShowProgress('draft'), false);
  assert.ok(getAvailableActions('waiting_for_decision').includes('accept'));
  assert.equal(nextState('rejected', 'archive'), undefined);
});
