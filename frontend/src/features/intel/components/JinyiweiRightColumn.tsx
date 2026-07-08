/**
 * JinyiweiRightColumn · 右栏 · 情报看板
 *
 * 三板块：
 *   1. 项目进展 — 关联任务状态 + 进度条
 *   2. 证据可信度 — 来源可靠性概览
 *   3. 六部转派 — 各部的信号分拨状态
 */

'use client';

import { useMemo } from 'react';
import { Activity, ShieldCheck, Send, CheckCircle2, Clock, Filter } from 'lucide-react';
import { GlassPanel } from '@/features/shangshufang/components/atoms';
import type { IntelSignal } from '@/types/intel';
import type { AgentCode } from '@/types/agent';
import { AGENT_META } from '@/types/agent';

const ACCENT = '#E0553A';
const GOLD = '#C8B890';

const DEPT_KEYS: AgentCode[] = ['hu_bu', 'bing_bu', 'gong_bu', 'xing_bu', 'li_bu_rites'];

function hoursAgo(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return `${Math.round(h * 60)}分`;
  if (h < 24) return `${Math.round(h)}时`;
  return `${Math.round(h / 24)}天`;
}

export interface JinyiweiRightColumnProps {
  signals: IntelSignal[];
  selectedCategoryId: string | null;
}

