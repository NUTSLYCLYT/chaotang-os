'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  Archive,
  ChevronRight,
  FileText,
  Gavel,
  GitBranch,
  MessageSquareText,
  Network,
  Radar,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { AGENT_META, getNodeDisplayName, type AgentRun } from '@/types/agent';
import type { Task } from '@/types/task';
import { GlassPanel } from '@/components/ui/glass-panel';
import { assetUrl } from '@/lib/asset';
import { DeptPageShell } from '@/features/shared/components/dept-page-shell';
import {
  type CommandCenterStage,
  FirstActionStrip,
  SoftErrorBanner,
  StagePriorityCard,
  deriveCenterTopline,
  deriveCommandCenterStage,
  deriveRouteRecommendation,
} from './workspace-helpers';
import { CommandInput } from './command-input';
import { DecompositionPanel } from './decomposition-panel';
import { SubtaskTree } from './subtask-tree';
import { DagPanel } from './dag-panel';
import { ExecutionLogStream } from './execution-log-stream';
import { AgentRunDrawer } from './agent-run-drawer';
import { ReviewDock } from './review-dock';
import { EmptyTaskState, ErrorState, LoadingState } from './empty-states';
import { ManorResultPanel } from './manor-result-panel';
import { ManorStageStrip } from './manor-stage-strip';
import { DemoAgentMatrix } from './demo-agent-matrix';
import { AgentWorkVisualizer } from './agent-work-visualizer';
import { useCommandCenterData } from '../hooks/use-command-center-data';
import { useTaskStatus } from '../hooks/use-task-status';
import {
  BUILD_LEDGER_STATUS_LABEL,
  readBuildLedger,
  subscribeBuildLedger,
  syncBuildLedgerFromServer,
  type BuildLedgerEntry,
  type BuildLedgerStatus,
} from '@/features/operating-loop/lib/build-ledger';
import { getBuildCaseActions, transitionBuildCase, type BuildCaseAction } from '@/features/operating-loop/lib/build-case';
import { BuildLedgerBackendTrace, BuildLedgerObjectPassport } from '@/features/operating-loop/components/ObjectPassport';
import { ReleaseArchiveGate } from '@/features/operating-loop/components/ReleaseArchiveGate';
import { AgentDialogueCorner } from '@/components/chaotang/agents/AgentDialogueCorner';

export interface CommandCenterWorkspaceProps {
  pinnedTaskId?: string;
}

const STAGE_META: Record<
  CommandCenterStage,
  { label: string; title: string; description: string; rule: string }
> = {
  decomposition: {
    label: '拆解中',
    title: '当前重点是把问题压成可执行结构。',
    description:
      '军机处现在不求把所有材料看完，而求把任务定义、依赖关系和分派边界压到足够清楚。只要问题没压清楚，就不往下送。',
    rule: '边界不清，不进治理，不进执行。',
  },
  execution: {
    label: '执行中',
    title: '当前重点是看哪里在推进，哪里被卡住。',
    description:
      '任务已从“定义问题”进入“推动事情”。此时不再重新解释问题，而是观察推进、阻塞和是否需要改路由或补充指令。',
    rule: '执行阶段优先看阻塞与偏差，不反复重写问题本身。',
  },
  review: {
    label: '待裁断',
    title: '当前重点是形成最终批示，而不是继续加做分析。',
    description:
      '结果已收拢成呈报，中枢的职责已接近完成。下一步应尽快做批示或送入治理流，而不是无限期停留在分析态。',
    rule: '呈报已成，优先批示与分流，不拖延在中枢。',
  },
  complete: {
    label: '已完成',
    title: '当前重点应转向沉淀、追踪与复用。',
    description:
      '任务已完成或已归档。军机处此时不是最佳停留点，更合理的动作是转复盘台看个案复盘，或回业务层看后续回写。',
    rule: '任务已结案，离开中枢，进入沉淀层或执行追踪层。',
  },
};

function dispatchImperialActionAccepted() {
  window.dispatchEvent(new CustomEvent('chaotang:imperial-action-accepted'));
  window.dispatchEvent(new CustomEvent('chaotang:scroll-action-seal'));
}

function commandCenterSourceLabel(taskRuns: AgentRun[], currentTask: Task | null) {
  if (taskRuns.length > 0) return 'LIVE';
  if (currentTask) return 'MIXED';
  return 'DEMO';
}

function commandCenterSourceCopy(label: string) {
  if (label === 'LIVE') return '真源';
  if (label === 'DEMO') return '演示';
  return '混合';
}

