/**
 * 史馆 · 竹简长卷（Bamboo Scroll）
 *
 * 大事记主视觉：12 根竹简横排，金绳串联，可点击展开。
 * 设计：
 *   - 每根竹简 = 一条 AnnalsEntry
 *   - 竹面上竖排中文（4-6 字 · 书法感）
 *   - 顶底铜环 + 金线绑绳（自然下垂）
 *   - 成/混/败用铜印色圈标识
 *   - 选中时整根前移 + 上下展开详情卡
 *   - 背景古纸晕染 + 金色尘埃
 */

'use client';

import { useMemo, useState } from 'react';
import { ScrollText, Tag, ArrowRight } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import {
  ANNALS_ENTRIES,
  OUTCOME_META,
  type AnnalsEntry,
  type AnnalsOutcome,
} from '../lib/annals-entries';
import { useScribeFocus } from './scribe-focus-context';

const GOLD = '#F0C66A';

const CATEGORY_TINT: Record<AnnalsEntry['category'], string> = {
  治理: '#6BA0FF',
  执行: '#F0C66A',
  战略: '#B794F4',
  巡察: '#F5A524',
  宣发: '#F43F5E',
};

export function BambooScroll() {
  const { focus, setFocus } = useScribeFocus();
  const selectedId = focus.kind === 'entry' ? focus.entryId : null;

  const entries = useMemo(
    () => [...ANNALS_ENTRIES].sort((a, b) => (a.dateRaw < b.dateRaw ? 1 : -1)),
    [],
  );
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const counts = useMemo(() => {
    return entries.reduce(
      (acc, e) => {
        acc[e.outcome]++;
        return acc;
      },
      { success: 0, mixed: 0, failure: 0 } as Record<AnnalsOutcome, number>,
    );
  }, [entries]);

  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      {/* 金色尘埃背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(240,198,106,0.14), transparent 55%), radial-gradient(circle at 80% 100%, rgba(240,198,106,0.10), transparent 55%)',
        }}
      />
      <GoldDust />

      {/* Header */}
      <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: GOLD }}>
            Bamboo Annals · 竹简长卷
          </div>
          <h3 className="mt-1 text-[22px] font-semibold text-[#F5E9C9]">
            大事记 · 十二卷轴
          </h3>
          <div className="mt-1 text-[12px] text-[#9AA3C4]">
            点击任一竹简展开详情与教训；左右滚动览全卷
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <OutcomeChip label="成" count={counts.success} outcome="success" />
          <OutcomeChip label="混" count={counts.mixed} outcome="mixed" />
          <OutcomeChip label="败" count={counts.failure} outcome="failure" />
        </div>
      </div>

      {/* 卷轴区 */}
      <div className="relative overflow-hidden rounded-2xl border border-[#F0C66A]/30 p-4"
           style={{
             background:
               'linear-gradient(180deg, rgba(72,54,22,0.25), rgba(16,12,8,0.8))',
             boxShadow: 'inset 0 0 80px rgba(240,198,106,0.08)',
           }}
      >
        {/* 两端卷轴柱 */}
        <ScrollRod side="left" />
        <ScrollRod side="right" />

        {/* 竹简行 */}
        <div className="overflow-x-auto overflow-y-visible py-4">
          <div className="relative flex items-center gap-3 px-8" style={{ minWidth: `${entries.length * 72 + 80}px` }}>
            {/* 顶部金绳 */}
            <div
              className="pointer-events-none absolute left-4 right-4 top-10 h-[1.5px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #F0C66A 8%, #FFD97A 50%, #F0C66A 92%, transparent)',
                boxShadow: '0 0 8px rgba(240,198,106,0.45)',
              }}
            />
            {/* 底部金绳 */}
            <div
              className="pointer-events-none absolute left-4 right-4 bottom-10 h-[1.5px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #F0C66A 8%, #FFD97A 50%, #F0C66A 92%, transparent)',
                boxShadow: '0 0 8px rgba(240,198,106,0.45)',
              }}
            />

            {entries.map((e) => (
              <BambooStrip
                key={e.id}
                entry={e}
                selected={selectedId === e.id}
                onSelect={() => setFocus({ kind: 'entry', entryId: e.id })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 选中详情 */}
      {selected && <EntryDetail entry={selected} />}

      {/* 空态提示 */}
      {!selected && (
        <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-[#F0C66A]/30 bg-[#F0C66A]/06 px-4 py-3 text-[11px] text-[#D6CCB0]">
          <ScrollText size={13} style={{ color: GOLD }} />
          选中一卷即展开详情，教训将进右侧史官常驻回溯。
        </div>
      )}
    </GlassPanel>
  );
}

/* ========================================================================== */

function OutcomeChip({
  label,
  count,
  outcome,
}: {
  label: string;
  count: number;
  outcome: AnnalsOutcome;
}) {
  const meta = OUTCOME_META[outcome];
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
      style={{
        background: `${meta.color}14`,
        borderColor: `${meta.color}55`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
      />
      <span style={{ color: meta.color }}>{label}</span>
      <span className="font-mono text-[12px] font-bold" style={{ color: meta.color }}>
        {count}
      </span>
    </div>
  );
}

/* ========================================================================== */

function ScrollRod({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-0 bottom-0 w-6 ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{
        background:
          side === 'left'
            ? 'linear-gradient(90deg, rgba(80,60,22,0.85), rgba(40,28,10,0.55) 70%, transparent)'
            : 'linear-gradient(270deg, rgba(80,60,22,0.85), rgba(40,28,10,0.55) 70%, transparent)',
      }}
    >
      {/* 铜环 */}
      <div className="absolute left-1 right-1 top-2 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #F0C66A, #7a5a20)', boxShadow: '0 0 6px rgba(240,198,106,0.6)' }} />
      <div className="absolute left-1 right-1 bottom-2 h-1 rounded-full" style={{ background: 'linear-gradient(90deg, #F0C66A, #7a5a20)', boxShadow: '0 0 6px rgba(240,198,106,0.6)' }} />
      <div className="absolute inset-x-0 top-1/2 h-[1px] -translate-y-1/2" style={{ background: 'rgba(240,198,106,0.35)' }} />
    </div>
  );
}

/* ========================================================================== */

function BambooStrip({
  entry,
  selected,
  onSelect,
}: {
  entry: AnnalsEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const outcome = OUTCOME_META[entry.outcome];
  const catTint = CATEGORY_TINT[entry.category];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative shrink-0 transition-all duration-300 ${
        selected ? '-translate-y-2' : 'hover:-translate-y-1'
      }`}
      style={{
        width: '54px',
        height: '240px',
      }}
    >
      {/* 竹简主体 */}
      <div
        className="relative h-full w-full rounded-[6px] border text-center"
        style={{
          background: selected
            ? 'linear-gradient(180deg, #C59343, #8F5F21 50%, #5A3A12)'
            : 'linear-gradient(180deg, #A67833, #7A5320 50%, #4A2E0E)',
          borderColor: selected ? '#FFD97A' : '#F0C66A88',
          boxShadow: selected
            ? '0 8px 24px rgba(240,198,106,0.4), inset 0 0 20px rgba(255,217,122,0.25)'
            : '0 3px 10px rgba(0,0,0,0.4), inset 0 0 16px rgba(255,217,122,0.10)',
        }}
      >
        {/* 顶部铜钉 */}
        <div
          className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, #FFD97A, #7a5a20)',
            boxShadow: '0 0 4px #F0C66A',
          }}
        />
        {/* 底部铜钉 */}
        <div
          className="absolute left-1/2 bottom-1.5 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, #FFD97A, #7a5a20)',
            boxShadow: '0 0 4px #F0C66A',
          }}
        />

        {/* 纹路 */}
        <div
          aria-hidden
          className="absolute inset-x-1.5 top-6 bottom-6 rounded"
          style={{
            background:
              'repeating-linear-gradient(180deg, transparent 0 8px, rgba(0,0,0,0.12) 8px 9px)',
          }}
        />

        {/* 竖排标题 · hover 时墨迹从淡到浓渐显 */}
        <div
          className="absolute inset-x-0 top-8 bottom-10 flex flex-col items-center justify-center gap-1"
          style={{
            color: '#F5E9C9',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {entry.title.split('').map((ch, i) => (
            <span
              key={i}
              className="text-[14px] font-bold transition-all duration-[280ms] ease-out"
              style={{
                fontFamily: 'serif',
                letterSpacing: '0',
                lineHeight: 1,
                // 默认较淡 · hover/选中时变黑浓 + 底纹金光
                color: selected ? '#FFF8E1' : undefined,
                textShadow: selected
                  ? '0 0 6px rgba(255,248,225,0.9), 0 2px 4px rgba(0,0,0,0.7)'
                  : '0 1px 2px rgba(0,0,0,0.6)',
                transitionDelay: `${i * 60}ms`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>
        {/* hover 时的墨迹渐显金光层 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-8 bottom-10 rounded opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(255,217,122,0.08) 30%, rgba(255,217,122,0.14) 50%, rgba(255,217,122,0.08) 70%, transparent 100%)',
          }}
        />
        {/* hover 时墨笔从上往下滑过 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-8 h-[3px] w-[24px] -translate-x-1/2 rounded-full opacity-0 transition-[opacity,top] duration-[900ms] ease-in-out group-hover:opacity-80 group-hover:top-[90%]"
          style={{
            background:
              'radial-gradient(ellipse, #1a1208 0%, rgba(26,18,8,0.6) 60%, transparent 100%)',
            boxShadow: '0 0 8px rgba(26,18,8,0.9)',
          }}
        />

        {/* 底部结果铜印 */}
        <div
          className="absolute left-1/2 bottom-4 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: `radial-gradient(circle, ${outcome.color}cc, ${outcome.color}22)`,
            color: '#F5E9C9',
            border: `1px solid ${outcome.color}`,
            boxShadow: `0 0 8px ${outcome.color}66`,
          }}
        >
          {outcome.glyph}
        </div>

        {/* 顶部类别点 */}
        <div
          className="absolute left-1/2 top-6 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
          style={{
            background: catTint,
            boxShadow: `0 0 6px ${catTint}`,
          }}
        />
      </div>

      {/* 日期标签 */}
      <div
        className="mt-1 text-center text-[9px] font-mono"
        style={{ color: selected ? '#FFD97A' : '#9AA3C4' }}
      >
        {entry.dateLabel.split(' · ')[0]}
      </div>
    </button>
  );
}

/* ========================================================================== */

function EntryDetail({ entry }: { entry: AnnalsEntry }) {
  const outcome = OUTCOME_META[entry.outcome];
  const catTint = CATEGORY_TINT[entry.category];
  return (
    <div
      className="relative mt-5 rounded-2xl border p-5"
      style={{
        borderColor: `${outcome.color}55`,
        background: `linear-gradient(160deg, ${outcome.color}12, rgba(20,22,30,0.55) 60%, ${GOLD}08)`,
        boxShadow: `0 6px 24px ${outcome.color}1a`,
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: outcome.color }}>
            {entry.dateLabel}
            <span style={{ color: catTint }}>· {entry.category}</span>
          </div>
          <h4 className="mt-1 text-[22px] font-semibold text-[#F5E9C9]">
            {entry.title} · <span className="text-[14px] font-normal text-[#D6CCB0]">{entry.summary}</span>
          </h4>
        </div>
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-bold"
          style={{
            background: `radial-gradient(circle, ${outcome.color}88, ${outcome.color}22)`,
            border: `1.5px solid ${outcome.color}`,
            color: '#F5E9C9',
            boxShadow: `0 4px 16px ${outcome.color}55`,
          }}
        >
          {outcome.glyph}
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-8 text-[#C8CDD8]">{entry.detail}</p>

      {/* 教训 */}
      <div className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          Lessons · 教训
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {entry.lessons.map((l, i) => (
            <div
              key={i}
              className="rounded-xl border p-3"
              style={{
                borderColor: `${GOLD}33`,
                background: 'rgba(240,198,106,0.06)',
              }}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono"
                style={{
                  background: `${GOLD}22`,
                  color: GOLD,
                  border: `1px solid ${GOLD}55`,
                }}
              >
                {i + 1}
              </div>
              <div className="mt-2 text-[12px] leading-6 text-[#D6CCB0]">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags + 部门 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Tag size={11} style={{ color: GOLD }} />
        {entry.tags.map((t) => (
          <span
            key={t}
            className="rounded-full border border-[#F0C66A]/30 bg-[#F0C66A]/08 px-2 py-0.5 text-[10px]"
            style={{ color: '#F5E9C9' }}
          >
            {t}
          </span>
        ))}
        <span className="mx-2 text-[#6A7299]">·</span>
        {entry.relatedDepartments.map((d) => (
          <span key={d} className="text-[10px] text-[#9AA3C4]">
            {d}
          </span>
        ))}
        <div className="grow" />
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition hover:brightness-110"
          style={{
            borderColor: `${GOLD}66`,
            background: `${GOLD}14`,
            color: GOLD,
          }}
        >
          召回相似案例
          <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */

/** 金色漂浮尘埃（装饰） */
function GoldDust() {
  const dots = useMemo(() => {
    const arr: { x: number; y: number; r: number; d: number }[] = [];
    const rng = mulberry32(11);
    for (let i = 0; i < 36; i++) {
      arr.push({
        x: rng() * 100,
        y: rng() * 100,
        r: rng() * 0.9 + 0.3,
        d: rng() * 6 + 4,
      });
    }
    return arr;
  }, []);
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#F0C66A" opacity="0.35">
          <animate attributeName="opacity" values="0.1;0.55;0.1" dur={`${d.d}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
