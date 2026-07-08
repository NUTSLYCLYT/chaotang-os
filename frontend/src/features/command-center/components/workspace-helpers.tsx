'use client';

import Link from 'next/link';
import { ChevronRight, Radar, ScrollText } from 'lucide-react';
import { getNodeDisplayName, type AgentRun } from '@/types/agent';
import type { Task } from '@/types/task';
import { GlassPanel } from '@/components/ui/glass-panel';
import { executionModeInPlainWords } from '@/features/throne/lib/plain-language';

export type CommandCenterStage = 'decomposition' | 'execution' | 'review' | 'complete';

export function deriveCommandCenterStage(task: Task | null): CommandCenterStage {
  if (!task) return 'decomposition';
  if (task.status === 'report_ready') return 'review';
  if (task.status === 'reviewed' || task.status === 'archived') return 'complete';
  if (task.status === 'running' || task.status === 'aggregating' || task.status === 'assigned') {
    return 'execution';
  }
  return 'decomposition';
}

export function SoftErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners className="border-[#F5A524]/20 bg-[#F5A524]/[0.05]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">取数波动</div>
          <div className="mt-2 text-[13px] leading-6 text-[#D9CFB4]">
            中枢仍保留当前案件与工作区，刚才有一段背景取数未完成：{message}
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[#F5A524]/30 bg-[#F5A524]/10 px-3 py-2 text-[11px] text-[#F5A524] transition hover:bg-[#F5A524]/16"
        >
          重试取数
        </button>
      </div>
    </GlassPanel>
  );
}

