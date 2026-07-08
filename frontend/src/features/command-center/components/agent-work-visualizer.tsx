'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Eye,
  Loader2,
  Route,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import {
  AGENT_META,
  getNodeDisplayName,
  type AgentRun,
  type AgentState,
} from '@/types/agent';
import type { Task } from '@/types/task';

type AgentWorkLane = {
  key: 'queued' | 'running' | 'blocked' | 'done';
  title: string;
  subtitle: string;
  icon: typeof CircleDashed;
  states: AgentState[];
};

const LANES: AgentWorkLane[] = [
  {
    key: 'queued',
    title: '待命 / 等依赖',
    subtitle: '已分派但尚未产出',
    icon: CircleDashed,
    states: ['idle', 'assigned', 'waiting_dependency'],
  },
  {
    key: 'running',
    title: '正在办理',
    subtitle: '当前消耗算力与上下文',
    icon: Loader2,
    states: ['running', 'summarizing'],
  },
  {
    key: 'blocked',
    title: '阻塞告警',
    subtitle: '需要补充指令或改派',
    icon: AlertTriangle,
    states: ['failed'],
  },
  {
    key: 'done',
    title: '已交付 / 已归档',
    subtitle: '可进入复核与引用',
    icon: CheckCircle2,
    states: ['completed', 'fallback_completed', 'archived'],
  },
];

const STATE_LABELS: Record<AgentState, string> = {
  idle: '待命',
  assigned: '已分派',
  running: '执行中',
  waiting_dependency: '等依赖',
  summarizing: '收束中',
  completed: '已完成',
  failed: '阻塞',
  fallback_completed: '降级完成',
  archived: '已归档',
};

