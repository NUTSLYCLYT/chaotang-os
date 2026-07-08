'use client';

import { GitBranch } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { StatusChip } from '@/components/ui/status-chip';
import { AGENT_META, getNodeDisplayName } from '@/types/agent';
import type { AgentCode, AgentRun } from '@/types/agent';

export interface SubtaskTreeProps {
  assignedAgents: AgentCode[];
  assignedNodeIds?: string[];
  runs: AgentRun[];
  onSelect?: (run: AgentRun) => void;
}

export function SubtaskTree({ assignedAgents, assignedNodeIds = [], runs, onSelect }: SubtaskTreeProps) {
  const nodeIds = assignedNodeIds.length > 0 ? assignedNodeIds : assignedAgents;
  const activeCount = runs.filter((run) => run.state === 'running').length;
  const waitingCount = runs.filter((run) => run.state === 'waiting_dependency').length;
  const isPriority = activeCount > 0 || waitingCount > 0;

  if (nodeIds.length === 0) {
    return (
      <GlassPanel tone="flat" padding="lg">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#6A7299]">
          <GitBranch size={13} className="text-[#6BA0FF]" />
          Subtask Tree
        </div>
        <div className="mt-3 text-[11px] text-[#484F72]">
          尚未分派 — 等待丞相拆解
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      tone="elevated"
      padding="lg"
      hudCorners={isPriority}
      className={isPriority ? 'ring-1 ring-[#6BA0FF]/18' : undefined}
    >
      <div className="mb-3 flex items-center gap-2">
        <GitBranch size={13} className="text-[#6BA0FF]" />
        <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
          Subtask Tree
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-medium text-[#EAEEFB]">
          子任务树 · {nodeIds.length} 路协同
        </h3>
        <div className="rounded-full border border-[#6BA0FF]/18 bg-[#6BA0FF]/10 px-3 py-1 text-[10px] text-[#6BA0FF]">
          {isPriority ? '当前重点' : '协同分派'}
        </div>
      </div>

      <div className="space-y-2">
        {nodeIds.map((nodeId, i) => {
          const run = runs.find((r) => r.assignedNodeId === nodeId || r.routingNodeIds?.includes(nodeId));
          const meta = AGENT_META[nodeId as AgentCode];
          return (
            <button
              key={nodeId}
              type="button"
              onClick={() => run && onSelect?.(run)}
              disabled={!run}
              className="flex w-full items-center gap-3 rounded-md border p-2.5 text-left transition-colors enabled:hover:bg-white/[0.03] disabled:cursor-default"
              style={{ borderColor: 'rgba(26, 33, 66, 0.8)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-[#484F72]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-base">{meta?.emoji ?? '◈'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[12px] font-medium"
                  style={{ color: meta?.color ?? '#F0C66A' }}
                >
                  {getNodeDisplayName(nodeId)}
                </div>
                <div className="line-clamp-1 text-[10px] text-[#9AA3C4]">
                  {run?.currentTaskTitle ?? '待接收子任务'}
                </div>
              </div>
              <StatusChip state={run?.state ?? 'idle'} size="sm" />
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}
