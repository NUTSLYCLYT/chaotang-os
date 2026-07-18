import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ShangshufangReviewMemorial,
  ShangshufangTaskStatusResponse,
} from '@/lib/jiqun-api';
import { projectCanonicalCourtStatus } from './canonical-read-model';

function memorial(
  marker: string,
  overrides: Partial<ShangshufangReviewMemorial> = {},
): ShangshufangReviewMemorial {
  return {
    title: `${marker} title`,
    verdict: `${marker} verdict`,
    summary: `${marker} summary`,
    ministry_outputs: [
      {
        department: 'finance',
        focus: `${marker} focus`,
        opinion: `${marker} opinion`,
        status: 'completed',
        source_label: 'LIVE',
      },
    ],
    conflict_summary: [
      {
        type: 'explicit',
        summary: `${marker} conflict`,
        departments: ['finance', 'works'],
        source_label: 'LIVE',
      },
    ],
    evidence_gaps: [`${marker} gap`],
    risk_flags: [`${marker} risk`],
    decision_options: [
      {
        action: 'request_evidence',
        label: `${marker} option`,
        reason: `${marker} reason`,
        enabled: true,
      },
    ],
    next_best_action: `${marker} next`,
    source_label: 'LIVE',
    quality_gate: {
      passed: false,
      status: 'blocked',
      reasons: [`${marker} gate reason`],
      blocking_issues: [`${marker} blocker`],
      warnings: [`${marker} warning`],
      human_signoff_required: true,
    },
    swarm_run_id: `${marker}-run`,
    ...overrides,
  };
}

function status(input: {
  reviewMemorial?: ShangshufangReviewMemorial | null;
  formalMemorial?: ShangshufangReviewMemorial | null;
  formalSource?: 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'FALLBACK' | 'DEMO';
}): ShangshufangTaskStatusResponse {
  const reviewMemorial = input.reviewMemorial === undefined ? memorial('review') : input.reviewMemorial;
  const formalMemorial = input.formalMemorial ?? null;
  return {
    task: {
      task_id: 'task-1',
      status: formalMemorial ? 'awaiting_decision' : 'awaiting_evidence',
      raw_question: 'question',
      draft_edict: null,
      source_label: 'LIVE',
      risk_flags: ['task risk'],
      known_facts: ['known'],
      unknown_gaps: ['task gap'],
      recommended_departments: ['finance'],
      created_at: '2026-07-16T00:00:00Z',
      updated_at: '2026-07-16T00:01:00Z',
    },
    review: reviewMemorial
      ? {
          review_id: 'review-1',
          review_status: 'completed',
          routing_plan: {
            ministry_candidates: ['finance'],
            selected_departments: ['finance'],
            swarm_plan: [],
            route_reason: 'backend route',
            source_label: 'LIVE',
          },
          ministry_outputs: reviewMemorial.ministry_outputs,
          conflict_summary: reviewMemorial.conflict_summary,
          memorial: reviewMemorial,
          created_at: '2026-07-16T00:00:00Z',
          updated_at: '2026-07-16T00:01:00Z',
        }
      : null,
    formal_memorial: formalMemorial
      ? {
          id: 'formal-1',
          task_id: 'task-1',
          review_id: 'review-1',
          swarm_run_id: 'formal-run',
          quality_result_id: 'quality-1',
          status: 'ready_for_decision',
          source_label: input.formalSource ?? 'LIVE_SWARM',
          memorial: formalMemorial,
          content_hash: 'hash',
          created_at: '2026-07-16T00:02:00Z',
        }
      : null,
    execution_status: null,
  };
}

test('formal memorial wins over a stale candidate and preserves the formal outer source', () => {
  const result = projectCanonicalCourtStatus(
    status({
      reviewMemorial: memorial('review'),
      formalMemorial: memorial('formal', { source_label: 'MIXED' }),
      formalSource: 'LIVE_SWARM',
    }),
  );

  assert.equal(result?.kind, 'formal');
  assert.equal(result?.report.verdict, 'formal verdict');
  assert.equal(result?.report.summary, 'formal summary');
  assert.equal(result?.report.nextAction, 'formal next');
  assert.deepEqual(result?.report.missingEvidence, ['formal gap']);
  assert.deepEqual(result?.report.risks, ['formal risk']);
  assert.equal(result?.sourceLabel, 'LIVE_SWARM');
  assert.equal(JSON.stringify(result).includes('review verdict'), false);
});