function CommandCenterSourcePlaque({ label }: { label: string }) {
  const live = label === 'LIVE';
  const demo = label === 'DEMO';
  return (
    <span
      data-three-axis-source-plaque={label}
      data-three-axis-dock-source-plaque
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
      style={{
        borderColor: live ? 'rgba(185,246,210,0.30)' : demo ? 'rgba(252,165,184,0.34)' : 'rgba(240,198,106,0.34)',
        background: live ? 'rgba(61,214,140,0.08)' : demo ? 'rgba(122,36,30,0.20)' : 'rgba(240,198,106,0.10)',
        color: live ? '#B9F6D2' : demo ? '#FCA5B8' : '#F0C66A',
        boxShadow: 'inset 0 1px 0 rgba(245,233,201,0.08), 0 0 18px rgba(240,198,106,0.16)',
      }}
      title={`军机传旨台来源：${label}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: live ? '#B9F6D2' : demo ? '#FCA5B8' : '#F0C66A' }} />
      {label}
      <span className="font-serif text-[10px] tracking-[0.08em]">{commandCenterSourceCopy(label)}</span>
    </span>
  );
}

interface UnifiedLoopSummary {
  loopId: string;
  loopTraceId: string;
  sourceLabel: string;
  selectedDepartments: string[];
  nextAction: string;
  qualityPassed: boolean;
  blockingIssues: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function deriveUnifiedLoopSummary(task: Task | null): UnifiedLoopSummary | null {
  const result = asRecord(task?.result);
  const loop = asRecord(result?.unifiedLoop) ?? asRecord(asRecord(result?.shangshufangDecision)?.unified_loop);
  if (!loop) return null;

  const reviewPlan = asRecord(loop.reviewPlan);
  const memorial = asRecord(loop.memorial);
  const qualityGate = asRecord(memorial?.qualityGate);
  const loopId = typeof loop.loopId === 'string' ? loop.loopId : 'court_unified_decision_loop_v1';
  const loopTraceId = typeof loop.loopTraceId === 'string' ? loop.loopTraceId : '';
  const sourceLabel = typeof loop.sourceLabel === 'string'
    ? loop.sourceLabel
    : typeof memorial?.sourceLabel === 'string'
      ? memorial.sourceLabel
      : 'MIXED';
  const selectedDepartments = readStringArray(reviewPlan?.selectedDepartments);
  const nextAction = typeof memorial?.nextAction === 'string' ? memorial.nextAction : '等待军机处收束下一步';
  const qualityPassed = qualityGate?.passed === true;
  const blockingIssues = readStringArray(qualityGate?.blockingIssues);

  return {
    loopId,
    loopTraceId,
    sourceLabel,
    selectedDepartments,
    nextAction,
    qualityPassed,
    blockingIssues,
  };
}

function UnifiedLoopSummaryCard({ summary }: { summary: UnifiedLoopSummary }) {
  const blocked = !summary.qualityPassed || summary.blockingIssues.length > 0;
  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="section-eyebrow">CourtOS Loop · 统一朝堂链路</div>
            <CommandCenterSourcePlaque label={summary.sourceLabel} />
          </div>
          <div className="mt-2 text-[17px] font-semibold text-[#F5E9C9]">
            上书房确认后已进入统一 Loop，军机处正在看同一个案号。
          </div>
          <div className="mt-2 text-[12px] leading-6 text-[#B6BDD5]">
            {summary.loopId}{summary.loopTraceId ? ` · ${summary.loopTraceId}` : ''}
          </div>
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
          blocked
            ? 'border-[#F0C66A]/30 bg-[#F0C66A]/10 text-[#F0C66A]'
            : 'border-[#3DD68C]/30 bg-[#3DD68C]/10 text-[#8BE4B4]'
        }`}>
          {blocked ? '质门未放行' : '质门通过'}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">选部</div>
          <div className="mt-2 text-[13px] leading-6 text-[#F5E9C9]">
            {summary.selectedDepartments.length ? summary.selectedDepartments.join(' / ') : '等待定审'}
          </div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">下一步</div>
          <div className="mt-2 text-[13px] leading-6 text-[#F5E9C9]">{summary.nextAction}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">质门</div>
          <div className="mt-2 text-[13px] leading-6 text-[#F5E9C9]">
            {summary.blockingIssues.length ? summary.blockingIssues.slice(0, 2).join('；') : '暂无阻断项'}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

const COMMAND_CENTER_JOURNEY = [
  {
    label: '上承',
    title: '接住上书房的一件事',
    body: '用户带着真实问题进来，不需要理解蜂群，只要确认主案是否对。',
    href: '/court-briefing',
    icon: FileText,
  },
  {
    label: '中枢',
    title: '组织会审与执行流',
    body: '军机处把问题拆成部门责任、证据缺口、执行节点和风险边界。',
    href: '/command-center',
    icon: Network,
  },
  {
    label: '裁断',
    title: '形成可批示结果',
    body: '当材料足够时，页面应催用户采纳、追问、打回或送三省。',
    href: '/governance',
    icon: Gavel,
  },
  {
    label: '下启',
    title: '归档并反哺明日建议',
    body: '结果要进入史馆，下一次同类问题能引用旧案，而不是重来一遍。',
    href: '/archive',
    icon: Archive,
  },
] as const;

function CommandCenterMeetingBoard({
  tasks,
  currentTask,
  taskRuns,
  stage,
  route,
}: {
  tasks: Task[];
  currentTask: Task | null;
  taskRuns: AgentRun[];
  stage: CommandCenterStage;
  route: { title: string; body: string; href: string; cta: string };
}) {
  const activeProjects = deriveMeetingProjects(tasks, currentTask);
  const opinions = deriveMeetingOpinions(currentTask, taskRuns);
  const swarms = deriveMeetingSwarms(currentTask, taskRuns);
  const chairFeed = deriveChairFeed(currentTask, taskRuns, stage);

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="section-eyebrow">军机处 · 丞相主持会</div>
          <div className="mt-2 text-[20px] font-semibold leading-7 text-[#F5E9C9]">
            {currentTask ? '一屏看清现在开什么会、谁在场、意见是否能收束。' : '还没有开会，先立一件真案。'}
          </div>
          <div className="mt-2 max-w-[78ch] text-[12px] leading-6 text-[#B6BDD5]">
            军机处按内容分区：项目在左，参会意见在中，蜂群团队和丞相实况在右。用户不需要先理解系统流程，只要知道当前会议能否形成下一步。
          </div>
        </div>
        <Link
          href={route.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/12 px-3 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
        >
          {route.cta}
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr_0.8fr]">
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F835F]">
              <GitBranch size={12} className="text-[#F0C66A]" />
              正在办理
            </div>
            <span className="rounded-full border border-[#F0C66A]/18 bg-[#F0C66A]/[0.06] px-2 py-0.5 text-[10px] text-[#F0C66A]">
              {activeProjects.length} 项
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {activeProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="w-full rounded-lg border border-white/8 bg-black/15 px-3 py-3 text-left transition hover:border-[#F0C66A]/25 hover:bg-[#F0C66A]/[0.045]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[13px] font-semibold leading-5 text-[#EAEEFB]">{project.title}</div>
                    <div className="mt-1 line-clamp-1 text-[10px] text-[#8F98B8]">{project.id}</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#D9C79A]">
                    {formatTaskStatus(project.status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F835F]">
            <MessageSquareText size={12} className="text-[#F0C66A]" />
            参会意见
          </div>
          <div className="mt-3 space-y-2">
            {opinions.map((opinion) => (
              <div key={opinion.id} className="rounded-lg border border-white/8 bg-black/15 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-semibold text-[#F5E9C9]">{opinion.name}</div>
                  <span className={['rounded-full border px-2 py-0.5 text-[10px]', opinion.tone].join(' ')}>
                    {opinion.stance}
                  </span>
                </div>
                <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#AEB7D4]">{opinion.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F835F]">
              <UsersRound size={12} className="text-[#F0C66A]" />
              下辖蜂群
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {swarms.map((swarm) => (
                <Link
                  key={swarm.id}
                  href={swarm.href}
                  className="rounded-full border border-[#6BA0FF]/20 bg-[#6BA0FF]/[0.06] px-3 py-1.5 text-[10px] text-[#B8C9FF] transition hover:border-[#F0C66A]/30 hover:text-[#F0C66A]"
                >
                  {swarm.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#F0C66A]/14 bg-[#F0C66A]/[0.045] p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F835F]">
              <UserRoundCheck size={12} className="text-[#F0C66A]" />
              丞相主持实况
            </div>
            <div className="mt-3 space-y-2">
              {chairFeed.map((item) => (
                <div key={item.label} className="flex gap-2 rounded-lg border border-white/8 bg-black/15 px-3 py-2">
                  <span className={['mt-1 h-2 w-2 shrink-0 rounded-full', item.active ? 'bg-[#3DD68C]' : 'bg-[#6A7299]'].join(' ')} />
                  <div>
                    <div className="text-[11px] font-semibold text-[#EAEEFB]">{item.label}</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-[#9AA3C4]">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {COMMAND_CENTER_JOURNEY.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/10 px-3 py-2 transition hover:border-[#F0C66A]/25 hover:bg-[#F0C66A]/[0.04]"
            >
              <span className="flex items-center gap-2">
                <Icon size={12} className="text-[#F0C66A]/85" />
                <span className="text-[10px] font-semibold tracking-[0.12em] text-[#D9C79A]">{item.label}</span>
                <span className="text-[11px] text-[#8F98B8]">{item.title}</span>
              </span>
              <ChevronRight size={11} className="text-[#6A7299]" />
            </Link>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function deriveMeetingProjects(tasks: Task[], currentTask: Task | null) {
  const projects = currentTask
    ? [currentTask, ...tasks.filter((task) => task.id !== currentTask.id)]
    : tasks;
  return projects.slice(0, 3);
}

function deriveMeetingOpinions(currentTask: Task | null, taskRuns: AgentRun[]) {
  if (!currentTask) {
    return [
      {
        id: 'prime-empty',
        name: '丞相',
        stance: '候旨',
        tone: 'border-[#F0C66A]/20 bg-[#F0C66A]/10 text-[#F0C66A]',
        summary: '当前尚无正式案卷。先写一条真实经营问题，丞相再召集相关蜂群参会。',
      },
      {
        id: 'qintian-empty',
        name: '钦天监',
        stance: '待观势',
        tone: 'border-[#6BA0FF]/20 bg-[#6BA0FF]/10 text-[#B8C9FF]',
        summary: '没有主案时只保留大势提醒，不抢军机处的会审主位。',
      },
    ];
  }

  const sourceRuns = taskRuns.length > 0
    ? taskRuns
    : (currentTask.plan?.assignedAgents ?? []).map((agentCode, index) => ({
        id: `${currentTask.id}-${agentCode}-${index}`,
        taskId: currentTask.id,
        subtaskId: `${currentTask.id}-subtask-${index}`,
        agentCode,
        state: 'assigned' as const,
        progressPct: 0,
        currentTaskTitle: undefined,
        latestSummary: undefined,
        isWaitingDependency: false,
        hasReported: false,
      }));

  return sourceRuns.slice(0, 4).map((run) => {
    const meta = AGENT_META[run.agentCode];
    const failed = run.state === 'failed';
    const completed = run.state === 'completed' || run.state === 'fallback_completed';
    const waiting = run.state === 'waiting_dependency' || run.isWaitingDependency;
    return {
      id: run.id,
      name: meta?.nameCn ?? getNodeDisplayName(run.agentCode),
      stance: failed ? '反对推进' : completed ? '可收束' : waiting ? '待补证' : '参议中',
      tone: failed
        ? 'border-[#F58B8B]/24 bg-[#F58B8B]/10 text-[#F5B5B5]'
        : completed
          ? 'border-[#3DD68C]/24 bg-[#3DD68C]/10 text-[#8BE4B4]'
          : waiting
            ? 'border-[#F5A524]/24 bg-[#F5A524]/10 text-[#F5C56A]'
            : 'border-[#6BA0FF]/20 bg-[#6BA0FF]/10 text-[#B8C9FF]',
      summary: run.latestSummary
        ?? run.currentTaskTitle
        ?? `${meta?.description ?? '相关蜂群'}正在围绕「${currentTask.title}」给出可执行意见。`,
    };
  });
}

function deriveMeetingSwarms(currentTask: Task | null, taskRuns: AgentRun[]) {
  const ids = new Set<string>();
  taskRuns.forEach((run) => {
    ids.add(run.assignedNodeId ?? run.agentCode);
    run.routingNodeIds?.forEach((nodeId) => ids.add(nodeId));
  });
  currentTask?.plan?.assignedAgents?.forEach((agentCode) => ids.add(agentCode));
  currentTask?.plan?.assignedNodeIds?.forEach((nodeId) => ids.add(nodeId));

  if (ids.size === 0) {
    ['prime_minister', 'gong_bu', 'hu_bu', 'bing_bu'].forEach((id) => ids.add(id));
  }

  return Array.from(ids).slice(0, 8).map((id) => ({
    id,
    name: getNodeDisplayName(id),
    href: '/manors',
  }));
}

function deriveChairFeed(currentTask: Task | null, taskRuns: AgentRun[], stage: CommandCenterStage) {
  const running = taskRuns.filter((run) => run.state === 'running').length;
  const completed = taskRuns.filter((run) => run.state === 'completed' || run.state === 'fallback_completed').length;
  const blocked = taskRuns.filter((run) => run.state === 'failed' || run.isWaitingDependency).length;

  return [
    {
      label: currentTask ? '定题' : '候题',
      body: currentTask ? `主案已定为「${currentTask.title}」。` : '等待用户下第一道密旨，丞相不空开会。',
      active: Boolean(currentTask),
    },
    {
      label: '分派',
      body: currentTask ? `${running} 路执行中，${completed} 路已回收意见。` : '立案后自动召集相关部门与蜂群。',
      active: stage === 'execution' || running > 0 || completed > 0,
    },
    {
      label: blocked > 0 ? '解卡' : '收束',
      body: blocked > 0 ? `${blocked} 处需要补证或改派。` : routeReadyCopy(stage),
      active: stage === 'review' || blocked > 0,
    },
  ];
}

function routeReadyCopy(stage: CommandCenterStage) {
  if (stage === 'review') return '材料已接近可裁断，丞相正在压成批示建议。';
  if (stage === 'complete') return '案件已离开中枢，等待史馆沉淀复用。';
  return '材料未够时不急着裁断，先继续压清边界。';
}

function formatTaskStatus(status: Task['status']) {
  switch (status) {
    case 'draft':
      return '草拟';
    case 'submitted':
      return '已提交';
    case 'interpreting':
      return '理解';
    case 'planning':
      return '筹划';
    case 'assigned':
      return '已分派';
    case 'running':
      return '执行';
    case 'aggregating':
      return '收束';
    case 'report_ready':
      return '待裁断';
    case 'reviewed':
      return '已批示';
    case 'archived':
      return '已归档';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

function BuildLedgerReceivingDock({
  entries,
  transitioningId,
  error,
  onTransition,
}: {
  entries: BuildLedgerEntry[];
  transitioningId: string | null;
  error: string | null;
  onTransition: (entry: BuildLedgerEntry, status: BuildLedgerStatus, note: string) => void;
}) {
  if (entries.length === 0) return null;
  const primary = entries[0]!;
  const auditTrail = primary.auditTrail ?? [];
  const actions = getBuildCaseActions(primary);

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <section aria-label="军机处建设接单台" className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr_0.8fr]">
        <div>
          <div className="section-eyebrow">建设接单台</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="text-[17px] font-semibold text-[#F5E9C9]">待复核建设任务</div>
            <span className="rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/[0.07] px-2 py-0.5 text-[10px] text-[#F0C66A]">
              {entries.length} 件
            </span>
          </div>
          <div className="mt-2 text-[12px] leading-6 text-[#B6BDD5]">
            工部、户部等部门发来的建设案在这里完成军机处复核，确认对象、证据、状态和归档闸口。
          </div>
          <div className="mt-3 rounded-lg border border-white/8 bg-black/15 px-3 py-2 text-[11px] leading-5 text-[#9AA3C4]">
            taskId: {primary.taskId}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <BuildCaseActionButton
                key={action.id}
                action={action}
                entry={primary}
                busy={transitioningId === primary.id}
                onTransition={onTransition}
              />
            ))}
            <Link
              href={`/shiguan?taskId=${encodeURIComponent(primary.taskId)}`}
              className="rounded-full border border-[#3DD68C]/30 bg-[#3DD68C]/10 px-3 py-2 text-[11px] text-[#8BE4B4] transition hover:bg-[#3DD68C]/16"
            >
              送史馆复盘
            </Link>
          </div>
          {error ? (
            <div className="mt-3 rounded-lg border border-[#F58B8B]/22 bg-[#F58B8B]/[0.07] px-3 py-2 text-[11px] text-[#F5B5B5]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <BuildLedgerObjectPassport entry={primary} tone="blue" />
          <BuildLedgerBackendTrace entry={primary} />
          <div className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">状态时间线</div>
            <div className="mt-2 text-[12px] font-semibold text-[#F5E9C9]">状态：{BUILD_LEDGER_STATUS_LABEL[primary.status]}</div>
            <div className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#AEB7D4]">
              {auditTrail.length > 0 ? auditTrail.slice(-3).map((event) => (
                <div key={event.id} className="rounded border border-white/8 bg-black/15 px-2 py-1.5">
                  {event.actor} · {event.note}
                </div>
              )) : (
                <div className="rounded border border-dashed border-[#F0C66A]/18 bg-[#F0C66A]/[0.04] px-2 py-1.5 text-[#D9C79A]">
                  等待首次审计 · 点击「开始复核」后记录军机处身份、状态和时间。
                </div>
              )}
            </div>
          </div>
        </div>

        <ReleaseArchiveGate entry={primary} />
      </section>
    </GlassPanel>
  );
}

function BuildCaseActionButton({
  action,
  entry,
  busy,
  onTransition,
}: {
  action: BuildCaseAction;
  entry: BuildLedgerEntry;
  busy: boolean;
  onTransition: (entry: BuildLedgerEntry, status: BuildLedgerStatus, note: string) => void;
}) {
  const labelByAction: Record<string, string> = {
    start_review: '开始复核',
    return_for_evidence: '退回补证',
    archive: '送史馆归档',
    recall: '上书房召回',
    blocked_release: '禁止直接发布',
  };
  const noteByAction: Record<string, string> = {
    start_review: '军机处开始复核工部建设任务',
    return_for_evidence: '军机处退回补证：请补齐验收证据和发布边界',
    archive: '军机复核完成，送史馆归档复盘',
  };
  const toneClass = {
    primary: 'border-[#F0C66A]/35 bg-[#F0C66A]/12 text-[#F0C66A] hover:bg-[#F0C66A]/18',
    warning: 'border-[#F0C66A]/26 bg-[#F0C66A]/8 text-[#F5D38A] hover:bg-[#F0C66A]/14',
    success: 'border-[#3DD68C]/30 bg-[#3DD68C]/10 text-[#8BE4B4] hover:bg-[#3DD68C]/16',
    muted: 'border-white/10 text-[#EAEEFB] hover:bg-white/5',
    danger: 'border-[#F58B8B]/26 bg-[#F58B8B]/8 text-[#F5B5B5] hover:bg-[#F58B8B]/14',
  } satisfies Record<BuildCaseAction['tone'], string>;
  const disabled = busy || action.disabled || !action.toStatus;

  return (
    <button
      type="button"
      title={action.reason}
      disabled={disabled}
      onClick={() => action.toStatus && onTransition(entry, action.toStatus, noteByAction[action.id] ?? action.label)}
      className={`rounded-full border px-3 py-2 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass[action.tone]}`}
    >
      {busy && action.toStatus ? '写回中...' : labelByAction[action.id] ?? action.label}
    </button>
  );
}

type WorkspaceFocus = 'overview' | 'structure' | 'execution' | 'review';

export function CommandCenterWorkspace({ pinnedTaskId }: CommandCenterWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const {
    phase,
    error,
    tasks,
    currentTask,
    taskRuns,
    selectTask,
    submitCommand,
    refresh,
    manorResult,
    manorLoading,
    manorError,
    manorStages,
    manorFallback,
  } = useCommandCenterData(pinnedTaskId);

  useTaskStatus(currentTask?.id ?? null);

  const [drawerRun, setDrawerRun] = useState<AgentRun | null>(null);
  const [recentlyIssuedTaskId, setRecentlyIssuedTaskId] = useState<string | null>(null);
  const [buildLedger, setBuildLedger] = useState<BuildLedgerEntry[]>([]);
  const [transitioningLedgerId, setTransitioningLedgerId] = useState<string | null>(null);
  const [ledgerTransitionError, setLedgerTransitionError] = useState<string | null>(null);
  const [quickCommand, setQuickCommand] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickReceipt, setQuickReceipt] = useState<string | null>(null);
  const [workspaceFocus, setWorkspaceFocus] = useState<WorkspaceFocus>('overview');
  const commandInputRef = useRef<HTMLDivElement | null>(null);

  const assignedAgents = currentTask?.plan?.assignedAgents ?? [];
  const assignedNodeIds = currentTask?.plan?.assignedNodeIds ?? [];
  const runningCount = taskRuns.filter((r) => r.state === 'running').length;
  const blockedCount = taskRuns.filter((r) => r.state === 'failed').length;
  const stage = deriveCommandCenterStage(currentTask);
  const stageMeta = STAGE_META[stage];
  const route = deriveRouteRecommendation(currentTask, taskRuns);
  const topLine = deriveCenterTopline(currentTask, taskRuns);
  const unifiedLoopSummary = deriveUnifiedLoopSummary(currentTask);
  const workspaceMotion = reduceMotion
    ? {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
      };

  useEffect(() => {
    if (!currentTask) {
      setWorkspaceFocus('overview');
      return;
    }
    if (stage === 'review' || buildLedger.length > 0) {
      setWorkspaceFocus('review');
      return;
    }
    if (stage === 'execution') {
      setWorkspaceFocus('execution');
      return;
    }
    setWorkspaceFocus('structure');
  }, [currentTask?.id, stage, buildLedger.length]);

  useEffect(() => {
    if (!recentlyIssuedTaskId) return;
    const timer = window.setTimeout(() => {
      setRecentlyIssuedTaskId(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [recentlyIssuedTaskId]);

  useEffect(() => {
    const refreshLedger = () => setBuildLedger(readBuildLedger());
    refreshLedger();
    void syncBuildLedgerFromServer().then(setBuildLedger).catch(() => {});
    return subscribeBuildLedger(refreshLedger);
  }, []);

  const handleLedgerTransition = useCallback(async (
    entry: BuildLedgerEntry,
    status: BuildLedgerStatus,
    note: string,
  ) => {
    setTransitioningLedgerId(entry.id);
    setLedgerTransitionError(null);
    try {
      const serverEntry = await transitionBuildCase({ entry, toStatus: status, note });
      setBuildLedger((current) => [serverEntry, ...current.filter((item) => item.id !== entry.id)]);
    } catch (error) {
      const message = error instanceof Error && error.message === 'build_case_transition_evidence_required'
        ? '建设案质门阻断：缺少证据，先退回工部补证。'
        : '状态写回失败：请检查登录状态或 /api/court/build-ledger。';
      setLedgerTransitionError(message);
    } finally {
      setTransitioningLedgerId(null);
    }
  }, []);

  const focusCommandInput = useCallback(() => {
    // 注：caseScrollOpenRequest 机制已被 court-ui-sync 重构移除(声明+消费者均删)，
    // 此处原孤儿 setter 调用一并清除(合并收尾，铁律3 合并即清理)。
    commandInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      const input =
        commandInputRef.current?.querySelector('textarea') ??
        document.querySelector('[data-command-center-quick-input]');
      if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) input.focus();
    }, 260);
  }, []);

  const submitQuickCommand = useCallback(async (rawCommand: string) => {
    const command = rawCommand.trim();
    if (!command || quickSubmitting) {
      focusCommandInput();
      return;
    }
    setQuickReceipt(`军机处已接旨：${command.slice(0, 24)} 已进入会审链路。`);
    dispatchImperialActionAccepted();
    setQuickSubmitting(true);
    try {
      const created = await submitCommand(command, 'hybrid');
      if (created) {
        setRecentlyIssuedTaskId(created.id);
        setQuickCommand('');
      }
    } finally {
      setQuickSubmitting(false);
    }
  }, [focusCommandInput, quickSubmitting, submitCommand]);

  const handleQuickCommand = useCallback(async () => {
    await submitQuickCommand(quickCommand);
  }, [quickCommand, submitQuickCommand]);

  return (
    <div className="relative h-full overflow-y-auto pb-[240px]">
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetUrl('/assets/junjichu/junjichu.webp')}
          alt=""
          draggable={false}
          className="h-full w-full object-cover opacity-28"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,18,0.90),rgba(4,8,18,0.72)_22%,rgba(4,8,18,0.58)_48%,rgba(4,8,18,0.86)_100%)]" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_top,rgba(240,198,106,0.08),transparent_34%),radial-gradient(circle_at_center,rgba(107,160,255,0.05),transparent_42%)]" />
      <div className="relative z-[2]">
      <div className="mx-auto max-w-[1600px] px-6 pb-6 pt-4">
        <DeptPageShell deptKey="command-center" hideBannerProfile heroDensity="slim" tabsDensity="compact">
          <div className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F0C66A]/20 bg-gradient-to-r from-[#15120a] to-[#0a0704] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/8 px-3 py-1 text-[#F0C66A]">
                    <Sparkles size={11} />
                    当前阶段 · {stageMeta.label}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[#9AA3C4]">
                    <Activity size={11} className="text-[#3DD68C]" />
                    <span><span className="font-mono font-bold text-[#3DD68C]">{runningCount}</span> 路执行中</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[#9AA3C4]">
                    <Radar size={11} className={blockedCount > 0 ? 'text-[#F58B8B]' : 'text-[#8AA4FF]'} />
                    <span>{blockedCount > 0 ? <><span className="font-mono font-bold text-[#F58B8B]">{blockedCount}</span> 处阻塞</> : '无阻塞'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[#9AA3C4]">
                    <Archive size={11} className="text-[#8AA4FF]" />
                    <span>{tasks.length} 件案卷</span>
                  </div>
                </div>
                <Link
                  href={route.href}
                  className="flex items-center gap-1.5 rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/10 px-3 py-1.5 text-[11px] font-medium text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
                >
                  下一步 · {route.title}
                  <ChevronRight size={11} />
                </Link>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-3">
                {[
                  ['主案', currentTask ? currentTask.title : '未立真案'],
                  ['中枢判断', topLine.title || '等待军机处接案'],
                  ['当前去向', route.title],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#F0C66A]/16 bg-[#F0C66A]/[0.035] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">{label}</div>
                    <div className="mt-1.5 line-clamp-2 text-[12px] font-semibold leading-5 text-[#F5E9C9]">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:h-[calc(100vh-360px)] xl:min-h-[760px]">
              <main className="flex h-full min-h-0 flex-col gap-3">
                <GlassPanel variant="gold" tone="elevated" padding="sm" hudCorners>
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div>
                      <div className="section-eyebrow">Single Screen Command Deck · 单屏军机中枢</div>
                      <div className="mt-1.5 text-[15px] font-semibold leading-5 text-[#F5E9C9]">
                        {topLine.title || '收束军机处当前主案、执行和裁断'}
                      </div>
                      {topLine.body ? (
                        <div className="mt-1 max-w-[72ch] text-[11px] leading-5 text-[#B6BDD5]">{topLine.body}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'overview', label: '总览', icon: FileText },
                        { id: 'structure', label: '结构', icon: GitBranch },
                        { id: 'execution', label: '执行', icon: Activity },
                        { id: 'review', label: '复核', icon: Gavel },
                      ].map((item) => {
                        const Icon = item.icon;
                        const active = workspaceFocus === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setWorkspaceFocus(item.id as WorkspaceFocus)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition ${
                              active
                                ? 'border-[#F0C66A]/36 bg-[#F0C66A]/12 text-[#F0C66A]'
                                : 'border-white/10 bg-black/15 text-[#9AA3C4] hover:border-[#F0C66A]/20 hover:text-[#F0C66A]'
                            }`}
                          >
                            <Icon size={11} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </GlassPanel>

                <div className="grid shrink-0 gap-2.5 md:grid-cols-4">
                  {[
                    ['指派节点', `${assignedNodeIds.length || assignedAgents.length}`],
                    ['运行记录', `${taskRuns.length}`],
                    ['建设接单', `${buildLedger.length}`],
                    ['统一质门', unifiedLoopSummary ? (unifiedLoopSummary.qualityPassed ? '通过' : '待放行') : '待生成'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-black/18 px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">{label}</div>
                      <div className="mt-1.5 text-[16px] font-semibold text-[#F5E9C9]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/8 bg-[#050912]/78 shadow-[0_24px_64px_rgba(0,0,0,0.32)] backdrop-blur-md">
                  <div className="h-full overflow-y-auto p-4">
                    <AnimatePresence mode="wait" initial={false}>
                      {phase === 'loading' && tasks.length === 0 ? (
                        <motion.div key="loading" {...workspaceMotion}>
                          <LoadingState />
                        </motion.div>
                      ) : phase === 'error' && !currentTask ? (
                        <motion.div key="error" {...workspaceMotion}>
                          <ErrorState message={error ?? '未知错误'} onRetry={refresh} />
                        </motion.div>
                      ) : !currentTask ? (
                        <motion.div key="empty" className="space-y-4" {...workspaceMotion}>
                          <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="section-eyebrow">First Action · 第一动作</div>
                                <div className="mt-2 text-[18px] font-semibold text-[#F5E9C9]">
                                  先在这里下第一道密旨，不必再滚动浏览长页面。
                                </div>
                                <div className="mt-2 max-w-[72ch] text-[12px] leading-6 text-[#B6BDD5]">
                                  只要写清楚真正要处理的一件事，军机处会自动生成当前案件、去向判断和工作区。
                                </div>
                              </div>
                              <div className="rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.05] px-4 py-4">
                                <div className="text-[12px] uppercase tracking-[0.18em] text-[#8F835F]">当前去向</div>
                                <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">{route.title}</div>
                              </div>
                            </div>
                          </GlassPanel>
                          <div id="command-input" ref={commandInputRef}>
                            <CommandInput
                              onSubmit={submitCommand}
                              onIssued={(task) => setRecentlyIssuedTaskId(task.id)}
                              autoFocus={!pinnedTaskId}
                            />
                          </div>
                          <CommandCenterMeetingBoard
                            tasks={tasks}
                            currentTask={currentTask}
                            taskRuns={taskRuns}
                            stage={stage}
                            route={route}
                          />
                          <EmptyTaskState />
                        </motion.div>
                      ) : (
                        <motion.div key={`${currentTask.id}-${workspaceFocus}`} className="space-y-4" {...workspaceMotion}>
                          {phase === 'error' && error ? <SoftErrorBanner message={error} onRetry={refresh} /> : null}
                          <ManorStageStrip stages={manorStages} fallback={manorFallback} />
                          {workspaceFocus === 'overview' ? (
                            <>
                              <CommandCenterMeetingBoard
                                tasks={tasks}
                                currentTask={currentTask}
                                taskRuns={taskRuns}
                                stage={stage}
                                route={route}
                              />
                              <FirstActionStrip currentTask={currentTask} route={route} />
                              <DemoAgentMatrix
                                active={
                                  currentTask.status === 'running' || currentTask.status === 'aggregating'
                                }
                              />
                            </>
                          ) : null}
                          {workspaceFocus === 'structure' ? (
                            <>
                              <StagePriorityCard task={currentTask} runs={taskRuns} route={route} />
                              <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-12 xl:col-span-7">
                                  <DecompositionPanel task={currentTask} />
                                </div>
                                <div className="col-span-12 xl:col-span-5">
                                  <SubtaskTree
                                    assignedAgents={assignedAgents}
                                    assignedNodeIds={assignedNodeIds}
                                    runs={taskRuns}
                                    onSelect={setDrawerRun}
                                  />
                                </div>
                                <div className="col-span-12">
                                  <DagPanel task={currentTask} runs={taskRuns} />
                                </div>
                              </div>
                            </>
                          ) : null}
                          {workspaceFocus === 'execution' ? (
                            <>
                              <AgentWorkVisualizer
                                task={currentTask}
                                runs={taskRuns}
                                onRunClick={setDrawerRun}
                              />
                              <ExecutionLogStream runs={taskRuns} onRunClick={setDrawerRun} />
                            </>
                          ) : null}
                          {workspaceFocus === 'review' ? (
                            <>
                              {buildLedger.length > 0 ? (
                                <BuildLedgerReceivingDock
                                  entries={buildLedger}
                                  transitioningId={transitioningLedgerId}
                                  error={ledgerTransitionError}
                                  onTransition={handleLedgerTransition}
                                />
                              ) : null}
                              {unifiedLoopSummary ? <UnifiedLoopSummaryCard summary={unifiedLoopSummary} /> : null}
                              <ReviewDock task={currentTask} />
                              <ManorResultPanel result={manorResult} loading={manorLoading} error={manorError} taskId={currentTask?.id} />
                            </>
                          ) : null}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </DeptPageShell>
      </div>

      <AgentRunDrawer run={drawerRun} onClose={() => setDrawerRun(null)} />
      <AgentDialogueCorner
        side="left"
        name="丞相"
        duty="Chief of Staff"
        line={currentTask ? '臣正在收束分歧、证据和下一步裁断；未成奏折，不急着让陛下拍板。' : '臣在军机处候旨；先立一件真案，才能召集群臣会审。'}
        portrait="/heroes/character-roster/v5-command-center-zhuge-liang.webp"
        accent="#F0C66A"
        actionLabel="看密折"
        onAction={focusCommandInput}
        bottomClassName="bottom-[164px]"
      />
      <AgentDialogueCorner
        side="right"
        name="军机大臣"
        duty="Council Agent"
        line={currentTask ? `${runningCount} 路执行、${blockedCount} 处阻塞；臣只看谁负责、何时回奏、证据是否够。` : '无真案时不装作会审；先由上书房或底部快旨发起任务。'}
        portrait="/heroes/character-roster/v5-command-center-zhuge-liang.webp"
        accent="#8AA4FF"
        actionLabel="问军机"
        onAction={focusCommandInput}
        bottomClassName="bottom-[164px]"
      />
      <section
        data-three-axis-decree-input
        className="fixed inset-x-0 z-[60] overflow-x-hidden overflow-y-visible px-4 lg:px-8"
        style={{
          background:
            'linear-gradient(0deg, rgba(10,8,4,0.97) 0%, rgba(14,12,8,0.94) 80%, rgba(14,12,8,0) 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          boxShadow: '0 -18px 70px rgba(0,0,0,0.58), inset 0 1px 0 rgba(245,233,201,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="军机处底部下旨栏"
      >
        <div
          aria-hidden
          className="h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, #F0C66A, transparent)',
            boxShadow: '0 0 16px rgba(240,198,106,0.40)',
          }}
        />
        {quickReceipt ? (
          <div
            data-three-axis-action-receipt
            className="animate-fade-in-up mx-auto mb-2 mt-2 flex max-w-[1920px] items-center justify-between gap-3 rounded-lg border border-[#F0C66A]/30 px-3 py-2 text-[11px] font-semibold text-[#F5E9C9]"
            style={{
              background: 'linear-gradient(90deg, rgba(122,36,30,0.24), rgba(240,198,106,0.12) 42%, rgba(0,0,0,0.18))',
              boxShadow: '0 8px 26px rgba(0,0,0,0.24), inset 0 1px 0 rgba(245,233,201,0.08)',
            }}
            role="status"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                data-three-axis-action-seal
                aria-hidden
                className="grid h-8 w-8 shrink-0 rotate-[-7deg] place-items-center rounded-[6px] border text-[10px] font-black leading-[1.05] tracking-[0.12em] text-[#FFE8D6]"
                style={{
                  borderColor: 'rgba(255,232,214,0.72)',
                  background: 'linear-gradient(145deg, rgba(154,38,27,0.98), rgba(96,20,18,0.92))',
                  boxShadow: '0 0 0 1px rgba(122,36,30,0.72), 0 8px 18px rgba(122,36,30,0.32)',
                  fontFamily: 'var(--font-serif)',
                }}
              >
                朱批
              </span>
              <span className="min-w-0 truncate">{quickReceipt}</span>
              <CommandCenterSourcePlaque label={commandCenterSourceLabel(taskRuns, currentTask)} />
            </div>
            <button
              type="button"
              onClick={() => setQuickReceipt(null)}
              className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#C6BB9D]"
            >
              知道了
            </button>
          </div>
        ) : null}
        <div className="mx-auto flex max-w-[1920px] items-center gap-3 py-2.5">
          <div className="hidden min-w-[210px] lg:block">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F0C66A]">Imperial Dispatch</div>
            <div className="mt-1 truncate text-[12px] text-[#C6BB9D]">
              {currentTask ? `当前案：${currentTask.title}` : '无真案 · 可直接下第一道密旨'}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#F0C66A]/24 bg-black/28 px-3 py-2">
            <button
              type="button"
              data-three-axis-primary-action
              onClick={() => void submitQuickCommand(currentTask ? `复核「${currentTask.title}」：请军机处收束阻塞、负责人、证据和下一步回奏。` : '立案会审：请军机处先把当前最急任务压成一件真案，拆出负责人、证据和下一步回奏。')}
              disabled={quickSubmitting}
              className="hidden shrink-0 rounded-lg border border-[#F0C66A]/36 bg-[#F0C66A]/10 px-3 py-2 text-[11px] font-bold text-[#F0C66A] transition hover:bg-[#F0C66A]/16 disabled:opacity-50 md:block"
            >
              {currentTask ? '复核本案' : '立案会审'}
            </button>
            <input
              data-command-center-quick-input
              value={quickCommand}
              onChange={(event) => setQuickCommand(event.target.value)}
              onFocus={focusCommandInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleQuickCommand();
              }}
              placeholder="向军机处下旨：请写清要会审的一件事..."
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#F5E9C9] outline-none placeholder:text-[#6A7299]"
            />
            <button
              type="button"
              onClick={() => void handleQuickCommand()}
              disabled={quickSubmitting}
              className="rounded-lg bg-gradient-to-br from-[#F0C66A] to-[#D4A84B] px-4 py-2 text-[11px] font-bold text-[#050812] transition disabled:opacity-50"
            >
              {quickSubmitting ? '传旨中' : '下旨'}
            </button>
          </div>
          <button
            type="button"
            onClick={focusCommandInput}
            className="hidden rounded-lg border border-white/10 px-3 py-2 text-[11px] text-[#C6BB9D] transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A] md:block"
          >
            展开拟旨
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
