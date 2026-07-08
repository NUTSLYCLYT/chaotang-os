'use client';

/**
 * 户部 · 顶部态势条（M1 · 显示区）
 * 关键数字 + sourceLabel 灯（LIVE/FALLBACK 不撒谎）。数据来自真实 overview(SWR 去重共享)。
 */
import { useHubuOverview } from '@/features/hubu/hooks/use-hubu-overview';

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#8f835f]">{label}</span>
      <span className={`mt-0.5 text-[16px] font-semibold ${gold ? 'gold-text' : 'text-[#E9DDBE]'}`}>{value}</span>
    </div>
  );
}

export function HubuSummaryHeader() {
  const { overview } = useHubuOverview();
  const s = overview?.summary;
  const isLive = s?.source === 'turso';
  return (
    <div className="flex items-center gap-6">
      <Stat label="现金储备" value={s?.cash_reserve ?? '—'} gold />
      <Stat label="待批" value={s ? `${s.pending_count} 件` : '—'} />
      <Stat label="平均 ROI" value={s?.avg_roi ?? '—'} />
      <span
        className="ml-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
        style={{ borderColor: isLive ? '#5FB97A40' : '#E5B84D40', color: isLive ? '#5FB97A' : '#E5B84D' }}
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: isLive ? '#5FB97A' : '#E5B84D' }} />
        {isLive ? 'LIVE · 真实总账' : 'FALLBACK · 兜底数据'}
      </span>
    </div>
  );
}