export function JinyiweiRightColumn({ signals, selectedCategoryId }: JinyiweiRightColumnProps) {
  // 证据可信度统计
  const credStats = useMemo(() => {
    const verified = signals.filter((s) => s.credibility === 'verified').length;
    const high = signals.filter((s) => s.credibility === 'high').length;
    const medium = signals.filter((s) => s.credibility === 'medium').length;
    const low = signals.filter((s) => s.credibility === 'low').length;
    const total = signals.length || 1;
    return { verified, high, medium, low, total };
  }, [signals]);

  // 六部转派状态
  const deptDispatch = useMemo(() => {
    return DEPT_KEYS.map((code) => {
      const meta = AGENT_META[code];
      const routed = signals.filter((s) => s.routedTo?.includes(code));
      const pending = signals.filter(
        (s) => !s.routedTo?.includes(code) && (s.level === 'critical' || s.level === 'warning'),
      );
      return { code, meta, routedCount: routed.length, pendingCount: pending.length };
    });
  }, [signals]);

  // 门神漏斗：采→拦→待核→入库
  const funnel = useMemo(() => {
    const collected = signals.length;
    const gated = signals.filter((s) => s.credibility === 'low').length;
    const pending = signals.filter((s) => s.credibility !== 'low' && (!s.routedTo || s.routedTo.length === 0)).length;
    const routed = signals.filter((s) => s.routedTo && s.routedTo.length > 0).length;
    return { collected, gated, pending, routed };
  }, [signals]);

  // 最近项目进展 (取 routed 信号中最近 4 条)
  const recentProgress = useMemo(() => {
    return signals
      .filter((s) => s.routedTo && s.routedTo.length > 0)
      .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())
      .slice(0, 4);
  }, [signals]);

  return (
    <GlassPanel accent={ACCENT} className="h-full">
      {/* 标题 */}
      <div className="px-4 pt-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[#6A7299]">情报看板</div>
        <h3
          className="mt-0.5 text-[15px] font-bold tracking-[0.04em]"
          style={{ color: GOLD, fontFamily: 'var(--font-serif)' }}
        >
          事证总览
        </h3>
        <div
          className="mt-2 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}35, transparent)` }}
          aria-hidden
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {/* 门神漏斗 */}
        <section>
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-[#8F835F]">
            <Filter size={11} className="text-[#E0553A]/70" />
            <span>门神漏斗</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/15 to-transparent" aria-hidden />
          </div>
          <div className="mt-2 flex gap-1">
            {[
              { label: '采', count: funnel.collected, color: '#60A5FA' },
              { label: '拦', count: funnel.gated, color: '#E0553A' },
              { label: '待核', count: funnel.pending, color: '#F5A524' },
              { label: '入库', count: funnel.routed, color: '#3DD68C' },
            ].map((stage) => (
              <div
                key={stage.label}
                className="flex flex-1 flex-col items-center rounded-md border py-2"
                style={{ borderColor: `${stage.color}25`, backgroundColor: `${stage.color}08` }}
              >
                <span className="font-mono text-[14px] font-bold" style={{ color: stage.color }}>
                  {stage.count}
                </span>
                <span className="text-[9px] text-[#6A7299]">{stage.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 项目进展 */}
        <section>
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-[#8F835F]">
            <Activity size={11} className="text-[#E0553A]/70" />
            <span>项目进展</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/15 to-transparent" aria-hidden />
          </div>
          <div className="mt-2 space-y-1.5">
            {recentProgress.length > 0 ? (
              recentProgress.map((s) => {
                const deptNames = (s.routedTo ?? [])
                  .map((c) => AGENT_META[c]?.nameCn ?? c)
                  .slice(0, 2)
                  .join('/');
                const progress = s.credibility === 'verified' ? 100
                  : s.credibility === 'high' ? 75
                  : s.credibility === 'medium' ? 45
                  : 20;
                return (
                  <div
                    key={s.id}
                    className="rounded-md border px-2.5 py-2"
                    style={{ borderColor: `${ACCENT}18`, backgroundColor: 'rgba(5,7,13,0.30)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-[10.5px] font-medium text-[#EAEEFB]">
                        {s.title}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-[#6A7299]">
                        {hoursAgo(s.lastUpdatedAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="flex-1 h-1.5 rounded-full bg-[#0A0E1A] overflow-hidden">
                        <span
                          className="block h-full rounded-full transition-all"
                          style={{
                            width: `${progress}%`,
                            background:
                              progress >= 75 ? '#3DD68C'
                              : progress >= 45 ? '#F5A524'
                              : '#E0553A',
                          }}
                        />
                      </span>
                      <span className="text-[9px] text-[#6A7299]">{deptNames}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-3 text-center text-[10px] text-[#484F72]">暂无进行中项目</p>
            )}
          </div>
        </section>

        {/* 证据可信度 */}
        <section>
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-[#8F835F]">
            <ShieldCheck size={11} className="text-[#E0553A]/70" />
            <span>证据可信度</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/15 to-transparent" aria-hidden />
          </div>
          <div className="mt-2 rounded-md border px-3 py-2.5" style={{ borderColor: `${ACCENT}18`, backgroundColor: 'rgba(5,7,13,0.30)' }}>
            <div className="flex items-end gap-1.5">
              {[
                { label: '核', count: credStats.verified, color: '#3DD68C', pct: Math.round((credStats.verified / credStats.total) * 100) },
                { label: '高', count: credStats.high, color: '#60A5FA', pct: Math.round((credStats.high / credStats.total) * 100) },
                { label: '中', count: credStats.medium, color: '#F5A524', pct: Math.round((credStats.medium / credStats.total) * 100) },
                { label: '低', count: credStats.low, color: '#6A7299', pct: Math.round((credStats.low / credStats.total) * 100) },
              ].map((b) => (
                <div key={b.label} className="flex-1 text-center">
                  <div
                    className="mx-auto mb-1 rounded-sm"
                    style={{
                      width: '100%',
                      height: Math.max(b.pct * 0.6, 4),
                      backgroundColor: `${b.color}50`,
                    }}
                  />
                  <div className="font-mono text-[12px] font-bold" style={{ color: b.color }}>
                    {b.count}
                  </div>
                  <div className="text-[9px] text-[#484F72]">{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 六部转派状态 */}
        <section>
          <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-[#8F835F]">
            <Send size={11} className="text-[#E0553A]/70" />
            <span>六部转派</span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/15 to-transparent" aria-hidden />
          </div>
          <div className="mt-2 space-y-1">
            {deptDispatch.map((d) => {
              const meta = d.meta;
              const hasRouted = d.routedCount > 0;
              return (
                <div
                  key={d.code}
                  className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
                  style={{
                    borderColor: hasRouted ? `${meta.color}30` : `${ACCENT}10`,
                    backgroundColor: hasRouted ? `${meta.color}08` : 'transparent',
                  }}
                >
                  <span className="text-sm leading-none">{meta.emoji}</span>
                  <span
                    className="min-w-0 flex-1 text-[10.5px] font-medium"
                    style={{ color: hasRouted ? meta.color : '#6A7299' }}
                  >
                    {meta.nameCn}
                  </span>
                  {hasRouted ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={10} style={{ color: meta.color }} />
                      <span className="font-mono text-[10px]" style={{ color: meta.color }}>
                        {d.routedCount}
                      </span>
                    </span>
                  ) : (
                    d.pendingCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} className="text-[#6A7299]" />
                        <span className="font-mono text-[10px] text-[#6A7299]">
                          {d.pendingCount}
                        </span>
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 底部注脚 */}
      <div
        className="border-t px-3 py-2 text-center text-[9px] text-[#484F72]"
        style={{ borderColor: `${ACCENT}18` }}
      >
        证据不全则只许补证 · 不可伪装成结论
      </div>
    </GlassPanel>
  );
}