export function PrimeMinisterMemoCard({
  currentTask,
  taskRuns,
}: {
  currentTask: Task | null;
  taskRuns: AgentRun[];
}) {
  const assignedCount = currentTask?.plan?.assignedAgents?.length ?? 0;
  const assignedNodeCount = currentTask?.plan?.assignedNodeIds?.length ?? 0;
  const runningCount = taskRuns.filter((r) => r.state === 'running').length;
  const completedCount = taskRuns.filter(
    (r) => r.state === 'completed' || r.state === 'fallback_completed',
  ).length;

  const summary = !currentTask
    ? '当前尚无密旨。先写下一句话，让丞相开始拆解。'
    : currentTask.status === 'report_ready'
      ? '此案已进入呈报态。重点不再是继续执行，而是尽快形成批示。'
      : currentTask.status === 'reviewed'
        ? '此案已获批示，后续应转入复盘台和执行追踪，不必再在此停留。'
        : currentTask.status === 'running' || currentTask.status === 'aggregating'
          ? '此案正在办理。现阶段最重要的是看部门是否卡住，而不是重新下达命令。'
          : '此案仍在丞相研判与分派阶段，重点是确认拆解是否清楚、是否需要补充指令。';

  const nextStep = !currentTask
    ? '下一步：输入一句真正要做的事，丞相会自动生成任务树。'
    : currentTask.status === 'report_ready'
      ? '下一步：进入御前简报，做最后批示。'
      : currentTask.status === 'running' || currentTask.status === 'aggregating'
        ? '下一步：查看执行流和 DAG，确认是否有节点阻塞。'
        : '下一步：检查拆解、依赖图与待分派部门，再决定是否追加约束。';

  return (
    <div className="mb-5">
      <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.28fr_0.72fr]">
          <div>
            <div className="section-eyebrow">丞相批注</div>
            <div className="mt-2 max-w-[68ch] text-[13px] leading-6 text-[#E3E7F5]">{summary}</div>
            <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[12px] leading-6 text-[#C8CDD8]">
              下一步：{nextStep.replace(/^下一步：/, '')}
            </div>
            {assignedNodeCount > 0 && (
              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#6A7299]">节点去向</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentTask?.plan?.assignedNodeIds?.map((nodeId) => (
                    <span
                      key={nodeId}
                      className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-3 py-1 text-[10px] text-[#D9C79A]"
                    >
                      {getNodeDisplayName(nodeId)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <DirectiveDraftCard currentTask={currentTask} taskRuns={taskRuns} />
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">批注摘要</div>
            <div className="mt-3 space-y-2">
              <CompactMetric label="已分派" value={assignedCount} />
              <CompactMetric label="节点数" value={assignedNodeCount || assignedCount} />
              <CompactMetric label="执行中" value={runningCount} />
              <CompactMetric label="已完成" value={completedCount} />
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function DirectiveDraftCard({
  currentTask,
  taskRuns,
}: {
  currentTask: Task | null;
  taskRuns: AgentRun[];
}) {
  const route = deriveDirectiveRoute(currentTask, taskRuns);
  const checks = deriveDirectiveChecks(currentTask, taskRuns);
  const title = currentTask ? `${route.title} · ${currentTask.title}` : '送治理流批示卡';

  return (
    <div className="mt-4 rounded-xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.04] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">拟定去向</div>
      <div className="mt-2 text-[13px] font-semibold leading-6 text-[#F5E9C9]">{title}</div>
      <div className="mt-2 text-[11px] leading-6 text-[#D9CFB4]">{route.body}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {checks.map((check) => (
          <span
            key={check.label}
            className={[
              'rounded-full border px-3 py-1 text-[10px]',
              check.done
                ? 'border-[#3DD68C]/25 bg-[#3DD68C]/10 text-[#8BE4B4]'
                : 'border-[#F5A524]/25 bg-[#F5A524]/10 text-[#F5C56A]',
            ].join(' ')}
          >
            {check.label} · {check.done ? '已具备' : '待补足'}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={route.primaryHref}
          className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-3 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
        >
          {route.primaryLabel}
        </Link>
        <Link
          href={route.secondaryHref}
          className="rounded-full border border-white/10 px-3 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
        >
          {route.secondaryLabel}
        </Link>
      </div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6A7299]">{label}</div>
      <div className="gold-text text-[18px] font-semibold">{value}</div>
    </div>
  );
}

export function FirstActionStrip({
  currentTask,
  route,
}: {
  currentTask: Task | null;
  route: { title: string; body: string; href: string; cta: string };
}) {
  const stripTitle = !currentTask
    ? '先在这里下第一道密旨，不必先翻下面的工作区。'
    : `当前主案是「${currentTask.title}」，先看去向，再决定是否补发新旨。`;

  const stripBody = !currentTask
    ? '军机处的第一步不是看日志，而是先写清你真正要处理的事。任务一旦立案，下面的案件、信号和裁断区会自动跟上。'
    : '你现在最值钱的动作只有两个：继续压清当前主案，或者用一条新密旨开下一案。别在第一屏就被中段细节拖走。';

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners className="mb-5">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div>
          <div className="section-eyebrow">第一动作</div>
          <div className="mt-2 text-[18px] font-semibold text-[#F5E9C9]">{stripTitle}</div>
          <div className="mt-3 max-w-[72ch] text-[12px] leading-6 text-[#B6BDD5]">{stripBody}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-2xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.05] px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">当前去向</div>
            <div className="mt-2 text-[14px] font-semibold text-[#F5E9C9]">{route.title}</div>
          </div>
          <Link
            href={route.href}
            className="rounded-2xl border border-[#F0C66A]/22 bg-[#0D111C]/70 px-4 py-4 transition hover:border-[#F0C66A]/35 hover:bg-[#111626]"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">建议动作</div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#F0C66A]">
              {route.cta}
              <ChevronRight size={13} />
            </div>
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}

export function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/10 px-3 py-2 text-center text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
    >
      {label}
    </Link>
  );
}

export function StagePriorityCard({
  task,
  runs,
  route,
}: {
  task: Task;
  runs: AgentRun[];
  route: { title: string; body: string; href: string; cta: string };
}) {
  const stage = deriveCommandCenterStage(task);
  const runningCount = runs.filter((run) => run.state === 'running').length;
  const blockedCount = runs.filter((run) => run.state === 'failed').length;

  const content =
    stage === 'decomposition'
      ? {
          title: '当前先看拆解，不要急着盯日志。',
          focus: '先确认 intent、任务类型、依赖关系和分派对象是否合理。拆解错了，后面的 DAG 再漂亮也只是错得更快。',
          avoid: '暂时不要把注意力放在执行流和御批上。案件还没压清，过早裁断会把坏结构直接送下去。',
        }
      : stage === 'execution'
        ? {
            title: '当前先盯推进与阻塞，不要重新定义问题。',
            focus: `现在有 ${runningCount} 路正在推进${blockedCount > 0 ? `，并有 ${blockedCount} 处阻塞` : ''}。重点是看节点状态、执行日志和是否需要改派。`,
            avoid: '不要反复改写最初命题，也不要把中枢变回讨论会。执行阶段最怕的是边做边改方向。',
          }
        : stage === 'review'
          ? {
              title: '当前先做裁断，不要继续堆分析。',
              focus: '材料已经收拢成呈报。此时中枢最值钱的动作是确认是否足以批示，以及应该送治理还是直接下发执行。',
              avoid: '不要因为信息还可以更多就无限等待。待裁断阶段拖太久，会让整个系统重新掉回分析泥潭。',
            }
          : {
              title: '当前案件已离开中枢，先去后续层。',
              focus: '军机处此时只保留追溯价值。更合理的动作是去复盘台沉淀经验，或去执行层追踪回写。',
              avoid: '不要把已结案的任务继续留在军机处反复阅读，这会冲淡中枢对当前案件的注意力。',
            };

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="section-eyebrow">当前优先级</div>
          <div className="mt-2 text-[20px] font-semibold text-[#F5E9C9]">{content.title}</div>
          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] leading-7 text-[#D3D8E8]">
            {content.focus}
          </div>
          <div className="mt-3 rounded-2xl border border-[#6A7299]/20 bg-[#0D111C]/70 px-4 py-4 text-[12px] leading-7 text-[#98A1BC]">
            不要做：{content.avoid}
          </div>
        </div>
        <div className="rounded-3xl border border-[#F0C66A]/12 bg-[#0B0C12]/70 p-5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">推荐去向</div>
          <div className="mt-3 text-[18px] font-semibold text-[#F5E9C9]">{route.title}</div>
          <div className="mt-2 text-[12px] leading-6 text-[#B6BDD5]">{route.body}</div>
          <Link
            href={route.href}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/12 px-3 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
          >
            {route.cta}
            <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}

export function deriveCenterTopline(task: Task | null, runs: AgentRun[]) {
  if (!task) {
    return {
      title: '当前还没有正式案件进入军机处。',
      body: '先给出一句真正要处理的事。军机处的价值不在于闲聊，而在于把模糊命题压成正式任务、正式去向和正式责任。',
    };
  }

  const blockedCount = runs.filter((run) => run.state === 'failed').length;
  const completedCount = runs.filter(
    (run) => run.state === 'completed' || run.state === 'fallback_completed',
  ).length;

  if (task.status === 'report_ready') {
    return {
      title: '此案分析已足够，当前重点是尽快形成裁断。',
      body: '继续追加中枢分析的收益已经很低。更合理的动作是把呈报送进治理流，或者确认可以直接下放到执行层。',
    };
  }

  if (task.status === 'reviewed' || task.status === 'archived') {
    return {
      title: '此案已离开军机处，当前应转向沉淀或追踪。',
      body: '中枢职责已完成。后续重点不在这里继续分析，而是去复盘台沉淀经验，或去庄园追踪执行回写。',
    };
  }

  if (blockedCount > 0) {
    return {
      title: `当前已出现 ${blockedCount} 处关键阻塞，中枢要先解卡点。`,
      body: '这不是继续补更多说明的时候。现在应先确认是补充约束、改派节点，还是直接送治理层拍板。',
    };
  }

  if (task.status === 'running' || task.status === 'aggregating' || task.status === 'assigned') {
    return {
      title: '当前案件已进入推进态，中枢重点是看执行面是否偏航。',
      body: `目前已有 ${completedCount} 路执行收回结果。下一步要看 DAG、日志和节点状态，确保没有部门空转，也没有路径失真。`,
    };
  }

  return {
    title: '当前案件仍在压缩问题与拆解边界。',
    body: '军机处现在最重要的是把任务定义、依赖关系和分派边界压清楚。只要边界不清，就不能急着送治理，也不能直接丢给执行层。',
  };
}

export function deriveRouteRecommendation(task: Task | null, runs: AgentRun[]) {
  if (!task) {
    return {
      title: '先写密旨',
      body: '当前没有正式案件。先输入一句真正要处理的事，让中枢生成任务和去向。',
      href: '/command-center#command-input',
      cta: '先写一条密旨',
    };
  }

  const blocked = runs.some((run) => run.state === 'failed');

  if (task.status === 'report_ready') {
    return {
      title: '送入三省裁断',
      body: '材料已经够了，现在更需要批示、定边界和确认去向。',
      href: '/governance',
      cta: '进入三省审议台',
    };
  }

  if (task.status === 'reviewed' || task.status === 'archived') {
    return {
      title: '离开军机处，转沉淀层',
      body: '此案在中枢已经结案，更适合去复盘台看复盘与长期记忆。',
      href: '/scribe',
      cta: '转入复盘台',
    };
  }

  if (blocked) {
    return {
      title: '先去执行面定位阻塞',
      body: '当前已有实际卡点。先确认执行层发生了什么，再决定是否把案子抬回治理层。',
      href: '/manors',
      cta: '查看庄园推进',
    };
  }

  if (task.status === 'running' || task.status === 'aggregating' || task.status === 'assigned') {
    return {
      title: '继续盯执行与回写',
      body: '案件已进入推进阶段，中枢此时最该关心的是阻塞、偏差和结果回收。',
      href: '/manors',
      cta: '去执行层追踪',
    };
  }

  return {
    title: '继续留在军机处压清拆解',
    body: '当前案件还没有到分流时机，先把任务边界、依赖关系和节奏压稳。',
    href: '/command-center',
    cta: '留在军机处',
  };
}

export function CurrentCaseCard({
  currentTask,
  taskRuns,
  spotlight = false,
}: {
  currentTask: Task | null;
  taskRuns: AgentRun[];
  spotlight?: boolean;
}) {
  const pendingSubtasks =
    currentTask?.subtasks?.filter((subtask) => subtask.progressPct < 100).length ?? 0;

  return (
    <GlassPanel
      variant="gold"
      tone="elevated"
      padding="md"
      hudCorners
      className={spotlight ? 'ring-1 ring-[#6BA0FF]/35 shadow-[0_0_28px_rgba(107,160,255,0.12)]' : undefined}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
        <ScrollText size={12} className="text-[#F0C66A]" />
        当前案件
        {spotlight ? (
          <span className="rounded-full border border-[#6BA0FF]/35 bg-[#6BA0FF]/10 px-2 py-0.5 text-[9px] tracking-[0.12em] text-[#8AA4FF]">
            刚立案
          </span>
        ) : null}
      </div>
      {!currentTask ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-[13px] leading-7 text-[#AEB6CF]">
          当前还没有正式案件。先写一条密旨，让军机处把问题压成任务与路线。
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[18px] font-semibold leading-7 text-[#F5E9C9]">{currentTask.title}</div>
              <div className="mt-2 max-w-[66ch] text-[12px] leading-6 text-[#B6BDD5]">
                {currentTask.description ?? currentTask.rawCommand ?? '当前案件已进入军机处，但尚无补充说明。'}
              </div>
            </div>
            <div className="rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-3 py-1 text-[10px] text-[#F0C66A]">
              {deriveTaskStatusLine(currentTask.status)}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <CaseFact label="案件编号" value={currentTask.id} />
            <CaseFact label="模式" value={executionModeInPlainWords(currentTask.mode)} />
            <CaseFact label="未结子任务" value={String(pendingSubtasks)} />
            <CaseFact label="运行记录" value={String(taskRuns.length)} />
          </div>
        </>
      )}
    </GlassPanel>
  );
}

export function CommandSignalCard({
  currentTask,
  taskRuns,
  route,
}: {
  currentTask: Task | null;
  taskRuns: AgentRun[];
  route: { title: string; body: string; href: string; cta: string };
}) {
  const completedCount = taskRuns.filter(
    (run) => run.state === 'completed' || run.state === 'fallback_completed',
  ).length;
  const blockedCount = taskRuns.filter((run) => run.state === 'failed').length;
  const runningCount = taskRuns.filter((run) => run.state === 'running').length;

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#8F835F]">
        <Radar size={12} className="text-[#F0C66A]" />
        中枢信号台
      </div>
      <div className="mt-3 text-[15px] font-semibold text-[#F5E9C9]">当前脉搏</div>
      <div className="mt-2 text-[12px] leading-6 text-[#B6BDD5]">
        {currentTask
          ? '这里只看运行态、回收结果和阻塞，不重复解释案件本身。'
          : '还没有案件时，这里只保留最轻的运行摘要。'}
      </div>
      <div className="mt-4 space-y-2">
        <SignalRow label="执行中" value={`${runningCount} 路`} emphasis={runningCount > 0 ? 'active' : 'muted'} />
        <SignalRow label="已回收结果" value={`${completedCount} 路`} emphasis={completedCount > 0 ? 'active' : 'muted'} />
        <SignalRow label="阻塞告警" value={blockedCount > 0 ? `${blockedCount} 处` : '无'} emphasis={blockedCount > 0 ? 'danger' : 'safe'} />
        <SignalRow label="当前状态" value={currentTask ? deriveTaskStatusLine(currentTask.status) : '尚无案件'} emphasis="muted" />
      </div>
      <div className="mt-4 rounded-xl border border-white/8 bg-black/15 px-4 py-3 text-[11px] leading-6 text-[#C8CDD8]">
        当前建议：{route.cta}
      </div>
    </GlassPanel>
  );
}

function CaseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[#6A7299]">{label}</span>
      <span className="ml-2 text-[11px] font-medium text-[#E8E2CE]">{value}</span>
    </div>
  );
}

function SignalRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis: 'active' | 'danger' | 'safe' | 'muted';
}) {
  const color =
    emphasis === 'danger'
      ? 'text-[#F58B8B]'
      : emphasis === 'safe'
        ? 'text-[#3DD68C]'
        : emphasis === 'active'
          ? 'text-[#F0C66A]'
          : 'text-[#D2D7E8]';

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-[#6A7299]">{label}</div>
      <div className={`text-[12px] font-medium ${color}`}>{value}</div>
    </div>
  );
}

function deriveTaskStatusLine(status: Task['status']) {
  switch (status) {
    case 'draft':
      return '草拟中';
    case 'submitted':
      return '已提交';
    case 'interpreting':
      return '理解中';
    case 'planning':
      return '筹划中';
    case 'assigned':
      return '已分派';
    case 'running':
      return '执行中';
    case 'aggregating':
      return '收束中';
    case 'report_ready':
      return '待裁断';
    case 'reviewed':
      return '已批示';
    case 'archived':
      return '已归档';
    default:
      return status;
  }
}

function deriveDirectiveChecks(task: Task | null, runs: AgentRun[]) {
  const assignedReady = Boolean(task?.plan?.assignedAgents?.length || task?.plan?.assignedNodeIds?.length);
  const reportReady = task?.status === 'report_ready' || task?.status === 'reviewed' || task?.status === 'archived';
  const executionSignals = runs.length > 0;

  return [
    { label: '任务边界与分派对象已明确', done: assignedReady },
    { label: '已有可供裁断的结果或呈报', done: reportReady || executionSignals },
    { label: '案件去向已能在治理与执行间做出选择', done: reportReady || assignedReady },
  ];
}

function deriveDirectiveRoute(task: Task | null, runs: AgentRun[]) {
  if (!task) {
    return {
      title: '暂无法起草去向',
      body: '当前还没有正式案件进入军机处。先下达密旨，丞相完成初判后，这里才会生成正式送达建议。',
      primaryHref: '/command-center#command-input',
      primaryLabel: '先写一条密旨',
      secondaryHref: '/overview',
      secondaryLabel: '回大殿看总局',
    };
  }

  const blocked = runs.some((run) => run.state === 'failed');
  const reviewReady = task.status === 'report_ready' || task.status === 'reviewed';

  if (reviewReady) {
    return {
      title: '建议送治理流裁断',
      body: '当前案件已经具备正式批示条件。下一步最值钱的动作不是继续分析，而是进入三省做最后裁断与下发。',
      primaryHref: '/governance',
      primaryLabel: '送入三省治理流',
      secondaryHref: '/manors',
      secondaryLabel: '如无需制度动作则去庄园',
    };
  }

  if (blocked || task.status === 'running' || task.status === 'aggregating' || task.status === 'assigned') {
    return {
      title: '建议先送执行层承接',
      body: '当前案件更像推进问题，而不是制度问题。先去庄园确认阻塞、推进与回写，再决定是否要抬回治理层。',
      primaryHref: '/manors',
      primaryLabel: '先去庄园推进',
      secondaryHref: '/governance',
      secondaryLabel: '若需拍板再送三省',
    };
  }

  return {
    title: '暂留军机处继续压清',
    body: '当前更重要的是把任务边界、依赖关系和分派对象压清楚。太早送治理或执行，都会把不稳定的问题下放出去。',
    primaryHref: '/command-center',
    primaryLabel: '继续留在军机处',
    secondaryHref: '/overview',
    secondaryLabel: '回大殿重看判断',
  };
}
