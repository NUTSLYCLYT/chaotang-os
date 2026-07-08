'use client';

import { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AGENT_META, getNodeDisplayName } from '@/types/agent';
import type { AgentRun } from '@/types/agent';

export interface ExecutionLogStreamProps {
  runs: AgentRun[];
  onRunClick?: (run: AgentRun) => void;
}

export function ExecutionLogStream({ runs, onRunClick }: ExecutionLogStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const hasLive = runs.some((run) => run.state === 'running');
  const hasRisk = runs.some((run) => run.state === 'failed');

  // Auto-scroll unless user scrolled up
  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [runs.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  };

  return (
    <GlassPanel
      tone="flat"
      padding="md"
      hudCorners={hasLive || hasRisk}
      className={hasLive || hasRisk ? 'ring-1 ring-[#3DD68C]/18' : undefined}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-[#3DD68C]" />
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Execution Log Stream
          </div>
          {hasLive ? (
            <span className="text-[9px] text-[#3DD68C]">● 实时执行</span>
          ) : runs.length > 0 ? (
            <span className="text-[9px] text-[#484F72]">○ 静态回看</span>
          ) : (
            <span className="text-[9px] text-[#484F72]">○ 等待执行</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px]">
          <span className={`${hasRisk ? 'text-[#F58B8B]' : hasLive ? 'text-[#3DD68C]' : 'text-[#484F72]'}`}>
            {hasRisk ? '存在异常' : hasLive ? '当前重点' : '静态回看'}
          </span>
          <span className="text-[#484F72]">{runs.length} 条记录</span>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[220px] space-y-1 overflow-y-auto rounded-md border p-3"
        style={{
          borderColor: 'rgba(26, 33, 66, 0.6)',
          backgroundColor: 'rgba(4, 6, 14, 0.5)',
        }}
      >
        {runs.length === 0 ? (
          <div className="py-8 text-center text-[10px] text-[#484F72]">
            等待执行记录...
          </div>
        ) : (
          runs.map((run) => {
            const meta = AGENT_META[run.agentCode];
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onRunClick?.(run)}
                className="flex w-full items-start gap-3 rounded px-1 py-0.5 text-left font-mono text-[11px] transition-colors hover:bg-white/[0.03]"
              >
                <span className="w-14 shrink-0 text-[#484F72]">
                  {run.startedAt
                    ? new Date(run.startedAt).toLocaleTimeString('zh-CN')
                    : '--:--:--'}
                </span>
                <span
                  className="w-16 shrink-0 text-center text-[9px] font-semibold"
                  style={{ color: meta.color }}
                >
                  [{meta.nameCn}]
                </span>
                <span className="flex-1 text-[#9AA3C4]">
                  <span>{run.latestSummary ?? run.currentTaskTitle ?? '等待任务...'}</span>
                  {run.assignedNodeId && run.assignedNodeId !== run.agentCode && (
                    <span className="ml-2 text-[9px] text-[#D9C79A]">
                      → {getNodeDisplayName(run.assignedNodeId)}
                    </span>
                  )}
                </span>
                {run.confidence !== undefined && (
                  <span className="text-[9px] text-[#6A7299]">
                    conf:{(run.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </button>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </GlassPanel>
  );
}
