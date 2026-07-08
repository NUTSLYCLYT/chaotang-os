/**
 * 朝堂 OS · 御前决策台
 *
 * 把 /overview 从 dashboard 升级为真·决策台：
 *   - 左 · 未决案队列（三省 FSM 非终态）· 带"等谁"标签 · 按优先度排
 *   - 中 · 陛下一句话 · 直通 bills FSM 起草
 *   - 右 · 今日三省活动 + 最近落印
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Crown, Send, Clock, ArrowRight, Loader2, Zap } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { toast } from 'sonner';
import type { BillState } from '@/features/governance/lib/bill-fsm';

interface PendingDecision {
  billId: string;
  title: string;
  state: BillState;
  revisionCount: number;
  waitingMs: number;
  nextActor: string;
}

interface Dashboard {
  timestamp: string;
  totals: { all: number; pending: number; terminal: number };
  pendingDecisions: PendingDecision[];
  activity: {
    drafted: number;
    submitted: number;
    rejected: number;
    approved: number;
    dispatched: number;
    completed: number;
    archived: number;
    totalToday: number;
  };
  recentlyLanded: Array<{
    billId: string;
    title: string;
    state: BillState;
    landedAt: string;
    events: number;
  }>;
}

const STATE_COLOR: Record<BillState, string> = {
  drafted: '#F0C66A',
  under_review: '#FB923C',
  revising: '#F0C66A',
  approved: '#3DD68C',
  executing: '#60A5FA',
  completed: '#3DD68C',
  failed: '#F43F5E',
  rejected: '#F43F5E',
  shelved: '#8A92AC',
  archived: '#A78BFA',
};

const STATE_LABEL: Record<BillState, string> = {
  drafted: '起草',
  under_review: '审议',
  revising: '修改',
  approved: '已准',
  executing: '执行',
  completed: '已成',
  failed: '已败',
  rejected: '终驳',
  shelved: '搁置',
  archived: '史馆',
};

const ACTOR_COLOR: Record<string, string> = {
  陛下: '#F43F5E',
  中书: '#F0C66A',
  门下: '#FB923C',
  尚书: '#3DD68C',
  六部: '#60A5FA',
};

function humanWait(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1分';
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}时`;
  return `${Math.floor(h / 24)}日`;
}

export function ThroneDecisionDesk() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [command, setCommand] = useState('');
  const commandRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/governance/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as Dashboard;
      setData(d);
    } catch (err) {
      console.warn('decision desk load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000); // 30s 自动刷新
    return () => clearInterval(t);
  }, [load]);

  async function quickDraft() {
    if (command.trim().length < 5) {
      toast.error('旨意太短 · 至少 5 字');
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch('/api/governance/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('已起草', { description: '送至 /governance 见三省流转' });
      setCommand('');
      void load();
    } catch (err) {
      toast.error('起草失败', { description: String(err) });
    } finally {
      setDrafting(false);
    }
  }

  const pendingCount = data?.pendingDecisions.length ?? 0;
  const primaryAction =
    pendingCount > 0
      ? {
          label: '先看待决案',
          href: '/governance',
          note: `当前有 ${pendingCount} 件事项卡在三省流转，先决定是否拍板。`,
        }
      : {
          label: '先下一道旨',
          href: null,
          note: '当前无待决案，最有效的动作是先给丞相一句明确口谕。',
        };

  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners>
      <div className="mb-4 flex items-center gap-2">
        <Crown size={14} className="text-[#F0C66A]" />
        <span
          className="text-[12px] font-bold uppercase tracking-[0.28em] text-[#F0C66A]"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          御前决策台
        </span>
        <span className="ml-auto text-[11px] text-[#8A92AC]">
          {data ? `${data.totals.pending} 件待决 · ${data.activity.totalToday} 帧今日活动` : '加载…'}
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#F0C66A]/15 bg-[#F0C66A]/[0.04] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F0C66A]">
            今日先做什么
          </div>
          <div
            className="mt-1 text-[16px] font-bold text-[#F5E9C9]"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          >
            {pendingCount > 0 ? '先处理待决案，再考虑新旨' : '先压成一句新旨，不要先摊开看板'}
          </div>
          <p className="mt-1 text-[12px] leading-6 text-[#9AA3C4]">{primaryAction.note}</p>
        </div>
        {primaryAction.href ? (
          <Link
            href={primaryAction.href}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#F0C66A]/40 bg-[#F0C66A]/12 px-5 py-2.5 text-[12px] font-semibold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
          >
            {primaryAction.label}
            <ArrowRight size={13} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => commandRef.current?.focus()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#F0C66A]/40 bg-[#F0C66A]/12 px-5 py-2.5 text-[12px] font-semibold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
          >
            {primaryAction.label}
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 左 · 未决案队列 */}
        <div className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F43F5E]">
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              未决 · 按优先排
            </span>
            {data && data.pendingDecisions.length > 0 && (
              <Link
                href="/governance"
                className="text-[#8A92AC] normal-case tracking-normal hover:text-[#F0C66A]"
              >
                全部 →
              </Link>
            )}
          </div>
          {!data || data.pendingDecisions.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#3DD68C]/25 bg-[#3DD68C]/[0.04] px-4 py-6 text-center text-[12.5px] text-[#3DD68C]">
              ✓ 朝堂畅通 · 无案待决
            </div>
          ) : (
            <ul className="space-y-1.5">
              {data.pendingDecisions.map((p) => {
                const color = STATE_COLOR[p.state];
                const actorColor = ACTOR_COLOR[p.nextActor] ?? '#8A92AC';
                return (
                  <li key={p.billId}>
                    <Link
                      href="/governance"
                      className="block rounded-md border px-3 py-2 transition"
                      style={{
                        borderColor: `${color}33`,
                        background: `linear-gradient(135deg, ${color}08, transparent 80%)`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] font-bold"
                          style={{ borderColor: `${actorColor}55`, color: actorColor }}
                        >
                          等{p.nextActor}
                        </span>
                        <span
                          className="flex-1 truncate text-[12.5px] text-[#F5E9C9]"
                          style={{ fontFamily: '"Noto Serif SC", serif' }}
                        >
                          {p.title}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-[#8A92AC]">
                          {humanWait(p.waitingMs)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-[#8A92AC]">
                        <span style={{ color }}>{STATE_LABEL[p.state]}</span>
                        {p.revisionCount > 0 && <span>· 修订 {p.revisionCount} 次</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 中 · 陛下一句话起草 */}
        <div className="space-y-3 lg:col-span-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F0C66A]">
            陛下口谕
          </div>
          <textarea
            ref={commandRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="一句话旨意 · 至少 5 字 · Cmd+Enter 发"
            rows={4}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void quickDraft();
            }}
            className="w-full rounded-md border border-[#F0C66A]/25 bg-black/40 px-3 py-2 text-[13px] leading-7 text-[#F5E9C9] placeholder:text-[#6A7299] focus:border-[#F0C66A]/50 focus:outline-none"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          />
          <button
            type="button"
            onClick={quickDraft}
            disabled={drafting || command.trim().length < 5}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[#F0C66A]/55 bg-[#F0C66A]/15 py-2 text-[13px] font-bold tracking-[0.08em] text-[#F0C66A] transition hover:bg-[#F0C66A]/22 disabled:opacity-40"
          >
            {drafting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                起草中...
              </>
            ) : (
              <>
                <Zap size={13} />
                落旨 · 走三省
              </>
            )}
          </button>
          <p className="text-[11px] leading-5 text-[#8A92AC]">
            旨意 → 中书起草 → 门下驳议 → 尚书派下 → 六部执行 → 入史馆
          </p>
        </div>

        {/* 右 · 今日活动 + 最近落印 */}
        <div className="space-y-3 lg:col-span-3">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A78BFA]">
              今日三省
            </div>
            {data && (
              <div className="grid grid-cols-2 gap-1.5">
                <MiniMetric label="起草" value={data.activity.drafted} color="#F0C66A" />
                <MiniMetric label="驳议" value={data.activity.rejected} color="#FB923C" />
                <MiniMetric label="准奏" value={data.activity.approved} color="#3DD68C" />
                <MiniMetric label="派执" value={data.activity.dispatched} color="#60A5FA" />
              </div>
            )}
          </div>

          {data && data.recentlyLanded.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#3DD68C]">
                最近落印
              </div>
              <ul className="space-y-1">
                {data.recentlyLanded.slice(0, 3).map((b) => (
                  <li key={b.billId}>
                    <Link
                      href="/shiguan"
                      className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2 py-1 text-[11.5px] transition hover:bg-white/[0.05]"
                    >
                      <span
                        className="shrink-0 rounded-sm border px-1 text-[11px]"
                        style={{
                          borderColor: `${STATE_COLOR[b.state]}55`,
                          color: STATE_COLOR[b.state],
                        }}
                      >
                        {STATE_LABEL[b.state]}
                      </span>
                      <span
                        className="flex-1 truncate text-[#E6DBBC]"
                        style={{ fontFamily: '"Noto Serif SC", serif' }}
                      >
                        {b.title}
                      </span>
                      <ArrowRight size={10} className="shrink-0 text-[#6A7299]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function MiniMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-sm border px-2 py-1.5"
      style={{
        borderColor: `${color}22`,
        background: value > 0 ? `${color}08` : 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: `${color}cc` }}
      >
        {label}
      </div>
      <div
        className="font-mono text-[18px] font-black leading-none"
        style={{ color: value > 0 ? color : '#6A7299' }}
      >
        {value}
      </div>
    </div>
  );
}
