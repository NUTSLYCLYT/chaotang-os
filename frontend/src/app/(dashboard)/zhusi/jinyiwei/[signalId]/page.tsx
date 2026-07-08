/**
 * 锦衣卫 · 信号详情二级页
 *
 * 从三栏主页面点击信号 → 进入此页查看完整情报内容
 * 锦衣卫朱砂红单色体系 · 印章标示
 */

'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Hash, Clock, Shield, Globe } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useAppStore } from '@/lib/store/app-store';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AGENT_META } from '@/types/agent';
import type { IntelSignal } from '@/types/intel';
import { asyncReady, asyncLoading, fromPromise } from '@/types/async-state';
import type { AsyncState } from '@/types/async-state';
import { StateSwitch } from '@/components/ui/state-switch';
import { RouteToTaskDialog } from '@/features/intel/components/route-to-task-dialog';

const ACCENT = '#E0553A';
const GOLD = '#C8B890';

const LEVEL_SEAL: Record<IntelSignal['level'], { char: string; color: string }> = {
  info: { char: '报', color: '#6BA0FF' },
  watch: { char: '观', color: '#6BA0FF' },
  warning: { char: '警', color: '#F5A524' },
  critical: { char: '急', color: '#E0553A' },
};

const CRED_DOTS: Record<IntelSignal['credibility'], number> = {
  low: 1, medium: 2, high: 3, verified: 4,
};

interface PageProps {
  params: Promise<{ signalId: string }>;
}

export default function SignalDetailPage({ params }: PageProps) {
  const { signalId } = use(params);
  const allSignals = useAppStore((s) => s.intelSignals);
  const setSignals = useAppStore((s) => s.setIntelSignals);
  const [state, setState] = useState<AsyncState<IntelSignal[]>>(
    allSignals.length > 0 ? asyncReady(allSignals) : asyncLoading(),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setState(asyncLoading());
    const result = await fromPromise(api.intel.getSignals(), { emptyTitle: '暂无情报' });
    if (result.status === 'ready') setSignals(result.data);
    setState(result);
  };

  useEffect(() => {
    if (allSignals.length === 0) void load();
  }, []);

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'linear-gradient(180deg, #050812 0%, #0A0E1A 100%)' }}>
      <div className="mx-auto max-w-[860px] space-y-4 p-6">
        <Link
          href="/intel"
          className="inline-flex items-center gap-1.5 text-[11px] text-[#6A7299] transition-colors hover:text-[#E0553A]"
        >
          <ArrowLeft size={12} />
          返回锦衣卫
        </Link>

        <StateSwitch state={state} onRetry={load}>
          {(signals) => {
            const signal = signals.find((s) => s.id === signalId) ?? null;
            if (!signal) return <NotFoundCard signalId={signalId} />;

            const seal = LEVEL_SEAL[signal.level];
            const hoursAgo = Math.round(
              (Date.now() - new Date(signal.lastUpdatedAt).getTime()) / 3600000,
            );

            return (
              <>
                <GlassPanel variant="danger" hudCorners className="overflow-hidden">
                  <div className="p-5">
                    {/* 印章 + 标签行 */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-sm border font-bold"
                        style={{
                          borderColor: seal.color,
                          color: seal.color,
                          background: `${seal.color}15`,
                          fontFamily: 'var(--font-serif)',
                          fontSize: 14,
                          transform: 'rotate(-3deg)',
                        }}
                      >
                        {seal.char}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-[10px]"
                        style={{ border: `1px solid ${ACCENT}30`, color: GOLD }}
                      >
                        {signal.regionLabel}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-[10px]"
                        style={{ border: `1px solid ${ACCENT}20`, color: '#9AA3C4' }}
                      >
                        {signal.industry}
                      </span>
                      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px]" style={{ border: `1px solid ${ACCENT}20`, color: '#3DD68C' }}>
                        <Shield size={9} />
                        {signal.credibility === 'verified' ? '已核' : signal.credibility === 'high' ? '可靠' : signal.credibility === 'medium' ? '一般' : '存疑'}
                      </span>
                    </div>

                    <h1 className="text-[20px] font-bold leading-snug text-[#EAEEFB]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {signal.title}
                    </h1>

                    <div className="mt-2 flex items-center gap-3 text-[10px] text-[#6A7299]">
                      <span className="flex items-center gap-1">
                        <Hash size={10} />
                        <span className="font-mono">{signal.id}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {hoursAgo < 1 ? `${Math.round(hoursAgo * 60)}分前` : hoursAgo < 24 ? `${hoursAgo}时前` : `${Math.round(hoursAgo / 24)}天前`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe size={10} />
                        {signal.regionLabel}
                      </span>
                    </div>

                    <p className="mt-4 text-[12px] leading-relaxed text-[#C8B890]">{signal.summary}</p>

                    {signal.impactScore !== undefined && (
                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-[10px] text-[#6A7299]">
                          <span>影响指数</span>
                          <span className="font-mono" style={{ color: seal.color }}>{signal.impactScore}/100</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${signal.impactScore}%`, background: seal.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </GlassPanel>

                {/* 转派区 */}
                <GlassPanel variant="danger" hudCorners>
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#6A7299]">转派决策</div>
                      <div className="mt-1 text-[11px] text-[#9AA3C4]">
                        {signal.routedTo && signal.routedTo.length > 0
                          ? `已转派至 ${signal.routedTo.length} 个部门`
                          : '尚未转派'}
                      </div>
                      {signal.routedTo && signal.routedTo.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {signal.routedTo.map((code) => {
                            const meta = AGENT_META[code];
                            return (
                              <span
                                key={code}
                                className="flex items-center gap-1 rounded border px-2 py-0.5 text-[10px]"
                                style={{ borderColor: `${meta.color}40`, background: `${meta.color}10`, color: meta.color }}
                              >
                                <span>{meta.emoji}</span>
                                {meta.nameCn}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDialogOpen(true)}
                      className="flex items-center gap-2 rounded-md px-4 py-2.5 text-[12px] font-semibold transition-all hover:-translate-y-0.5"
                      style={{
                        background: ACCENT,
                        color: '#fff',
                        fontFamily: 'var(--font-serif)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      <Send size={13} />
                      转派旨令
                    </button>
                  </div>
                </GlassPanel>

                {/* 来源 */}
                <GlassPanel variant="danger" hudCorners>
                  <div className="p-5">
                    <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[#6A7299]">消息来源</div>
                    <div className="space-y-1.5">
                      {signal.sources.map((src, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-3 rounded border px-3 py-2 text-[11px]"
                          style={{ borderColor: `${ACCENT}15` }}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-[#EAEEFB]">{src.name}</div>
                            {src.url && (
                              <a href={src.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[10px] text-[#6BA0FF] hover:underline">
                                {src.url}
                              </a>
                            )}
                          </div>
                          <div className="shrink-0 font-mono text-[9px] text-[#484F72]">
                            {new Date(src.publishedAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassPanel>
              </>
            );
          }}
        </StateSwitch>

        <RouteToTaskDialog
          signal={allSignals.find((s) => s.id === signalId) ?? null}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      </div>
    </div>
  );
}

function NotFoundCard({ signalId }: { signalId: string }) {
  return (
    <GlassPanel variant="danger" hudCorners>
      <div className="p-8 text-center">
        <div className="text-[13px] font-medium text-[#EAEEFB]">情报不存在</div>
        <div className="mt-1 font-mono text-[10px] text-[#6A7299]">{signalId}</div>
      </div>
    </GlassPanel>
  );
}
