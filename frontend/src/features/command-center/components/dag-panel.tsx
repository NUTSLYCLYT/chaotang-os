'use client';

import { GitBranch } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AgentFlowGraph } from '@/components/graphs/agent-flow-graph';
import type { AgentFlowSubtask } from '@/components/graphs/agent-flow-graph';
import type { Task } from '@/types/task';
import type { AgentRun } from '@/types/agent';

export function DagPanel({ task, runs }: { task: Task; runs: AgentRun[] }) {
  const isPriority =
    task.status === 'assigned' ||
    task.status === 'running' ||
    task.status === 'aggregating';
  const subtasks: AgentFlowSubtask[] = Array.from(
    new Map(
      runs
        .filter((r) => r.taskId === task.id)
        .map((r) => [
          r.subtaskId,
          {
            id: r.subtaskId,
            description: r.currentTaskTitle ?? '',
            assignedAgent: r.agentCode,
            dependsOn: task.plan?.dependencyGraph?.[r.subtaskId] ?? [],
            priority: 1,
          },
        ]),
    ).values(),
  );

  return (
    <GlassPanel
      tone="elevated"
      padding="lg"
      hudCorners
      className={`h-full ${isPriority ? 'ring-1 ring-[#6BA0FF]/22' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-[#6BA0FF]" />
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">依赖图</div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span className="rounded-full border border-[#6BA0FF]/18 bg-[#6BA0FF]/10 px-2 py-0.5 text-[#6BA0FF]">
            {isPriority ? '当前重点' : '执行结构'}
          </span>
          <span className="flex items-center gap-1 text-[#3DD68C]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#3DD68C]" />
            依赖已满足
          </span>
          <span className="flex items-center gap-1 text-[#6A7299]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6A7299]" />
            等待中
          </span>
        </div>
      </div>

      <div
        className="relative h-[340px] overflow-auto rounded-md border"
        style={{
          borderColor: 'rgba(26, 33, 66, 0.6)',
          background:
            'radial-gradient(ellipse at center, rgba(74, 130, 240, 0.06), transparent 70%)',
        }}
      >
        {subtasks.length > 0 ? (
          <AgentFlowGraph subtasks={subtasks} runs={runs} />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-[#484F72]">
            无子任务运行数据
          </div>
        )}
      </div>

      <div className="mt-2 text-center text-[9px] text-[#484F72]">
        按 priority 分层 · 贝塞尔连线 · 状态同步进度
      </div>
    </GlassPanel>
  );
}
