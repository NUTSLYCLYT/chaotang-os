import assert from 'node:assert/strict';
import test from 'node:test';

import type { JiqunSessionDetail } from '../../lib/jiqun-api.ts';
import {
  buildJiqunReturnRows,
  extractJiqunFinalOutputs,
  jiqunFinalOutputText,
  mergeJiqunReturnIntoEdict,
} from './jiqun-return-edict.ts';
import type { EdictView } from './edict-content.ts';

function blockedSession(): JiqunSessionDetail {
  return {
    session_id: '20260703_181847_f3dd54',
    task_input: 'Need a visible swarm return even when the quality gate blocks archival approval.',
    status: 'completed',
    release_gate: 'blocked',
    session_type: 'swarm',
    swarm_count: 1,
    completed_count: 1,
    start_time: '2026-07-03T18:18:47+08:00',
    end_time: '2026-07-03T18:30:00+08:00',
    swarm_runs: [
      {
        swarm_id: 'pack_rd',
        run_id: 'run_visible_return',
        status: 'completed',
        quality_score: 0.72,
        qa_result: { passed: false, blocking_reasons: ['missing source proof'] },
        triggered_by: 'shangshufang',
      },
    ],
    graph: {
      nodes: [
        {
          id: 'pack_rd:run_visible_return',
          swarm_id: 'pack_rd',
          run_id: 'run_visible_return',
          status: 'completed',
          quality_score: 0.72,
          triggered_by: 'shangshufang',
        },
      ],
      edges: [],
    },
    events: [
      {
        event_id: 'evt-final-output',
        topic: 'pack_rd.final_output',
        payload: {
          swarm_id: 'pack_rd',
          run_id: 'run_visible_return',
          quality_score: 0.72,
          final_output: {
            decision: 'Only supplement evidence or recheck; do not approve/archive.',
            next_action: 'Ask user for missing source proof and rerun quality gate.',
          },
        },
      },
    ],
  };
}

function runOnlyFinalOutputSession(): JiqunSessionDetail {
  const session = blockedSession();
  return {
    ...session,
    session_id: '20260703_190000_run_only',
    release_gate: 'clear',
    events: [],
    swarm_runs: [
      {
        swarm_id: 'hubu_budget',
        run_id: 'run_budget_visible',
        status: 'completed',
        quality_score: 0.91,
        qa_result: { passed: true, blocking_reasons: [] },
        final_output: {
          recommendation: 'Approve the R&D department budget in two gated phases.',
          next_action: 'Release phase one only after monthly burn-rate evidence is attached.',
        },
        triggered_by: 'shangshufang',
      },
    ],
  };
}

test('blocked real swarm rows include receipt plus final output', () => {
  const rows = buildJiqunReturnRows(blockedSession());
  const body = rows.map((row) => row.body).join('\n');

  assert.ok(rows.length >= 2);
  assert.equal(rows[0]?.label, '验 真');
  assert.equal(rows[1]?.label, '蜂群回奏');
  assert.match(body, /20260703_181847_f3dd54/);
  assert.match(body, /release_gate|blocked|质量|final_output|Only supplement evidence/i);
});

test('swarm run final_output is extracted even when events are empty', () => {
  const session = runOnlyFinalOutputSession();
  const outputs = extractJiqunFinalOutputs(session);
  const text = jiqunFinalOutputText(session);

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0]?.swarmId, 'hubu_budget');
  assert.equal(outputs[0]?.runId, 'run_budget_visible');
  assert.match(text ?? '', /Approve the R&D department budget/);
  assert.match(text ?? '', /monthly burn-rate evidence/);
});

test('swarm run final_output is merged into memorial advice row', () => {
  const baseView: EdictView = {
    id: 'draft-budget-edict',
    title: '奏折',
    subtitle: '研发部门预算',
    meta: { reporter: '军机处', priority: 'high' },
    rows: [
      { label: '所议', body: '研发部门预算是否批准。' },
      { label: '主判', body: '等待蜂群回奏。' },
      { label: '后令', body: '待定。' },
    ],
    seal: 'imperial',
  };

  const merged = mergeJiqunReturnIntoEdict(baseView, runOnlyFinalOutputSession());
  const adviceBody = merged.rows.find((row) => row.label === '主判')?.body ?? '';

  assert.match(adviceBody, /Approve the R&D department budget/);
  assert.match(adviceBody, /monthly burn-rate evidence/);
  assert.doesNotMatch(adviceBody, /等待蜂群回奏/);
});
