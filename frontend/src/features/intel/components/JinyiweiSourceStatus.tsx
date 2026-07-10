import { Database, ExternalLink, RadioTower, ShieldAlert } from 'lucide-react';

import type { JinyiweiSignalStats, JinyiweiSourceLabel } from '../lib/jinyiwei-brief-contract';

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
      <div className="text-[9px] tracking-[0.12em] text-[#6A7299]">{label}</div>
      <div className="mt-1 font-mono text-[13px] font-bold" style={{ color: tone }}>{value}</div>
    </div>
  );
}

export function JinyiweiSourceStatus({
  source,
  stats,
  latestLabel,
  completedAt,
}: {
  source: 'turso' | 'fallback';
  stats: JinyiweiSignalStats;
  latestLabel: JinyiweiSourceLabel | null;
  completedAt: string | null;
}) {
  const mainLive = source === 'turso';
  return (
    <section data-testid="jinyiwei-real-stats">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
        <Database size={12} className="text-[#E0553A]" />
        真实数据状态
        <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/18 to-transparent" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Stat label="主库状态" value={mainLive ? 'TURSO' : '兜底'} tone={mainLive ? '#3DD68C' : '#C8A85A'} />
        <Stat label="真实信号" value={`${stats.real}/${stats.total}`} tone="#3DD68C" />
        <Stat label="公开来源" value={stats.sourceUrls} tone="#60A5FA" />
        <Stat label="急报预警" value={stats.alerts} tone="#F43F5E" />
      </div>
      <div className="mt-2 space-y-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-[9px] leading-4 text-[#747D9B]">
        <div className="flex items-center gap-1.5">
          <RadioTower size={10} className="text-[#E0553A]" />
          最近采证：{latestLabel ?? '尚未执行'}
        </div>
        <div className="flex items-center gap-1.5">
          <ExternalLink size={10} className="text-[#60A5FA]" />
          完成时间：{completedAt ? new Date(completedAt).toLocaleString('zh-CN') : '—'}
        </div>
        {!mainLive && (
          <div className="flex items-start gap-1.5 text-[#C8A85A]">
            <ShieldAlert size={10} className="mt-0.5 shrink-0" />
            fixture 仅供浏览，不计入真实信号与公开来源。
          </div>
        )}
      </div>
    </section>
  );
}
