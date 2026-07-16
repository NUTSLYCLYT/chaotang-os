/**
 * 回归断言(铁律4)—— 飞轮点火"正确版"。钉死上一版被会审判 BLOCK 的 3 个 CRITICAL:
 *   ① 诚实是整个信封的不变量:memorial 顶层 source_label == 所有 nested source_label(禁半覆盖)。
 *   ② live=false(哑火/降级)⇒ 不点亮、不写归档(源标一致、别写假案)。
 *   ③ confirm 步不 saveCourtArchive(幂等,归档留给 decision(adopt)步,避免双写污染召回池)。
 *
 * 只 import 纯构建层(live-memorial-build.ts,无 server-only),不触真 LLM/DB。
 * ③ 用源文件静态扫描断言桥接层不引用 saveCourtArchive。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  buildLiveMemorial,
  computeLiveFlag,
  isRecallableSource,
  reconcileLiveDecision,
  collectSourceLabels,
  stampSourceLabelDeep,
  MINISTRY_TO_DEPT_CODE,
} from './live-memorial-build.ts';
import type { MinistryReviewResult, RedBlueCard } from '../ministries/ministry-types.ts';
import type { ImperialReport } from '../ministries/imperial-report-synthesizer.ts';
import type { ShangshufangReviewMemorial } from '../../../lib/jiqun-api.ts';

function makeCard(over: Partial<RedBlueCard>): RedBlueCard {
  return {
    ministryId: 'finance',
    taskId: 't1',
    mainThesis: 'main',
    mainPlan: 'plan',
    deputyChallenge: 'challenge',
    deputyRisks: ['风险A'],
    disputeFocus: '焦点',
    synthesis: '综合意见',
    ruling: '裁断',
    signal: 'YELLOW',
    verdict: 'NEED_EVIDENCE',
    conditionsToProceed: ['先补证'],
    missingEvidence: ['缺成本'],
    needsHumanConfirmation: false,
    riskLevel: 'medium',
    sourceLabel: 'FALLBACK', // 卡内部源标故意与 reviewSource 不同,验证会被重建/戳平
    confidence: 0.6,
    ...over,
  };
}

function makeReview(): MinistryReviewResult {
  return {
    taskId: 't1',
    selectedMinistries: ['finance', 'justice', 'works'],
    selectionReasons: {},
    cards: [
      makeCard({ ministryId: 'finance', signal: 'GREEN', verdict: 'APPROVE' }),
      makeCard({ ministryId: 'justice', signal: 'RED', verdict: 'RECHECK' }),
      makeCard({ ministryId: 'works', signal: 'YELLOW', verdict: 'NEED_EVIDENCE' }),
    ],
    vetoes: ['justice'],
    conflicts: [{ between: ['finance', 'justice'], summary: '户部推进但刑部亮红' }],
    missingEvidence: ['缺成本', '缺合规意见'],
    humanApprovalRequired: true,
    overallSignal: 'RED',
    overallSuggestion: '先消解刑部红灯',
    sourceLabel: 'FALLBACK',
  };
}

function makeReport(): ImperialReport {
  return {
    verdict: 'RECHECK',
    oneSentence: '复核：先消解刑部红灯',
    ministrySignals: { finance: 'GREEN', justice: 'RED', works: 'YELLOW' },
    departmentSummaries: [],
    redBlueHighlights: [],
    conflicts: [{ between: ['finance', 'justice'], summary: '户部推进但刑部亮红' }],
    evidence: [],
    missingEvidence: ['缺成本', '缺合规意见'],
    risks: ['对外承诺风险'],
    nextAction: '先消解刑部红灯（人工确认或补救）',
    qualityGate: { needsHumanConfirmation: true, warnings: ['warn1'] },
    sourceLabel: 'FALLBACK',
    needsHumanConfirmation: true,
    yushitaiWarnings: ['御史台警示1'],
    decisionActions: ['accept', 'need_evidence', 'recheck', 'reject', 'follow_up'],
  };
}

/** base 故意带混杂源标(FALLBACK/DEMO),验证点亮后被全量戳成 reviewSource。 */
function makeBase(): ShangshufangReviewMemorial {
  return {
    schema_version: 'MemorialV1',
    task_id: 't1',
    sacred_judgement: '补证',
    executive_summary: 'base summary',
    department_memorials: [
      {
        schema_version: 'DepartmentOpinionV1',
        task_id: 't1',
        department_id: 'hu_bu',
        signal: 'GRAY',
        verdict: 'NEED_EVIDENCE',
        summary: 'base dept',
        evidence: [
          { schema_version: 'EvidenceItemV1', id: 'e1', label: '原问', summary: 's', reliability: 'medium', source_label: 'DEMO' },
        ],
        missing_evidence: [],
        risks: [],
        next_order: '',
        human_confirmation_required: false,
        source_label: 'DEMO',
      },
    ],
    evidence_chain: [
      { schema_version: 'EvidenceItemV1', id: 'e1', label: '原问', summary: 's', reliability: 'medium', source_label: 'DEMO' },
    ],
    missing_evidence: [],
    risk_register: [],
    conflict_summary: [{ type: 'x', summary: 'y', departments: [], source_label: 'DEMO' }],
    quality_gate: {
      schema_version: 'QualityGateResultV1',
      status: 'blocked',
      reasons: [],
      human_signoff_required: false,
      source_label: 'DEMO',
    },
    title: 'title',
    verdict: '补证',
    summary: 'base',
    draft_edict: {
      original_question: 'q',
      refined_edict: 'r',
      decision_type: 'consult',
      known_facts: [],
      unknown_gaps: [],
      suggested_perspectives: [],
      recommended_departments: [],
      risk_flags: [],
      expected_output: [],
      expected_memorial_format: [],
      emperor_confirmation_question: '',
      source_label: 'FALLBACK',
    },
    ministry_outputs: [
      { department: 'hu_bu', focus: 'f', opinion: 'o', status: 'completed', source_label: 'FALLBACK' },
    ],
    evidence_gaps: [],
    risk_flags: [],
    decision_options: [],
    next_best_action: 'recheck',
    source_label: 'FALLBACK',
  };
}

