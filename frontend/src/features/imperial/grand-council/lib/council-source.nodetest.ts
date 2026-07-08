import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCouncilSource,
  buildCouncilFromSessions,
  type CouncilLiveSessionInput,
} from './council-source.ts';
import { COUNCIL_DISCUSSIONS } from './council-fixtures.ts';
import type { AgentRun } from '../../../../types/agent.ts';

/**
 * 铁律13.2 #2/#3 回归(2026-06-24 五版面会审沉淀):军机处是主闭环第4站「会审」,
 * 其结论直接进御前批示。绝不能把演示夹具(council-fixtures)当真会审给用户裁决。
 * 本断言钉死:
 *   - 无真实在审执行链 → sourceLabel='DEMO',内容才用 fixtures 示意;
 *   - 一旦有真实 run → sourceLabel='LIVE_SWARM',内容纯由真实 run 构建,绝不混入 fixtures 台词。
 */

const FIXTURE_FIRST_LINE = COUNCIL_DISCUSSIONS[0].content;

function makeRun(over: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 'run_1',
    taskId: 'task_1',
    subtaskId: 'sub_1',
    agentCode: 'hu_bu',
    state: 'running',
    progressPct: 40,
    isWaitingDependency: false,
    hasReported: false,
    currentTaskTitle: '核算江南赈灾现金流',
    latestSummary: '户部已接地：现金流可支撑局部推进。',
    ...over,
  };
}

test('军机处: 无真实在审链 → DEMO,用 fixtures 示意', () => {
  const c = buildCouncilSource([]);
  assert.equal(c.sourceLabel, 'DEMO', '空 agentRuns 必须标 DEMO');
  assert.equal(c.liveRunCount, 0);
  assert.ok(c.discussions.length > 0, 'DEMO 下用 fixtures 示意,非空');
  assert.equal(
    c.discussions[0].content,
    FIXTURE_FIRST_LINE,
    'DEMO 下议事流首条应为 fixtures 示意台词',
  );
  assert.equal(c.events.length, 0, '无真实 run 时事件流为空,不伪造');
});

test('军机处: 有真实在审链 → LIVE_SWARM,纯真实构建,不混 fixtures', () => {
  const c = buildCouncilSource([makeRun()]);
  assert.equal(c.sourceLabel, 'LIVE_SWARM', '有真实 run 必须标 LIVE_SWARM');
  assert.equal(c.liveRunCount, 1);
  assert.ok(
    !c.discussions.some((d) => d.content === FIXTURE_FIRST_LINE),
    'LIVE 下绝不能出现 fixtures 演示台词(否则演示伪装成真会审)',
  );
  assert.ok(
    c.discussions.some((d) => d.content.includes('户部') || d.speaker === '户部' || d.content.includes('现金流')),
    'LIVE 下议事流应由真实 run 派生',
  );
  assert.equal(c.events.length, 1, 'LIVE 下事件流来自真实 run');
});

test('军机处: 真编排会审回灌 → LIVE_SWARM,渲染真实会签/冲突,不混 fixtures', () => {
  const session: CouncilLiveSessionInput = {
    taskId: 'task_abc',
    command: '盘点本周最该推进的三个六部项目',
    at: '2026-06-24T01:30:00.000Z',
    verdict: '优先批建设户部经营预算中台 v1（ROI 3.2x）。',
    escalateToBoss: false,
    grounded: true,
    leadDept: 'finance',
    contributors: [
      { dept: 'finance', name: '户部', answer: '现金流可支撑局部推进，ROI 3.2x。', confidence: 0.8, grounded: true },
    ],
    conflicts: [],
  };
  const c = buildCouncilFromSessions([session]);
  assert.equal(c.sourceLabel, 'LIVE_SWARM', '真会审必须标 LIVE_SWARM');
  assert.equal(c.liveRunCount, 1);
  assert.ok(
    c.discussions.some((d) => d.content.includes('现金流可支撑') || d.speaker === '户部'),
    '议事流应含真实部门会签内容',
  );
  assert.ok(
    !c.discussions.some((d) => d.content === COUNCIL_DISCUSSIONS[0].content),
    '真会审绝不能混入 fixtures 演示台词',
  );
  assert.equal(c.events.length, 1, '事件流来自真实 contributor');
});

test('军机处: 真会审硬冲突 → 进等待链伏候圣裁', () => {
  const session: CouncilLiveSessionInput = {
    taskId: 'task_x',
    command: '是否先批局部执行',
    at: '2026-06-24T02:00:00.000Z',
    verdict: '兵部主张抢窗口，刑部要求先补边界。',
    escalateToBoss: true,
    grounded: true,
    leadDept: null,
    contributors: [
      { dept: 'ops', name: '兵部', answer: '抢窗口。', confidence: 0.7, grounded: true },
      { dept: 'legal', name: '刑部', answer: '先补合规边界。', confidence: 0.7, grounded: true },
    ],
    conflicts: [{ depts: ['兵部', '刑部'], detail: '一方抢窗口一方要补边界。' }],
  };
  const c = buildCouncilFromSessions([session]);
  assert.equal(c.conflicts.length, 1, '真冲突应进会签争议');
  assert.ok(c.waitChain.some((w) => w.includes('伏候圣裁') || w.includes('裁夺')), '硬冲突进等待链伏候圣裁');
});
