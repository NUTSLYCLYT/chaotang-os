'use client';

import { useEffect } from 'react';
import { X, Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { StatusChip } from '@/components/ui/status-chip';
import { AGENT_META, getNodeDisplayName } from '@/types/agent';
import type { AgentRun } from '@/types/agent';

export interface AgentRunDrawerProps {
  run: AgentRun | null;
  onClose: () => void;
}

export function AgentRunDrawer({ run, onClose }: AgentRunDrawerProps) {
  // Esc to close
  useEffect(() => {
    if (!run) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [run, onClose]);

  const open = !!run;
  const meta = run ? AGENT_META[run.agentCode] : null;

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* drawer */}
      <aside
        role="dialog"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[460px] transform transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <GlassPanel
          tone="elevated"
          padding="none"
          className="flex h-full flex-col rounded-none border-l"
        >
          {run && meta && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-white/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="text-[28px] leading-none">{meta.emoji}</div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-[#6A7299]">
                      Agent Run · {run.id.slice(0, 10)}
                    </div>
                    <h2
                      className="mt-0.5 text-[16px] font-semibold"
                      style={{ color: meta.color }}
                    >
                      {meta.nameCn}
                    </h2>
                    <div className="mt-0.5 text-[10px] text-[#9AA3C4]">
                      {meta.tier} · {meta.nameEn}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1.5 text-[#6A7299] transition-colors hover:bg-white/5 hover:text-[#EAEEFB]"
                  aria-label="关闭"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {/* Status row */}
                <Section label="执行状态">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusChip state={run.state} size="md" />
                    {run.confidence !== undefined && (
                      <Metric
                        icon={<CheckCircle2 size={12} />}
                        label="信度"
                        value={`${(run.confidence * 100).toFixed(0)}%`}
                        color="#3DD68C"
                      />
                    )}
                    {run.progressPct !== undefined && (
                      <Metric
                        icon={<Activity size={12} />}
                        label="进度"
                        value={`${run.progressPct}%`}
                        color="#F0C66A"
                      />
                    )}
                    {run.riskLevel && (
                      <Metric
                        icon={<AlertTriangle size={12} />}
                        label="风险"
                        value={run.riskLevel}
                        color={
                          run.riskLevel === 'critical'
                            ? '#F43F5E'
                            : run.riskLevel === 'high'
                            ? '#F5A524'
                            : '#6BA0FF'
                        }
                      />
                    )}
                  </div>
                </Section>

                {/* Current task */}
                {run.currentTaskTitle && (
                  <Section label="当前子任务">
                    <div className="rounded-md border border-white/5 bg-black/20 p-3 text-[12px] leading-relaxed text-[#EAEEFB]">
                      {run.currentTaskTitle}
                    </div>
                  </Section>
                )}

                {(run.assignedNodeId || run.routingNodeIds?.length) && (
                  <Section label="节点链路">
                    <div className="rounded-md border border-white/5 bg-black/20 p-3">
                      {run.assignedNodeId && (
                        <div className="text-[11px] text-[#EAEEFB]">
                          当前承载节点：<span className="text-[#F0C66A]">{getNodeDisplayName(run.assignedNodeId)}</span>
                        </div>
                      )}
                      {run.routingNodeIds && run.routingNodeIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {run.routingNodeIds.map((nodeId) => (
                            <span
                              key={nodeId}
                              className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-2 py-0.5 text-[9px] text-[#D9C79A]"
                            >
                              {getNodeDisplayName(nodeId)}
                            </span>
                          ))}
                        </div>
                      )}
                      {run.nodeMaturity && (
                        <div className="mt-2 text-[10px] text-[#9AA3C4]">
                          节点成熟度：{run.nodeMaturity}
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Latest summary */}
                {run.latestSummary && (
                  <Section label="最新进展">
                    <div className="rounded-md border border-white/5 bg-black/20 p-3 text-[12px] leading-relaxed text-[#9AA3C4]">
                      {run.latestSummary}
                    </div>
                  </Section>
                )}

                {/* Timing */}
                <Section label="时间线">
                  <div className="space-y-2 text-[11px]">
                    <TimelineRow
                      icon={<Clock size={10} />}
                      label="启动"
                      value={
                        run.startedAt
                          ? new Date(run.startedAt).toLocaleString('zh-CN')
                          : '—'
                      }
                    />
                    <TimelineRow
                      icon={<CheckCircle2 size={10} />}
                      label="完成"
                      value={
                        run.completedAt
                          ? new Date(run.completedAt).toLocaleString('zh-CN')
                          : '执行中'
                      }
                    />
                  </div>
                </Section>

                {/* Baseline profile from meta */}
                <Section label="Agent 档案">
                  <div className="rounded-md border border-white/5 bg-black/20 p-3 text-[11px] leading-relaxed text-[#9AA3C4]">
                    {meta.description}
                  </div>
                  {meta.responsibilities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {meta.responsibilities.slice(0, 4).map((r) => (
                        <span
                          key={r}
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-[#9AA3C4]"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              <div className="border-t border-white/5 p-4">
                <div className="text-[9px] uppercase tracking-wider text-[#484F72]">
                  按 Esc 关闭
                </div>
              </div>
            </>
          )}
        </GlassPanel>
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[9px] uppercase tracking-wider text-[#6A7299]">{label}</div>
      {children}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]"
      style={{
        borderColor: `${color}40`,
        color,
        background: `${color}10`,
      }}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function TimelineRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[#9AA3C4]">
      <span className="text-[#6A7299]">{icon}</span>
      <span className="w-10 text-[#6A7299]">{label}</span>
      <span className="font-mono text-[#EAEEFB]">{value}</span>
    </div>
  );
}
