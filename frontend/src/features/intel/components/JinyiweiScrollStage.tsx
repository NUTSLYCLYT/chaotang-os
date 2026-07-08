/**
 * 锦衣卫 · 密报卷轴舞台（暗色卷轴，嵌入世界地图）
 *
 * 对标上书房 EdictStage，锦衣卫暗色体系：
 * - 卷底 #0A0E1A 深蓝黑 · 火漆边 #8B1A1A · 金线 #D4A84B
 *
 * 三种状态：
 *   default — 卷轴全幅：标题 + 过滤栏 + 世界地图 + 底栏
 *   category — 选择分类后：该分类标题 + 分类过滤地图 + 信号列表
 *   collapsed — 藏图模式：卷轴透明，只显背景
 */

'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Eye, Hash } from 'lucide-react';
import { IntelHeroMap } from './intel-hero-map';
import { IntelFilterBar } from './intel-filter-bar';
import { SignalFeedCompact } from './SignalFeedCompact';
import { briefingCategoryById } from '../lib/briefing-categories';
import { EDICT_SCROLL_THEME } from '@/features/shangshufang/edict-content';
import type { IntelSignal } from '@/types/intel';
import type { IntelSource } from '@/lib/hooks/use-intel-signals';
import { useAppStore } from '@/lib/store/app-store';

const SEAL_COLOR = EDICT_SCROLL_THEME.jinyiwei.accent;
const GOLD_THREAD = '#D4A84B';
const SCROLL_BASE = '#0A0E1A';

function timeDecayHours(signal: IntelSignal): number {
  const age = Date.now() - new Date(signal.lastUpdatedAt).getTime();
  return age / 3600000;
}

function timeDecayOpacity(signal: IntelSignal): number {
  const h = timeDecayHours(signal);
  if (h < 24) return 1;
  if (h < 168) return 0.6;
  if (h < 720) return 0.35;
  return 0;
}

function categoryFilter(signals: IntelSignal[], categoryId: string): IntelSignal[] {
  const cat = briefingCategoryById(categoryId as any);
  return signals.filter((s) => {
    const text = `${s.industry ?? ''} ${s.title ?? ''} ${s.summary ?? ''}`;
    return cat.keywords.test(text);
  });
}

export interface JinyiweiScrollStageProps {
  signals: IntelSignal[];
  filtered: IntelSignal[];
  source: IntelSource;
  availableRegions: { code: string; label: string }[];
  totalCount: number;
  filteredCount: number;
  onRoute: () => void;
  selectedSignal: IntelSignal | null;
  selectedCategoryId: string | null;
  mapCollapsed: boolean;
}

