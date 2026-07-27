import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeDecisionHome } from './useShangshufangBriefing';
import type { ShangshufangBriefing } from '../../../lib/contracts/shangshufang';
import type { ShangshufangHomeResponse } from '../../../lib/jiqun-api';

const EMPTY_BRIEFING: ShangshufangBriefing = {
  dailyStats: { taskTotal: 0, pendingCount: 0, runningCount: 0, completedToday: 0 },
  chancellorItems: [],
  memorials: [],
  fetchedAt: '2026-07-11T00:00:00Z',
  sourceMode: 'unavailable',
};

function makeHomeResponse(overrides: Partial<ShangshufangHomeResponse['pending_decisions'][number]>): ShangshufangHomeResponse {
  return {
    source_label: 'FALLBACK',
    today_issue: {
      title: 't', why_now: 'w', urgency: '中', recommended_action: 'r', evidence_basis: [], missing_evidence: [],
    },
    pending_decisions: [
      {
        task_id: 'task_1',
        status: 'awaiting_decision',
        raw_question: '这份合同能不能签？',
        draft_edict: {
          original_question: '这份合同能不能签？',
          refined_edict: '请军机处组织刑部参审，围绕原问形成可裁决奏折。',
          decision_type: '合同',
          known_facts: [],
          unknown_gaps: [],
          recommended_departments: ['刑部'],
          risk_flags: [],
          expected_memorial_format: [],
          emperor_confirmation_question: '',
          source_label: 'FALLBACK',
          route: {
            mode: 'cluster', decidedBy: 'chancellor', reason: '', reviewDepth: 'deep',
            targetAgent: null, targetDepartment: '军机处', departments: ['刑部'],
            swarmRequired: true, humanSignoffRequired: false, riskFlags: [], evidenceGaps: [],
          },
        },
        source_label: 'FALLBACK',
        contract_task: false,
        risk_flags: [],
        known_facts: [],
        unknown_gaps: [],
        recommended_departments: ['刑部'],
        created_at: '2026-07-11T00:00:00Z',
        updated_at: '2026-07-11T00:01:00Z',
        latest_memorial: null,
        ...overrides,
      },
    ],
    pending_evidence_tasks: [],
    archive_hints: [],
  } as unknown as ShangshufangHomeResponse;
}

test('mergeDecisionHome 建议栏在没有真实回奏时回退到 draft refined_edict', () => {
  const home = makeHomeResponse({});
  const merged = mergeDecisionHome(EMPTY_BRIEFING, home);
  const memorial = merged.memorials[0]!;
  assert.equal(memorial.enhancedSuggestion, '请军机处组织刑部参审，围绕原问形成可裁决奏折。');
});

test('mergeDecisionHome 真实回奏(latest_memorial)存在时优先展示真实内容,不是下旨前草稿', () => {
  const home = makeHomeResponse({
    latest_memorial: {
      verdict: '需人工复核',
      summary: '已按各部能力完成真实蜂群分奏，共 4 部参审。',
      source_label: 'FALLBACK',
      ministry_outputs: [
        { department: '刑部', opinion: '可签——但先改 7 处', source_label: 'LIVE' },
      ],
    },
  });
  const merged = mergeDecisionHome(EMPTY_BRIEFING, home);
  const memorial = merged.memorials[0]!;
  assert.ok(memorial.enhancedSuggestion.includes('已按各部能力完成真实蜂群分奏'));
  assert.ok(memorial.enhancedSuggestion.includes('刑部：可签——但先改 7 处'));
  assert.equal(memorial.verdict, '需人工复核');
  assert.doesNotMatch(memorial.enhancedSuggestion, /请军机处组织刑部参审，围绕原问形成可裁决奏折。/);
});

test('mergeDecisionHome preserves the server contract classification', () => {
  const home = makeHomeResponse({
    contract_task: true,
    contract_scope: null,
  });

  const merged = mergeDecisionHome(EMPTY_BRIEFING, home);

  assert.equal(merged.memorials[0]?.contractTask, true);
});

test('mergeDecisionHome does not create a second contract classifier', () => {
  const home = makeHomeResponse({
    contract_task: false,
    contract_scope: {
      schema_version: 'ContractIntakeV1',
      jurisdiction: 'CN_MAINLAND',
      language: 'zh-CN',
      contract_type: 'procurement',
      our_role: 'buyer',
      legal_question: 'contract_risk_screening',
    },
  });

  const merged = mergeDecisionHome(EMPTY_BRIEFING, home);

  assert.equal(merged.memorials[0]?.contractTask, false);
});