export function AgentWorkVisualizer({
  task,
  runs,
  onRunClick,
}: {
  task: Task;
  runs: AgentRun[];
  onRunClick: (run: AgentRun) => void;
}) {
  const assignedAgents = task.plan?.assignedAgents ?? [];
  const assignedNodeIds = task.plan?.assignedNodeIds ?? [];
  const plannedCount = Math.max(assignedAgents.length, assignedNodeIds.length, runs.length);
  const activeCount = runs.filter((run) => run.state === 'running' || run.state === 'summarizing').length;
  const blockedCount = runs.filter((run) => run.state === 'failed').length;
  const deliveredCount = runs.filter((run) =>
    run.state === 'completed' || run.state === 'fallback_completed' || run.state === 'archived'
  ).length;
  const evidenceCount = runs.filter((run) => run.hasReported || run.latestSummary).length;
  const sourceLabel = task.mode === 'live' ? '真实执行' : task.mode === 'hybrid' ? '混合执行' : '脚本演示';

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="section-eyebrow">Agent Work Map · 工作可视化</div>
          <div className="mt-2 text-[20px] font-semibold text-[#F5E9C9]">
            看清每个 agent 正在等什么、做什么、交付了什么。
          </div>
          <div className="mt-2 max-w-[78ch] text-[12px] leading-6 text-[#B6BDD5]">
            军机处只保留指挥视角：分派队列、执行态、阻塞、交付证据集中在一张图里。需要细节时再点开单个运行记录。
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[360px] sm:grid-cols-4">
          <AgentWorkMetric label="计划" value={plannedCount} />
          <AgentWorkMetric label="执行" value={activeCount} tone={activeCount > 0 ? 'active' : 'muted'} />
          <AgentWorkMetric label="阻塞" value={blockedCount} tone={blockedCount > 0 ? 'danger' : 'safe'} />
          <AgentWorkMetric label="证据" value={evidenceCount || deliveredCount} tone={evidenceCount > 0 ? 'safe' : 'muted'} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-3 py-1 text-[#F0C66A]">
          模式 · {sourceLabel}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[#9AA3C4]">
          案件 · {task.id}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[#9AA3C4]">
          状态 · {task.status}
        </span>
      </div>

      {runs.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-4">
          {LANES.map((lane) => (
            <AgentWorkLaneColumn
              key={lane.key}
              lane={lane}
              runs={runs.filter((run) => lane.states.includes(run.state))}
              onRunClick={onRunClick}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] px-4 py-5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#E8E2CE]">
              <Clock3 size={14} className="text-[#F0C66A]" />
              等待 agent 运行记录
            </div>
            <div className="mt-2 text-[12px] leading-6 text-[#98A1BC]">
              当前案件已有中枢任务，但还没有可展示的 agent run。等后端返回运行记录后，这里会自动分到四个工作泳道。
            </div>
          </div>
          <PlannedRoutePreview task={task} />
        </div>
      )}
    </GlassPanel>
  );
}

function AgentWorkLaneColumn({
  lane,
  runs,
  onRunClick,
}: {
  lane: AgentWorkLane;
  runs: AgentRun[];
  onRunClick: (run: AgentRun) => void;
}) {
  const Icon = lane.icon;
  const accent =
    lane.key === 'blocked'
      ? 'text-[#F58B8B]'
      : lane.key === 'done'
        ? 'text-[#3DD68C]'
        : lane.key === 'running'
          ? 'text-[#F0C66A]'
          : 'text-[#8AA4FF]';

  return (
    <div className="min-h-[220px] rounded-2xl border border-white/8 bg-[#090B12]/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#E8E2CE]">
            <Icon size={14} className={accent} />
            {lane.title}
          </div>
          <div className="mt-1 text-[10px] leading-5 text-[#6A7299]">{lane.subtitle}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-[#C8CDD8]">
          {runs.length}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {runs.length > 0 ? (
          runs.slice(0, 5).map((run) => (
            <AgentRunCard key={run.id} run={run} onClick={() => onRunClick(run)} />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[11px] leading-5 text-[#6A7299]">
            当前无 agent
          </div>
        )}
      </div>
    </div>
  );
}

function AgentRunCard({ run, onClick }: { run: AgentRun; onClick: () => void }) {
  const meta = AGENT_META[run.agentCode];
  const agentName = meta?.nameCn ?? run.agentCode;
  const nodeLabel = run.assignedNodeId ? getNodeDisplayName(run.assignedNodeId) : null;
  const progress = Math.max(0, Math.min(100, Math.round(run.progressPct ?? 0)));
  const riskTone =
    run.state === 'failed' || run.riskLevel === 'critical' || run.riskLevel === 'high'
      ? 'text-[#F58B8B]'
      : run.state === 'completed' || run.state === 'fallback_completed'
        ? 'text-[#3DD68C]'
        : 'text-[#F0C66A]';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-white/8 bg-white/[0.035] p-3 text-left transition hover:border-[#F0C66A]/28 hover:bg-[#F0C66A]/[0.045]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-[#F5E9C9]">{agentName}</div>
          <div className="mt-1 truncate text-[10px] text-[#6A7299]">
            {nodeLabel ? `节点 · ${nodeLabel}` : `子任务 · ${run.subtaskId}`}
          </div>
        </div>
        <div className={`shrink-0 text-[10px] font-medium ${riskTone}`}>
          {STATE_LABELS[run.state]}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-[#F0C66A]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#8E96AF]">
        <span>{progress}%</span>
        <span>{run.hasReported ? '有报告' : run.isWaitingDependency ? '等依赖' : '未回报'}</span>
      </div>
      {run.latestSummary ? (
        <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#B6BDD5]">
          {run.latestSummary}
        </div>
      ) : null}
      <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-[#F0C66A]">
        <Eye size={11} />
        查看运行详情
      </div>
    </button>
  );
}

function PlannedRoutePreview({ task }: { task: Task }) {
  const plannedAgents = task.plan?.assignedAgents ?? [];
  const plannedNodes = task.plan?.assignedNodeIds ?? [];

  return (
    <div className="rounded-2xl border border-[#F0C66A]/14 bg-[#F0C66A]/[0.04] px-4 py-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-[#E8E2CE]">
        <Route size={14} className="text-[#F0C66A]" />
        预定调度路线
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...plannedAgents, ...plannedNodes].slice(0, 10).map((id) => (
          <span
            key={id}
            className="rounded-full border border-[#F0C66A]/22 bg-[#F0C66A]/8 px-3 py-1 text-[10px] text-[#D9C79A]"
          >
            {getNodeDisplayName(id)}
          </span>
        ))}
        {plannedAgents.length === 0 && plannedNodes.length === 0 ? (
          <span className="text-[11px] leading-6 text-[#98A1BC]">
            当前还没有明确分派路线。先等待丞相完成拆解，或补充约束让中枢重新压清任务。
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AgentWorkMetric({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: number;
  tone?: 'active' | 'safe' | 'danger' | 'muted';
}) {
  const color =
    tone === 'danger'
      ? 'text-[#F58B8B]'
      : tone === 'safe'
        ? 'text-[#3DD68C]'
        : tone === 'active'
          ? 'text-[#F0C66A]'
          : 'text-[#D2D7E8]';

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#6A7299]">{label}</div>
      <div className={`mt-1 font-mono text-[18px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}