test('① 诚实不变量:点亮后 memorial 全部 source_label === reviewSource(禁半覆盖)', () => {
  const memorial = buildLiveMemorial(makeBase(), {
    reviewSource: 'LIVE',
    refinedIntent: '精炼意图',
    ministryReview: makeReview(),
    imperialReport: makeReport(),
    needsHumanConfirmation: true,
  });
  const labels = collectSourceLabels(memorial);
  assert.ok(labels.length >= 6, `应收集到多处 source_label,实际 ${labels.length}`);
  assert.equal(memorial.source_label, 'LIVE');
  for (const label of labels) {
    assert.equal(label, 'LIVE', `发现异源标 ${label}(半覆盖=假当真,违不变量)`);
  }
});

test('① 内容全量重建自真会审卡(非 base 残留):部门码映射 + 灯号/裁断一致', () => {
  const memorial = buildLiveMemorial(makeBase(), {
    reviewSource: 'LIVE',
    refinedIntent: '精炼意图',
    ministryReview: makeReview(),
    imperialReport: makeReport(),
    needsHumanConfirmation: true,
  });
  type DeptMemorial = NonNullable<ShangshufangReviewMemorial['department_memorials']>[number];
  const depts: DeptMemorial[] = memorial.department_memorials ?? [];
  assert.equal(depts.length, 3, '应从 3 张会审卡重建');
  assert.deepEqual(
    depts.map((d: DeptMemorial) => d.department_id),
    ['hu_bu', 'xing_bu', 'gong_bu'],
    'finance→hu_bu / justice→xing_bu / works→gong_bu',
  );
  const justice = depts.find((d: DeptMemorial) => d.department_id === 'xing_bu');
  assert.equal(justice?.signal, 'RED');
  assert.equal(justice?.verdict, 'RECHECK');
  // 圣裁中文化 + UI 契约 verdict 中文
  assert.equal(memorial.sacred_judgement, '复核');
  assert.equal(memorial.verdict, '复核');
  // 质门从真数据重算(有御史台警示 → blocked)
  assert.equal(memorial.quality_gate.status, 'blocked');
  assert.deepEqual(memorial.missing_evidence, ['缺成本', '缺合规意见']);
});

test('② computeLiveFlag:仅整链真(LIVE/LIVE_SWARM)点亮,MIXED/FALLBACK/DEMO 一律 false', () => {
  assert.equal(computeLiveFlag('LIVE'), true);
  assert.equal(computeLiveFlag('LIVE_SWARM'), true);
  assert.equal(computeLiveFlag('MIXED'), false, 'MIXED=半真,不当全真');
  assert.equal(computeLiveFlag('FALLBACK'), false);
  assert.equal(computeLiveFlag('DEMO'), false);
});

