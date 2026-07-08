/**
 * TaskHeroCard — 任务 Hero 卡
 *
 * 用于：朝堂总览的当前任务、指挥台的任务头部
 * 显示：title + rawCommand + 总进度 + 子任务统计 + 参与 Agent
 */

import { StatusChip } from '@/components/ui/status-chip';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AGENT_META } from '@/types/agent';
import type { Task, TaskStatus } from '@/types/task';
import type { AgentCode, AgentRun } from '@/types/agent';
import { executionModeInPlainWords } from '@/features/throne/lib/plain-language';

export interface TaskHeroCardProps {
  task: Task;
  /** 当前任务关联的 agent runs */
  runs?: AgentRun[];
  variant?: 'default' | 'hero';
  onOpen?: () => void;
}

const STATUS_TO_AGENT_STATE = (status: TaskStatus) => {
  if (status === 'running' || status === 'interpreting' || status === 'planning' || status === 'aggregating')
    return 'running' as const;
  if (status === 'assigned') return 'assigned' as const;
  if (status === 'report_ready') return 'summarizing' as const;
  if (status === 'reviewed') return 'completed' as const;
  if (status === 'archived') return 'archived' as const;
  return 'idle' as const;
};

export function TaskHeroCard({ task, runs = [], variant = 'default', onOpen }: TaskHeroCardProps) {
  const progressPct =
    runs.length > 0
      ? Math.round(runs.reduce((acc, r) => acc + r.progressPct, 0) / runs.length)
      : 0;

  const assignedAgents: AgentCode[] =
    task.plan?.assignedAgents ?? (runs.map((r) => r.agentCode) as AgentCode[]);
  const uniqueAgents = Array.from(new Set(assignedAgents));
  const riskCount = runs.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical').length;

  return (
    <GlassPanel
      variant={variant === 'hero' ? 'gold' : 'default'}
      tone="elevated"
      hudCorners={variant === 'hero'}
      padding="lg"
      className="h-full"
    >
      {/* 顶栏 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">当前密旨</div>
        <StatusChip state={STATUS_TO_AGENT_STATE(task.status)} size="sm" />
      </div>

      {/* 标题 */}
      <h2 className="text-[16px] font-bold leading-snug text-[#EAEEFB]">{task.title}</h2>

      {/* 密旨原文 */}
      {task.rawCommand && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#9AA3C4]">
          {task.rawCommand}
        </p>
      )}

      {/* 进度条 */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-[#6A7299]">总体进度</span>
          <span className="font-mono text-[#F0C66A]">{progressPct}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgba(26, 33, 66, 0.8)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #D4A84B, #F0C66A)',
              boxShadow: '0 0 12px rgba(240, 198, 106, 0.5)',
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div
        className="mt-4 grid grid-cols-3 gap-2 border-t pt-3"
        style={{ borderColor: 'rgba(26, 33, 66, 0.6)' }}
      >
        <Stat label="协同部门" value={uniqueAgents.length} />
        <Stat
          label="风险项"
          value={riskCount}
          accent={riskCount > 0 ? '#F5A524' : '#484F72'}
        />
        <Stat label="模式" value={executionModeInPlainWords(task.mode)} accent="#6BA0FF" />
      </div>

      {/* 参与 Agent 胶囊 */}
      {uniqueAgents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {uniqueAgents.slice(0, 8).map((code) => {
            const meta = AGENT_META[code];
            if (!meta) return null;
            return (
              <span
                key={code}
                className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px]"
                style={{
                  borderColor: `${meta.color}44`,
                  color: meta.color,
                }}
                title={meta.nameCn}
              >
                <span>{meta.emoji}</span>
                {meta.nameCn}
              </span>
            );
          })}
        </div>
      )}

      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-4 w-full rounded-md border py-1.5 text-[11px] transition-colors hover:bg-white/5"
          style={{
            borderColor: 'rgba(240, 198, 106, 0.4)',
            color: '#F0C66A',
          }}
        >
          查看详情
        </button>
      )}
    </GlassPanel>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-[#6A7299]">{label}</div>
      <div
        className="mt-0.5 font-mono text-sm font-semibold"
        style={{ color: accent ?? '#EAEEFB' }}
      >
        {value}
      </div>
    </div>
  );
}
