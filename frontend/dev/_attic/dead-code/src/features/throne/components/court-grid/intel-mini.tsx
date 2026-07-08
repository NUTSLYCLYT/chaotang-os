'use client';

/**
 * 急报与简讯 · 精简 feed
 *
 * 最多 6 条，按 level 染色 · 烽火/黄旗/白旗
 * 点击进 /intel/[signalId]
 */

import Link from 'next/link';
import type { IntelSignal } from '@/types/intel';

interface Props {
  signals: IntelSignal[];
  limit?: number;
}

const LEVEL_MAP: Record<string, { label: string; color: string; glyph: string }> = {
  critical: { label: '烽火', color: '#EF4444', glyph: '🔥' },
  warning: { label: '黄旗', color: '#F0C66A', glyph: '⚑' },
  watch: { label: '戒严', color: '#6BA0FF', glyph: '🔶' },
  info: { label: '白旗', color: '#6A7299', glyph: '🏳' },
};

export function IntelMini({ signals, limit = 6 }: Props) {
  const hot = [...signals]
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, watch: 2, info: 3 } as const;
      return (
        (order[a.level as keyof typeof order] ?? 4) -
        (order[b.level as keyof typeof order] ?? 4)
      );
    })
    .slice(0, limit);

  if (hot.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/8 px-3 py-5 text-center text-[11px] text-[#6A7299]">
        天下无事 · 密报暂歇
        <Link
          href="/intel"
          className="ml-2 text-[#F0C66A] underline-offset-2 hover:underline"
        >
          进情报中心 →
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {hot.map((s) => {
        const level = LEVEL_MAP[s.level] ?? LEVEL_MAP.info!;
        return (
          <li key={s.id}>
            <Link
              href={`/intel/${s.id}`}
              className="flex items-start gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5 transition hover:border-[#F0C66A]/30 hover:bg-white/[0.05]"
            >
              <span
                className="mt-0.5 shrink-0 text-[12px]"
                style={{ color: level.color }}
                aria-label={level.label}
                title={level.label}
              >
                {level.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12px] font-medium text-[#F5E9C9]">
                  {s.title}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] leading-4 text-[#9AA3C4]">
                  {s.summary || s.sources[0]?.name || s.regionLabel || '—'}
                </div>
              </div>
              <span
                className="shrink-0 text-[9px] uppercase tracking-[0.14em]"
                style={{ color: level.color }}
              >
                {level.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
