import { AGENT_META, type AgentCode, type AgentRun } from '@/types/agent';
import {
  COUNCIL_ACTIONS,
  COUNCIL_CONFLICTS,
  COUNCIL_DISCUSSIONS,
  COUNCIL_WAIT_CHAIN,
} from './council-fixtures';

export interface CouncilDiscussionItem {
  speaker: string;
  content: string;
  tone: string;
}

export interface CouncilConflictItem {
  title: string;
  body: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CouncilStatusItem {
  title: string;
  body: string;
  tone: 'danger' | 'gold' | 'success';
}

export interface CouncilEventItem {
  time: string;
  title: string;
  body: string;
  tone: 'danger' | 'gold' | 'success' | 'info';
  speaker: string;
  department: string;
  phase: 'waiting' | 'ready' | 'running';
}

/**
 * 军机处会审数据来源标:
 *  - LIVE_SWARM：有真实在审执行链(agentRuns)驱动，会审内容纯由真实 run 构建。
 *  - DEMO：当前无真实在审链，下列为示意夹具(council-fixtures)，禁当真会审给御前批示。
 * 铁律13.2 #2/#3：DEMO 禁伪装 LIVE，必须在面板明示。
 */
export type CouncilSourceLabel = 'LIVE_SWARM' | 'DEMO';

export interface CouncilSourceBundle {
  sourceLabel: CouncilSourceLabel;
  liveRunCount: number;
  discussions: CouncilDiscussionItem[];
  conflicts: CouncilConflictItem[];
  actions: string[];
  waitChain: string[];
  statusItems: CouncilStatusItem[];
  events: CouncilEventItem[];
}

const SPEAKER_LABEL: Partial<Record<AgentCode, string>> = {
  prime_minister: '丞相',
  bing_bu: '兵部',
  xing_bu: '刑部',
  hu_bu: '户部',
  gong_bu: '工部',
  jin_yi_wei: '锦衣卫',
  qin_tian_jian: '钦天监',
};

export function buildCouncilSource(agentRuns: AgentRun[]): CouncilSourceBundle {
  const activeRuns = agentRuns.filter((run) =>
    ['running', 'waiting_dependency', 'summarizing'].includes(run.state),
  );
  const waitingRuns = activeRuns.filter((run) => run.isWaitingDependency || run.state === 'waiting_dependency');
  const riskRuns = activeRuns.filter((run) => ['high', 'critical'].includes(run.riskLevel ?? 'low'));
  const readyRuns = activeRuns.filter((run) => run.state === 'summarizing' || run.hasReported);

  // DEMO 兜底:仅当无真实在审执行链时才用 fixtures 示意;一旦有真实 run,纯由真实 run 构建,
  // 绝不把演示夹具混进真会审给御前批示(铁律13.2 DEMO 禁伪装 LIVE)。
  const hasLive = activeRuns.length > 0;
  const sourceLabel: CouncilSourceLabel = hasLive ? 'LIVE_SWARM' : 'DEMO';

  const discussions: CouncilDiscussionItem[] = hasLive ? [] : [...COUNCIL_DISCUSSIONS];
  if (activeRuns.length > 0) {
    discussions.unshift({
      speaker: '丞相',
      tone: '#F0C66A',
      content: `当前共有 ${activeRuns.length} 条执行链在军机处汇总，其中 ${waitingRuns.length} 条仍待依赖，${riskRuns.length} 条带高压风险。`,
    });
  }

  for (const run of activeRuns.slice(0, 4)) {
    const speaker =
      SPEAKER_LABEL[run.agentCode] ?? AGENT_META[run.agentCode]?.nameCn ?? run.agentCode;
    discussions.push({
      speaker,
      tone: pickTone(run),
      content:
        run.latestSummary ??
        run.currentTaskTitle ??
        `${speaker} 正在继续推进当前链路，等待更明确的下一步批示。`,
    });
  }

  const conflicts: CouncilConflictItem[] = hasLive ? [] : [...COUNCIL_CONFLICTS];
  for (const run of riskRuns.slice(0, 3)) {
    const speaker = AGENT_META[run.agentCode]?.nameCn ?? run.agentCode;
    conflicts.push({
      title: `${speaker} 风险上浮`,
      body:
        run.latestSummary ??
        `${speaker} 当前风险等级为 ${run.riskLevel ?? 'high'}，需尽快由丞相收束边界与节奏。`,
      severity: run.riskLevel === 'critical' ? 'high' : 'medium',
    });
  }

  const waitChain = [
    ...(hasLive ? [] : COUNCIL_WAIT_CHAIN),
    ...waitingRuns.slice(0, 3).map((run) => {
      const speaker = AGENT_META[run.agentCode]?.nameCn ?? run.agentCode;
      return `等待 ${speaker} 补齐 ${run.currentTaskTitle ?? '当前依赖项'}。`;
    }),
  ];

  const actions = [
    ...(hasLive ? [] : COUNCIL_ACTIONS),
    ...(readyRuns.length > 0 ? ['已有呈报可供御前批示，建议先回丞相台定最终口径。'] : []),
  ];

  const statusItems: CouncilStatusItem[] = [
    {
      title: '会签争议',
      body: `${conflicts.filter((item) => item.severity === 'high').length} 项高压争议待丞相收束。`,
      tone: 'danger',
    },
    {
      title: '等待链',
      body: `仍有 ${waitingRuns.length || waitChain.length} 个依赖未完成。`,
      tone: 'gold',
    },
    {
      title: '可推进',
      body:
        readyRuns.length > 0
          ? `${readyRuns.length} 条链路已具备进入御前批示的条件。`
          : '局部试点可先行，不必等全部完成。',
      tone: 'success',
    },
  ];

  const events: CouncilEventItem[] = activeRuns.slice(0, 6).map((run, index) => {
    const speaker = AGENT_META[run.agentCode]?.nameCn ?? run.agentCode;
    const tone: CouncilEventItem['tone'] =
      run.riskLevel === 'critical' || run.riskLevel === 'high'
        ? 'danger'
        : run.isWaitingDependency || run.state === 'waiting_dependency'
          ? 'info'
          : run.hasReported || run.state === 'summarizing'
            ? 'success'
            : 'gold';

    return {
      time: `${String(9 + index).padStart(2, '0')}:${index % 2 === 0 ? '10' : '35'}`,
      title: `${speaker} · ${run.currentTaskTitle ?? '推进当前链路'}`,
      body:
        run.latestSummary ??
        `${speaker} 已将当前阶段状态送入军机处，等待丞相继续收束与转批。`,
      tone,
      speaker,
      department: speaker,
      phase:
        run.isWaitingDependency || run.state === 'waiting_dependency'
          ? 'waiting'
          : run.hasReported || run.state === 'summarizing'
            ? 'ready'
            : 'running',
    };
  });

  return {
    sourceLabel,
    liveRunCount: activeRuns.length,
    discussions,
    conflicts,
    actions,
    waitChain,
    statusItems,
    events,
  };
}

/* -------------------------------------------------------------------------- */
/* 真会审回灌:把主库里真实编排会审(orchestrate merge)转成军机处面板数据。          */
/* 数据来自 /api/court/grand-council/live(读 result.merge)，是真实发生过的会签/冲突。 */
/* -------------------------------------------------------------------------- */

export interface CouncilLiveContributor {
  dept: string;
  name: string;
  answer: string;
  confidence: number;
  grounded: boolean;
}
export interface CouncilLiveSessionInput {
  taskId: string;
  command: string;
  at: string;
  verdict: string;
  escalateToBoss: boolean;
  grounded: boolean;
  leadDept: string | null;
  contributors: CouncilLiveContributor[];
  conflicts: { depts: string[]; detail: string }[];
}

function hhmm(iso: string): string {
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : '—';
}

/** 有真实编排会审时用它构建军机处面板:纯真实数据，sourceLabel=LIVE_SWARM，不混任何 fixtures。 */
export function buildCouncilFromSessions(sessions: CouncilLiveSessionInput[]): CouncilSourceBundle {
  const discussions: CouncilDiscussionItem[] = [];
  const conflicts: CouncilConflictItem[] = [];
  const events: CouncilEventItem[] = [];
  const waitChain: string[] = [];
  const actions: string[] = [];

  for (const s of sessions) {
    discussions.push({
      speaker: '丞相',
      tone: s.escalateToBoss ? '#F43F5E' : '#F0C66A',
      content: s.escalateToBoss
        ? `「${s.command}」各部已接地但存在硬冲突，伏候圣裁：${s.verdict}`
        : `「${s.command}」合议结论：${s.verdict}`,
    });
    for (const c of s.contributors) {
      discussions.push({
        speaker: c.name || c.dept,
        tone: c.grounded ? '#3DD68C' : '#6BA0FF',
        content: c.answer,
      });
      events.push({
        time: hhmm(s.at),
        title: `${c.name || c.dept} · ${s.command.slice(0, 18)}`,
        body: c.answer.slice(0, 120),
        tone: c.grounded ? 'success' : 'gold',
        speaker: c.name || c.dept,
        department: c.name || c.dept,
        phase: 'ready',
      });
    }
    for (const cf of s.conflicts) {
      conflicts.push({
        title: cf.depts.join(' vs ') || '会签争议',
        body: cf.detail,
        severity: 'high',
      });
    }
    if (s.escalateToBoss) waitChain.push(`等待陛下裁夺「${s.command}」的会签冲突。`);
    else actions.push(`「${s.command}」已合议接地，可进入御前批示。`);
  }

  const statusItems: CouncilStatusItem[] = [
    { title: '会签争议', body: `${conflicts.length} 项高压争议待丞相收束。`, tone: 'danger' },
    { title: '等待链', body: `仍有 ${waitChain.length} 个依赖未完成。`, tone: 'gold' },
    {
      title: '可推进',
      body: actions.length > 0 ? `${actions.length} 条链路已具备进入御前批示的条件。` : '暂无可直接进入御批的链路。',
      tone: 'success',
    },
  ];

  return {
    sourceLabel: 'LIVE_SWARM',
    liveRunCount: sessions.length,
    discussions,
    conflicts,
    actions,
    waitChain,
    statusItems,
    events,
  };
}

function pickTone(run: AgentRun) {
  if (run.riskLevel === 'critical' || run.riskLevel === 'high') return '#F43F5E';
  if (run.isWaitingDependency || run.state === 'waiting_dependency') return '#6BA0FF';
  if (run.hasReported || run.state === 'summarizing') return '#3DD68C';
  return '#F0C66A';
}
