/**
 * JinyiweiLeftColumn · 左栏 · 每日朝报
 *
 * 七类朝报入口：天下 / 机巧 / 财赋 / 兵戎 / 商贾 / 政令 / 竞合
 * 每类一行：印章 + 名称 + 信号计数 + 危机/预警数
 * 顶部：戚继光立像 + 信鸽通知
 * 底部：锦衣卫问策
 */

'use client';

import { useMemo } from 'react';
import { ShieldAlert, Navigation } from 'lucide-react';
import { GlassPanel, PortraitBanner } from '@/features/shangshufang/components/atoms';
import { CarrierDove } from './carrier-dove';
import { buildBriefingBoard } from '../lib/briefing-categories';
import type { BriefingSlot } from '../lib/briefing-categories';
import type { IntelSignal } from '@/types/intel';

const JINYIWEI_PORTRAIT = '/heroes/character-roster/v5-intel-qi-jiguang.webp';
const ACCENT = '#E0553A';
const SEAL_COLOR = '#E0553A';

function SealStamp({ char, size = 24, filled = false }: { char: string; size?: number; filled?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-sm font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        color: filled ? '#0A0E1A' : SEAL_COLOR,
        background: filled ? SEAL_COLOR : 'transparent',
        border: `1.5px solid ${SEAL_COLOR}`,
        fontFamily: 'var(--font-serif)',
        letterSpacing: '0.08em',
        transform: 'rotate(-2.5deg)',
      }}
      aria-hidden
    >
      {char}
    </span>
  );
}

export interface JinyiweiLeftColumnProps {
  signals: IntelSignal[];
  selectedSignalId: string | null;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  onSelectSignal: (id: string | null) => void;
  onAsk: () => void;
}

export function JinyiweiLeftColumn({
  signals,
  selectedSignalId,
  selectedCategoryId,
  onSelectCategory,
  onSelectSignal,
  onAsk,
}: JinyiweiLeftColumnProps) {
  const board = useMemo(() => buildBriefingBoard(signals), [signals]);
  const totalUrgent = board.reduce((a, b) => a + b.urgentCount, 0);
  const totalCritical = board.reduce((a, b) => a + b.criticalCount, 0);

  return (
    <GlassPanel accent={ACCENT} className="h-full">
      {/* 立像 */}
      <PortraitBanner
        portrait={JINYIWEI_PORTRAIT}
        name="戚继光"
        duty="夜巡总旗 · 锦衣卫"
        objectPosition="62% 32%"
        accent={ACCENT}
        belowSlot={
          <span className="flex items-center gap-1" aria-hidden>
            <ShieldAlert size={14} className="text-[#E0553A]/70" />
          </span>
        }
      />

      {/* 信鸽通知（收入左栏顶部） */}
      <div className="mx-3 mb-1">
        <CarrierDove signals={signals} />
      </div>

      <div
        className="mx-4 mb-1 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}35, transparent)` }}
        aria-hidden
      />

      {/* 朝报分类 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-medium tracking-[0.14em] text-[#8F835F]">
          <span className="text-[#E0553A]/75" aria-hidden>◈</span>
          <span>每日朝报</span>
          {totalUrgent > 0 && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-[#E0553A]/15 px-2 py-0.5 text-[9px] text-[#E0553A]">
              急 {totalUrgent}
            </span>
          )}
        </div>

        <div className="space-y-0.5">
          {board.map((slot) => {
            const isActive = slot.category.id === selectedCategoryId;
            const hasSignals = slot.totalCount > 0;
            const isUrgent = slot.urgentCount > 0;

            return (
              <div key={slot.category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => onSelectCategory(slot.category.id)}
                disabled={!hasSignals}
                className={`group relative flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-all ${
                  isActive
                    ? 'border-[#E0553A]/45 bg-[#E0553A]/[0.08]'
                    : 'border-transparent hover:border-[#E0553A]/20 hover:bg-[#E0553A]/[0.04]'
                } ${!hasSignals ? 'opacity-35' : ''}`}
              >
                {/* 印章 */}
                <SealStamp
                  char={slot.category.seal}
                  size={22}
                  filled={isUrgent}
                />

                {/* 名称 + 副标题 */}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-semibold text-[#EAEEFB] group-hover:text-[#F5E9C9]">
                    {slot.category.label}
                  </span>
                  <span className="block text-[9px] text-[#6A7299]">
                    {slot.category.subtitle}
                  </span>
                </span>

                {/* 计数 */}
                {hasSignals ? (
                  <span className="flex shrink-0 items-center gap-1">
                    {slot.criticalCount > 0 && (
                      <span className="rounded-full bg-[#E0553A]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#E0553A]">
                        {slot.criticalCount}
                      </span>
                    )}
                    {slot.warningCount > 0 && slot.criticalCount === 0 && (
                      <span className="rounded-full bg-[#E0553A]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#F5A524]">
                        {slot.warningCount}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-[#6A7299]">
                      {slot.totalCount}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-[#484F72]">—</span>
                )}
              </button>

              {isActive && hasSignals ? (
                <div className="space-y-1 border-l pl-2" style={{ borderColor: `${ACCENT}24` }}>
                  {slot.signals.slice(0, 4).map((signal) => {
                    const selected = signal.id === selectedSignalId;

                    return (
                      <button
                        key={signal.id}
                        type="button"
                        onClick={() => onSelectSignal(signal.id)}
                        className="w-full rounded-md border px-2.5 py-2 text-left transition hover:border-[#E0553A]/30 hover:bg-[#E0553A]/[0.05]"
                        style={{
                          borderColor: selected ? `${ACCENT}55` : `${ACCENT}14`,
                          background: selected ? `${ACCENT}12` : 'rgba(5,7,13,0.30)',
                        }}
                      >
                        <span className="block truncate text-[10.5px] font-semibold text-[#F5E9C9]">
                          {signal.title}
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#6A7299]">
                          <span className="truncate">{signal.regionLabel}</span>
                          <span className="font-mono uppercase">{signal.level}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部统计 + 问策 */}
      <div
        className="mx-3 mt-1 border-t px-1 pt-2 pb-3"
        style={{ borderColor: `${ACCENT}20` }}
      >
        <div className="flex items-center justify-between text-[9px] text-[#6A7299]">
          <span>
            监 <span className="font-mono text-[#EAEEFB]">{signals.length}</span> 条
          </span>
          <span>
            危 <span className="font-mono text-[#E0553A]">{totalCritical}</span> 条
          </span>
          <span>
            急 <span className="font-mono text-[#F5A524]">{totalUrgent}</span> 条
          </span>
        </div>
        <button
          type="button"
          onClick={onAsk}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition-all hover:-translate-y-0.5"
          style={{
            borderColor: `${ACCENT}45`,
            background: `${ACCENT}0D`,
            color: ACCENT,
            fontFamily: 'var(--font-serif)',
            letterSpacing: '0.06em',
          }}
        >
          <Navigation size={12} />
          锦衣卫问策
        </button>
      </div>
    </GlassPanel>
  );
}
