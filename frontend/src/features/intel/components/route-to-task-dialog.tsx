'use client';

import { useEffect, useState } from 'react';
import { X, Send, CheckCircle2, Loader2, Hash } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { useAppStore } from '@/lib/store/app-store';
import { withBasePath } from '@/lib/base-path';
import { fetchLocalCourtApi } from '@/lib/jiqun-api';
import { AGENT_META } from '@/types/agent';
import type { AgentCode } from '@/types/agent';
import type { IntelSignal } from '@/types/intel';

const DISPATCH_TARGETS: AgentCode[] = [
  'bing_bu',
  'qin_tian_jian',
  'xing_bu',
  'li_bu_rites',
  'hu_bu',
  'gong_bu',
];

export interface RouteToTaskDialogProps {
  signal: IntelSignal | null;
  open: boolean;
  onClose: () => void;
}

type Phase = 'compose' | 'submitting' | 'done';

interface DispatchReceipt {
  taskId: string;
  sessionId?: string | null;
  sourceLabel: string;
  status: string;
  liveDispatchSkipped?: boolean;
  links?: {
    task?: string | null;
  };
}

interface DispatchEnvelope {
  success: boolean;
  data?: DispatchReceipt;
  error?: string;
  message?: string;
}

export function RouteToTaskDialog({ signal, open, onClose }: RouteToTaskDialogProps) {
  const setSignals = useAppStore((s) => s.setIntelSignals);
  const allSignals = useAppStore((s) => s.intelSignals);

  const [targets, setTargets] = useState<AgentCode[]>([]);
  const [note, setNote] = useState('');
  const [createTask, setCreateTask] = useState(true);
  const [phase, setPhase] = useState<Phase>('compose');
  const [receipt, setReceipt] = useState<DispatchReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setTargets([]);
      setNote('');
      setCreateTask(true);
      setPhase('compose');
      setReceipt(null);
      setErrorMessage(null);
    }
  }, [open, signal?.id]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'submitting') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, phase, onClose]);

  const toggleTarget = (code: AgentCode) => {
    setTargets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const submit = async () => {
    if (!signal || targets.length === 0) return;
    setPhase('submitting');
    setErrorMessage(null);
    try {
      const response = await fetchLocalCourtApi(`/api/court/intel/signals/${encodeURIComponent(signal.id)}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAgents: targets,
          note,
          createTask,
          mode: 'live',
        }),
      });
      const envelope = (await response.json().catch(() => null)) as DispatchEnvelope | null;
      if (!response.ok || !envelope?.success || !envelope.data) {
        throw new Error(envelope?.message || envelope?.error || `${response.status} ${response.statusText}`);
      }

      const existing = new Set(signal.routedTo ?? []);
      targets.forEach((t) => existing.add(t));
      const next = allSignals.map((s) =>
        s.id === signal.id ? { ...s, routedTo: Array.from(existing) } : s,
      );
      setSignals(next);
      setReceipt(envelope.data);
      setPhase('done');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'dispatch_failed');
      setPhase('compose');
    }
  };

  if (!open || !signal) return null;

  const alreadyRouted = new Set(signal.routedTo ?? []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[240] flex items-center justify-center p-4"
    >
      <div
        onClick={() => phase !== 'submitting' && onClose()}
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <GlassPanel
        tone="elevated"
        padding="none"
        className="relative z-10 flex w-full max-w-[520px] flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/5 p-5">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#6A7299]">转派旨令</div>
            <h2 className="mt-1 line-clamp-2 text-[14px] font-semibold text-[#F0C66A]">
              {signal.title}
            </h2>
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[#6A7299]">
              <Hash size={10} />
              <span className="font-mono">{signal.id}</span>
              <span>·</span>
              <span>{signal.regionLabel}</span>
              <span>·</span>
              <span className="uppercase">{signal.level}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'submitting'}
            className="rounded-md p-1.5 text-[#6A7299] transition-colors hover:bg-white/5 hover:text-[#EAEEFB] disabled:opacity-40"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {/* Summary */}
          <p className="rounded-md border border-white/5 bg-black/20 p-3 text-[11px] leading-relaxed text-[#9AA3C4]">
            {signal.summary}
          </p>

          {/* Target selection */}
          <div>
            <div className="mb-2 text-[9px] uppercase tracking-wider text-[#6A7299]">
              选择承办部门 · 可多选
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DISPATCH_TARGETS.map((code) => {
                const meta = AGENT_META[code];
                const isAlready = alreadyRouted.has(code);
                const isSelected = targets.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={isAlready || phase !== 'compose'}
                    onClick={() => toggleTarget(code)}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-left text-[11px] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: isSelected
                        ? meta.color
                        : isAlready
                        ? `${meta.color}40`
                        : 'rgba(255,255,255,0.08)',
                      background: isSelected
                        ? `${meta.color}15`
                        : isAlready
                        ? `${meta.color}08`
                        : 'transparent',
                    }}
                  >
                    <span className="text-base leading-none">{meta.emoji}</span>
                    <span
                      className="flex-1 font-medium"
                      style={{ color: isSelected || isAlready ? meta.color : '#EAEEFB' }}
                    >
                      {meta.nameCn}
                    </span>
                    {isAlready && (
                      <span
                        className="text-[8px] uppercase tracking-wider"
                        style={{ color: meta.color }}
                      >
                        已转派
                      </span>
                    )}
                    {isSelected && !isAlready && (
                      <CheckCircle2 size={12} style={{ color: meta.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-wider text-[#6A7299]">
              附言（可选）
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={phase !== 'compose'}
              rows={2}
              placeholder="例：请优先核查近 72 小时同源信号..."
              className="w-full resize-none rounded-md border border-white/10 bg-black/20 p-2.5 text-[11px] text-[#EAEEFB] outline-none transition-colors placeholder:text-[#484F72] focus:border-[#F0C66A]/40 disabled:opacity-60"
            />
          </div>

          {/* Create-task toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#9AA3C4]">
            <input
              type="checkbox"
              checked={createTask}
              onChange={() => setCreateTask(true)}
              disabled
              className="h-3.5 w-3.5 accent-[#F0C66A]"
            />
            同时在指挥台创建关联任务
          </label>

          {errorMessage && (
            <div className="rounded-md border border-[#E25555]/30 bg-[#E25555]/10 p-3 text-[11px] leading-relaxed text-[#FFB4B4]">
              {errorMessage}
            </div>
          )}

          {receipt && (
            <div className="rounded-md border border-[#3DD68C]/25 bg-[#3DD68C]/10 p-3 text-[11px] leading-relaxed text-[#BFF3D6]">
              <div className="font-mono text-[10px] text-[#3DD68C]">
                task={receipt.taskId}
              </div>
              <div className="mt-1 text-[#9AA3C4]">
                {receipt.liveDispatchSkipped
                  ? 'FALLBACK signal: evidence task created, live swarm not dispatched.'
                  : `source=${receipt.sourceLabel}${receipt.sessionId ? ` / session=${receipt.sessionId}` : ''}`}
              </div>
              {receipt.links?.task && (
                <a
                  href={withBasePath(receipt.links.task)}
                  className="mt-2 inline-flex text-[10px] font-semibold text-[#F0C66A] hover:text-[#FFE2A0]"
                >
                  View linked task
                </a>
              )}
              {targets.includes('hu_bu') && (
                <a
                  href={withBasePath(`/departments/finance?taskId=${encodeURIComponent(receipt.taskId)}`)}
                  className="ml-3 mt-2 inline-flex text-[10px] font-semibold text-[#F0C66A] hover:text-[#FFE2A0]"
                >
                  去户部测算
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 p-4">
          <div className="text-[10px] text-[#6A7299]">
            {phase === 'done' ? (
              <span className="flex items-center gap-1.5 text-[#3DD68C]">
                <CheckCircle2 size={12} />
                转派已记录
              </span>
            ) : targets.length > 0 ? (
              `将转派 ${targets.length} 个部门`
            ) : (
              '请选择至少一个承办部门'
            )}
          </div>
          <button
            type="button"
            onClick={phase === 'done' ? onClose : submit}
            disabled={phase === 'submitting' || (phase === 'compose' && targets.length === 0)}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, #F0C66A, #D4A84B)',
              color: '#04060E',
            }}
          >
            {phase === 'submitting' ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                转派中
              </>
            ) : phase === 'done' ? (
              <>
                <CheckCircle2 size={12} />
                已完成
              </>
            ) : (
              <>
                <Send size={12} />
                下达转派
              </>
            )}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