test('② isRecallableSource:LIVE/LIVE_SWARM/MIXED 可沉淀,FALLBACK/DEMO 不可(解"门太严"死结)', () => {
  assert.equal(isRecallableSource('LIVE'), true);
  assert.equal(isRecallableSource('LIVE_SWARM'), true);
  assert.equal(isRecallableSource('MIXED'), true, 'MIXED 诚实标 MIXED 后可召回,不再空转');
  assert.equal(isRecallableSource('FALLBACK'), false);
  assert.equal(isRecallableSource('DEMO'), false);
});

test('① 不变量对 MIXED 同样成立:MIXED 重建后全部 source_label === MIXED(不冒充 LIVE)', () => {
  const memorial = buildLiveMemorial(makeBase(), {
    reviewSource: 'MIXED',
    refinedIntent: '精炼意图',
    ministryReview: makeReview(),
    imperialReport: makeReport(),
    needsHumanConfirmation: true,
  });
  const labels = collectSourceLabels(memorial);
  assert.ok(labels.length >= 6);
  assert.equal(memorial.source_label, 'MIXED');
  for (const label of labels) assert.equal(label, 'MIXED', `MIXED 奏折出现异源标 ${label}`);
});

test('② 再门控:会审阶段降级(某部超时/非真部)⇒ 不点亮(防"给启发式盖真章")', () => {
  // 拟旨 + 奏折全真,但会审聚合源标降级 —— 这正是上一版漏掉、被会审判 CRITICAL 的场景。
  assert.deepEqual(reconcileLiveDecision('LIVE', 'LIVE', 'LIVE'), { finalSource: 'LIVE', live: true });
  assert.deepEqual(
    reconcileLiveDecision('LIVE', 'LIVE', 'MIXED'),
    { finalSource: 'MIXED', live: false },
    '某部真 agent 超时回退 heuristic → ministry MIXED → 整体不点亮',
  );
  assert.equal(
    reconcileLiveDecision('LIVE', 'LIVE', 'FALLBACK').live,
    false,
    'selector 选中非真部(恒 FALLBACK)→ 整体不点亮',
  );
  // 拟旨降级也不点亮(外层门)。
  assert.equal(reconcileLiveDecision('FALLBACK', 'LIVE', 'LIVE').live, false);
  // 缺失全部 → 诚实 FALLBACK,不点亮。
  assert.equal(reconcileLiveDecision(undefined, undefined, undefined).live, false);
});

test('② stampSourceLabelDeep 不改入参(不可变),且戳平嵌套数组/对象', () => {
  const input = { source_label: 'FALLBACK', nested: [{ source_label: 'DEMO' }] };
  const out = stampSourceLabelDeep(input, 'LIVE');
  assert.equal(input.source_label, 'FALLBACK', '入参不可变');
  assert.equal(input.nested[0].source_label, 'DEMO', '入参不可变');
  assert.deepEqual(collectSourceLabels(out), ['LIVE', 'LIVE']);
});

test('③ confirm 步不 saveCourtArchive:桥接层静态零引用(幂等,归档留给 decision 步)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const bridgeSrc = readFileSync(join(here, '../../../../dev/_attic/frontend-second-brain-2026-07-16/live-memorial-bridge.ts'), 'utf8');
  assert.ok(
    !/saveCourtArchive/.test(bridgeSrc),
    '桥接层禁引用 saveCourtArchive —— confirm 步只召回不归档,否则与 decision 步双写污染召回池',
  );
  // 但必须召回(飞轮复利)。
  assert.ok(/findSimilarCourtArchives/.test(bridgeSrc), '桥接层应召回同类旧案(飞轮复利)');
});

test('④ 决策飞轮读回路(2026-07-03 修)：召回的 priorCases 必须真正传进 createDraftTask，不能只召回不用', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const bridgeSrc = readFileSync(join(here, '../../../../dev/_attic/frontend-second-brain-2026-07-16/live-memorial-bridge.ts'), 'utf8');
  assert.ok(
    /priorCases\.map\(summarizePriorCase\)/.test(bridgeSrc),
    '召回结果必须转成摘要',
  );
  assert.ok(
    /createDraftTask\(taskId, question, priorCaseNotes\)/.test(bridgeSrc),
    'priorCaseNotes 必须真正传进 createDraftTask，否则召回了却不喂给 LLM(白召回，此前的 bug)',
  );
});

test('MINISTRY_TO_DEPT_CODE 六部映射齐全(铁律2 单一映射)', () => {
  assert.deepEqual(MINISTRY_TO_DEPT_CODE, {
    personnel: 'li_bu',
    finance: 'hu_bu',
    ritual: 'li_bu_rites',
    war: 'bing_bu',
    justice: 'xing_bu',
    works: 'gong_bu',
  });
});