export function JinyiweiScrollStage({
  signals,
  filtered,
  source,
  availableRegions,
  totalCount,
  filteredCount,
  onRoute,
  selectedSignal,
  selectedCategoryId,
  mapCollapsed,
}: JinyiweiScrollStageProps) {
  const selectSignal = useAppStore((s) => s.selectSignal);
  const [filterBarCollapsed, setFilterBarCollapsed] = useState(false);

  // 分类过滤
  const categoryFiltered = useMemo(() => {
    if (!selectedCategoryId) return filtered;
    return categoryFilter(filtered, selectedCategoryId);
  }, [filtered, selectedCategoryId]);

  const category = selectedCategoryId ? briefingCategoryById(selectedCategoryId as any) : null;

  const decayedSignals = useMemo(() => {
    return categoryFiltered
      .map((s) => ({ signal: s, opacity: timeDecayOpacity(s), hours: timeDecayHours(s) }))
      .filter((d) => d.opacity > 0)
      .sort((a, b) => a.hours - b.hours);
  }, [categoryFiltered]);

  const staleCount = useMemo(
    () => categoryFiltered.filter((s) => timeDecayHours(s) > 168).length,
    [categoryFiltered],
  );

  const displayCount = selectedCategoryId ? categoryFiltered.length : filteredCount;

  if (mapCollapsed) {
    return (
      <div className="relative flex h-full min-h-0 items-center justify-center">
        <div className="text-center">
          <div
            className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full border opacity-30"
            style={{ borderColor: `${SEAL_COLOR}40`, background: `${SEAL_COLOR}08` }}
          >
            <Eye size={22} className="text-[#E0553A]/40" />
          </div>
          <p className="text-[10px] tracking-[0.12em] text-[#484F72]" style={{ fontFamily: 'var(--font-serif)' }}>
            卷轴已藏 · 点击「展图」唤回
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="jinyiwei-scroll-stage relative h-full min-h-0">
      <style>{`
        .jinyiwei-scroll-stage {
          perspective: 1200px;
          filter: drop-shadow(0 40px 62px rgba(0,0,0,0.58));
        }
        .jinyiwei-scroll-paper {
          animation: scroll-unfurl-jinyiwei 760ms cubic-bezier(0.22,1,0.3,1) both;
        }
        .jinyiwei-seal {
          animation: seal-drop-jinyiwei 680ms cubic-bezier(0.2,1.5,0.4,1) both;
          animation-delay: 900ms;
        }
        .jinyiwei-seal-ring {
          animation: seal-ring-jinyiwei 720ms ease-out both;
          animation-delay: 1080ms;
        }
        @keyframes scroll-unfurl-jinyiwei {
          0%   { clip-path: inset(0 0 100% 0 round 18px); opacity: .45; }
          100% { clip-path: inset(0 0 0 0 round 18px); opacity: 1; }
        }
        @keyframes seal-drop-jinyiwei {
          0%   { opacity: 0; transform: translate(-50%,-50%) rotate(-30deg) scale(1.5); }
          70%  { opacity: .22; transform: translate(-50%,-50%) rotate(-15deg) scale(.93); }
          100% { opacity: .19; transform: translate(-50%,-50%) rotate(-18deg) scale(1); }
        }
        @keyframes seal-ring-jinyiwei {
          0%   { opacity: .5; transform: translate(-50%,-50%) scale(.55); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(2.3); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jinyiwei-scroll-paper { animation: none; clip-path: none; }
          .jinyiwei-seal { animation: none; opacity: .19; transform: translate(-50%,-50%) rotate(-18deg); }
          .jinyiwei-seal-ring { display: none; }
        }
      `}</style>

      <div className="relative h-full min-h-0">
        <SideRoller side="left" />
        <SideRoller side="right" />

        <section
          data-three-axis-scroll
          className="jinyiwei-scroll-paper relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px]"
          aria-label="锦衣卫密报卷轴"
          style={{
            background: `radial-gradient(ellipse at 50% -12%, #1a2030 0%, ${SCROLL_BASE} 44%, #050812 100%)`,
            border: '1px solid rgba(139,26,26,0.72)',
            boxShadow:
              '0 28px 80px rgba(0,0,0,0.68), 0 0 60px 6px rgba(212,168,75,0.08), inset 0 0 120px rgba(20,10,6,0.30), inset 0 1px 0 rgba(200,184,144,0.22), inset 0 -22px 44px rgba(10,5,2,0.18)',
          }}
        >
          {/* 火漆钤印水印 */}
          <span
            aria-hidden
            className="jinyiwei-seal-ring pointer-events-none absolute left-1/2 top-1/2 hidden h-[210px] w-[210px] rounded-full md:block"
            style={{ boxShadow: '0 0 0 2px rgba(224,85,58,0.28)' }}
          />
          <span
            aria-hidden
            className="jinyiwei-seal pointer-events-none absolute left-1/2 top-1/2 grid h-[200px] w-[200px] place-items-center rounded-full"
            style={{
              border: `2px solid ${SEAL_COLOR}`,
              color: SEAL_COLOR,
              fontFamily: 'var(--font-serif)',
              fontSize: 50,
              fontWeight: 800,
              letterSpacing: '0.16em',
              mixBlendMode: 'multiply',
              backgroundImage: 'radial-gradient(circle, rgba(80,15,8,0.22) 0.5px, transparent 0.7px)',
              backgroundSize: '3px 3px',
              WebkitMaskImage:
                'radial-gradient(ellipse 120% 100% at 42% 38%, #000 58%, rgba(0,0,0,0.72) 78%, transparent 93%)',
              maskImage:
                'radial-gradient(ellipse 120% 100% at 42% 38%, #000 58%, rgba(0,0,0,0.72) 78%, transparent 93%)',
            }}
          >
            密
          </span>

          {/* 竖格金线 */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-5 top-8 bottom-8 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(212,168,75,0.22), transparent)' }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-5 top-8 bottom-8 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(212,168,75,0.22), transparent)' }}
          />

          {/* 帘纹 */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.40]"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(200,184,144,0.02) 0px, rgba(200,184,144,0.02) 1px, transparent 1px, transparent 25px), repeating-linear-gradient(90deg, rgba(212,168,75,0.025) 0px, rgba(212,168,75,0.025) 1px, transparent 1px, transparent 19px)',
            }}
          />

          {/* 内容层 */}
          <div className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden">
            {/* 卷首标题区 */}
            <div className="shrink-0 border-b px-5 py-3" style={{ borderColor: 'rgba(139,26,26,0.35)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {category && (
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-bold"
                      style={{
                        borderColor: SEAL_COLOR,
                        color: SEAL_COLOR,
                        fontFamily: 'var(--font-serif)',
                        fontSize: 14,
                        transform: 'rotate(-3deg)',
                      }}
                    >
                      {category.seal}
                    </span>
                  )}
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.22em] text-[#6A7299]">
                      {category ? `${category.label} · ${category.subtitle}` : '夜巡密报 · 锦衣卫世界情报'}
                    </div>
                    <h2
                      className="mt-0.5 text-[16px] font-bold tracking-[0.06em]"
                      style={{ color: GOLD_THREAD, fontFamily: 'var(--font-serif)' }}
                    >
                      {category ? `${category.label}朝报` : '锦衣卫世界情报地图'}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {staleCount > 0 && (
                    <span className="flex items-center gap-1 rounded-full border border-[#F5A524]/40 bg-[#F5A524]/10 px-2 py-0.5 text-[10px] text-[#F5A524]">
                      <Clock size={10} />
                      {staleCount}
                    </span>
                  )}
                  <span
                    className="rounded border px-2 py-0.5 font-mono text-[10px]"
                    style={{ borderColor: `${SEAL_COLOR}30`, backgroundColor: `${SEAL_COLOR}10`, color: SEAL_COLOR }}
                  >
                    {source === 'turso' ? '真库' : '演示'}
                  </span>
                </div>
              </div>
            </div>

            {/* 过滤栏（可折叠） */}
            {!category && (
              <div className="shrink-0 px-3 py-1">
                {filterBarCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setFilterBarCollapsed(false)}
                    className="flex w-full items-center justify-between rounded border px-3 py-1.5 text-[10px] transition-colors hover:border-[#E0553A]/40"
                    style={{ borderColor: 'rgba(139,26,26,0.18)', color: '#6A7299' }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono" style={{ color: '#D4A84B' }}>{filteredCount}</span>
                      <span>/ {totalCount} 条 · 过滤已收起</span>
                    </span>
                    <ChevronDown size={12} />
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-end px-1 pb-1">
                      <button
                        type="button"
                        onClick={() => setFilterBarCollapsed(true)}
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-[9px] text-[#484F72] transition-colors hover:text-[#6A7299]"
                      >
                        <ChevronUp size={10} />
                        收起过滤
                      </button>
                    </div>
                    <IntelFilterBar
                      availableRegions={availableRegions}
                      totalCount={totalCount}
                      filteredCount={filteredCount}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 地图核心区 */}
            <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
              <IntelHeroMap
                signals={decayedSignals.map((d) => d.signal)}
                height={category ? 300 : filterBarCollapsed ? 420 : 380}
                source={source}
              />
            </div>

            {/* 分类模式下的信号列表 */}
            {category && categoryFiltered.length > 0 && (
              <div className="shrink-0 border-t px-4 py-2" style={{ borderColor: 'rgba(139,26,26,0.22)' }}>
                <SignalFeedCompact
                  signals={categoryFiltered}
                  onSelect={(s) => selectSignal(s.id)}
                  activeId={selectedSignal?.id ?? null}
                  maxItems={4}
                />
              </div>
            )}

            {/* 底栏 */}
            <div
              className="shrink-0 border-t px-4 py-2"
              style={{ borderColor: 'rgba(139,26,26,0.28)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[10px] text-[#6A7299]">
                  <span>
                    可见 <span style={{ color: GOLD_THREAD }}>{displayCount}</span> 条
                  </span>
                  {decayedSignals.length < categoryFiltered.length && (
                    <span className="text-[#E0553A]">
                      ({categoryFiltered.length - decayedSignals.length} 超期)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onRoute}
                  disabled={!selectedSignal}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.06em] transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: selectedSignal ? SEAL_COLOR : 'rgba(255,255,255,0.06)',
                    background: selectedSignal ? `${SEAL_COLOR}12` : 'transparent',
                    color: selectedSignal ? SEAL_COLOR : '#6A7299',
                    fontFamily: 'var(--font-serif)',
                  }}
                >
                  转派
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SideRoller({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-3 bottom-3 z-10 w-2.5 rounded-full"
      style={{
        [side]: '-6px',
        background: `linear-gradient(180deg, #3a2010 10%, ${GOLD_THREAD} 42%, ${GOLD_THREAD} 58%, #3a2010 90%)`,
        boxShadow: '0 0 12px rgba(212,168,75,0.22), inset 0 1px 2px rgba(255,255,255,0.18)',
      }}
    />
  );
}
