'use client';

/**
 * 兵部 · 后端六司栏（左栏 · 2026-06-27）
 *
 * 用户可见口径以后端部门协议为主：销售司、市场司、渠道司、客户司、竞情司、增长司。
 * 今日经手数由 CRO 引擎内部席位映射聚合（全真）。点某司 → ?bureau=<id> 筛中栏队列。
 */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { useMemo } from 'react';

import { useBingbuOverview } from '@/features/bingbu/hooks/use-bingbu-overview';
import { BINGBU_BACKEND_BUREAUS, countByBackendBureau } from '@/features/bingbu/lib/bingbu-roster';

const ACCENT = '#6BA0FF';

export function BingbuOrgRail() {
  const { overview } = useBingbuOverview();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get('bureau');

  const overviewItems = overview?.items;
  const counts = useMemo(() => countByBackendBureau(overviewItems ?? []), [overviewItems]);
  const busiest = Math.max(0, ...Object.values(counts));

  // 切换 bureau 时保留其他参数（尤其 ?item，否则点司会意外关掉右侧详情面板）。
  function bureauHref(bureauId: string | null): string {
    const next = new URLSearchParams(params.toString());
    next.delete('si');
    if (bureauId) next.set('bureau', bureauId);
    else next.delete('bureau');
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">兵部六司</div>
        {active && (
          <Link href={bureauHref(null)} className="text-[10px] text-[#9aa0ad] transition hover:text-[#F5E9C9]">
            清除筛选
          </Link>
        )}
      </div>
      <div className="space-y-1">
        {BINGBU_BACKEND_BUREAUS.map((bureau) => {
          const n = counts[bureau.id] ?? 0;
          const isActive = active === bureau.id;
          const isBusiest = n > 0 && n === busiest;
          return (
            <Link
              key={bureau.id}
              href={bureauHref(isActive ? null : bureau.id)}
              className="block rounded-[10px] border px-2.5 py-1.5 transition"
              style={{
                borderColor: isActive ? `${ACCENT}66` : '#ffffff10',
                background: isActive ? `${ACCENT}18` : '#ffffff04',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-medium text-[#E9DDBE]">{bureau.name}</span>
                <span
                  className="shrink-0 rounded-full px-1.5 text-[10px] tabular-nums"
                  style={{
                    background: isBusiest ? `${ACCENT}22` : '#ffffff08',
                    color: isBusiest ? ACCENT : '#8f835f',
                  }}
                  title="今日经手销售事项数"
                >
                  {n}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#8f835f]">
                <span style={{ color: `${ACCENT}cc` }}>{bureau.role}</span>
              </div>
              <div className="text-[10px] leading-snug text-[#6f6750]">{bureau.scope}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