test('candidate memorial is projected without inventing a formal decision', () => {
  const result = projectCanonicalCourtStatus(status({ formalMemorial: null }));

  assert.equal(result?.kind, 'candidate');
  assert.equal(result?.report.verdict, 'review verdict');
  assert.equal(result?.gate.status, 'blocked');
  assert.equal(result?.gate.passed, false);
  assert.deepEqual(result?.gate.blockingIssues, ['review blocker']);
  assert.deepEqual(result?.selectedDepartments, ['finance']);
});

test('menxia veto memorial resolves overallSignal/audit.passed to blocked, not unknown', () => {
  // 2026-07-18 审计发现两轮:① 后端漏填 quality_gate.passed(布尔)，只填了
  // status(字符串)，这个函数只认 passed，导致 overallSignal 判成 'GRAY'。
  // ② 第一次补的回归测试用 memorial()+overrides 手写了 conflict_summary，
  // 顺手补了 departments:[] 字段——但真实后端代码当时压根没填这个必填字段，
  // 测试通过纯属巧合地掩盖了这个缺口(真实数据会在 unique(item.departments)
  // .map(...) 直接崩,.map on undefined)。
  //
  // 这次不再手写近似 fixture——下面这个对象是从真实 confirm-edict 接口
  // 现场跑出来、原样贴过来的(2026-07-18,`我要去美国看世界杯决赛` 触发
  // 封驳)，跟后端实际吐出的 JSON 逐字节一致，不会再因为"测试比代码写得早"
  // 而漏掉字段。
  const vetoed: ShangshufangReviewMemorial = {
    title: '门下省封驳纪要',
    verdict: '已封驳',
    summary: '门下省封驳：不属于任何部门真实职责范围，不能顶着部门人设执行。未获准奏前不得进入军机处派单。',
    ministry_outputs: [],
    conflict_summary: [
      {
        type: 'human_signoff',
        summary: '门下省封驳：不属于任何部门真实职责范围，不能顶着部门人设执行。未获准奏前不得进入军机处派单。',
        departments: [],
        source_label: 'FALLBACK',
      },
    ],
    evidence_gaps: [],
    risk_flags: ['门下省封驳'],
    risk_register: [],
    decision_options: [],
    next_best_action: 'await_human_signoff',
    source_label: 'FALLBACK',
    quality_gate: {
      passed: false,
      status: 'blocked',
      reasons: ['门下省封驳'],
      blocking_issues: ['门下省封驳'],
      human_signoff_required: true,
    },
  };
  const result = projectCanonicalCourtStatus(status({ reviewMemorial: vetoed, formalMemorial: null }));

  assert.equal(result?.gate.passed, false);
  assert.equal(result?.audit.passed, false);
  assert.equal(result?.review.overallSignal, 'RED');
  assert.deepEqual(result?.audit.blockingIssues, ['门下省封驳']);
});

test('missing canonical fields remain unknown instead of becoming a local pass or no-risk claim', () => {
  const sparse = memorial('sparse', {
    verdict: '',
    summary: '',
    ministry_outputs: [],
    conflict_summary: [],
    evidence_gaps: [],
    risk_flags: [],
    decision_options: [],
    next_best_action: '',
    quality_gate: {
      status: '',
      reasons: [],
      human_signoff_required: false,
    },
  });
  const result = projectCanonicalCourtStatus(status({ reviewMemorial: sparse, formalMemorial: null }));

  assert.equal(result?.report.verdict, undefined);
  assert.equal(result?.report.nextAction, undefined);
  assert.deepEqual(result?.report.risks, []);
  assert.equal(result?.gate.status, 'unknown');
  assert.equal(result?.gate.passed, undefined);
  assert.deepEqual(result?.trace, []);
});

test('no canonical review or formal memorial yields no court conclusion', () => {
  assert.equal(
    projectCanonicalCourtStatus(status({ reviewMemorial: null, formalMemorial: null })),
    null,
  );
});

test('rollout off degrades to no court conclusion instead of reviving a local decision engine', () => {
  assert.equal(
    projectCanonicalCourtStatus(status({ formalMemorial: memorial('formal') }), { enabled: false }),
    null,
  );
});
