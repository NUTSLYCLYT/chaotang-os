import { Loader2, RadioTower, Search, ShieldAlert } from 'lucide-react';

import { GlassPanel } from '@/features/shangshufang/components/atoms';
import type { IntelSignal } from '@/types/intel';

import type {
  JinyiweiBriefPhase,
  JinyiweiSignalStats,
  JinyiweiSourceLabel,
} from '../lib/jinyiwei-brief-contract';
import { JinyiweiCapabilityList } from './JinyiweiCapabilityList';
import { JinyiweiSourceStatus } from './JinyiweiSourceStatus';

export interface JinyiweiEvidenceRailProps {
  query: string;
  onQuery: (value: string) => void;
  onRun: () => void;
  phase: JinyiweiBriefPhase;
  error: string | null;
  source: 'turso' | 'fallback';
  stats: JinyiweiSignalStats;
  latestLabel: JinyiweiSourceLabel | null;
  completedAt: string | null;
  pendingSignals: IntelSignal[];
  onSelectSignal: (id: string) => void;
  mode?: 'all' | 'composer' | 'status';
}

export function JinyiweiEvidenceRail({
  query,
  onQuery,
  onRun,
  phase,
  error,
  source,
  stats,
  latestLabel,
  completedAt,
  pendingSignals,
  onSelectSignal,
  mode = 'all',
}: JinyiweiEvidenceRailProps) {
  const showComposer = mode === 'all' || mode === 'composer';
  const showStatus = mode === 'all' || mode === 'status';
  return (
    <GlassPanel accent="#E0553A" className="min-h-0" data-testid="jinyiwei-evidence-rail">
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <div className="section-eyebrow text-[#8F835F]">左栏 · 耳目采证</div>
          <h2 className="mt-1 font-serif text-[17px] font-black text-[#F5E9C9]">{mode === 'status' ? '辨来源与能力' : '找证据'}</h2>
        </div>
        <span className="rounded border border-[#E0553A]/28 bg-[#E0553A]/8 px-2 py-1 text-[9px] text-[#E88973]">真实接口</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {showComposer && (
          <section data-testid="jinyiwei-live-collection">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
              <Search size={12} className="text-[#E0553A]" />
              核查目标
              <span className="h-px flex-1 bg-gradient-to-r from-[#E0553A]/18 to-transparent" />
            </div>
            <div className="mt-2 rounded-xl border border-[#E0553A]/22 bg-[#E0553A]/[0.055] p-3">
              <textarea
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                rows={4}
                placeholder="核查项目、竞品、政策、风险，或某项外部声明是否可信"
                className="w-full resize-none rounded-lg border border-white/[0.09] bg-[#03050A]/75 px-3 py-2 text-[12px] leading-5 text-[#EAEEFB] outline-none placeholder:text-[#59617C] focus:border-[#E0553A]/55"
              />
              <button
                type="button"
                onClick={onRun}
                disabled={phase === 'collecting'}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E0553A]/45 bg-[#E0553A]/14 px-3 py-2 text-[11px] font-semibold text-[#E88973] transition hover:bg-[#E0553A]/22 disabled:cursor-wait disabled:opacity-60"
              >
                {phase === 'collecting' ? <Loader2 size={13} className="animate-spin" /> : <RadioTower size={13} />}
                {phase === 'collecting' ? '正在检索并核验' : '启动锦衣卫真实采证'}
              </button>
              {phase === 'collecting' && (
                <p className="mt-2 text-[9px] leading-4 text-[#D3A84C]">正在执行真实检索、确定性可信度核验、密报生成与归档。</p>
              )}
              {error && <p className="mt-2 text-[10px] leading-4 text-[#F43F5E]">{error}</p>}
              <p className="mt-2 text-[9px] leading-4 text-[#6A7299]">
                无联网密钥或无可核来源时，后端返回诚实空态，不生成假情报。
              </p>
            </div>
          </section>
        )}

        {showStatus && (
          <>
            <JinyiweiSourceStatus source={source} stats={stats} latestLabel={latestLabel} completedAt={completedAt} />
            <section data-testid="jinyiwei-pending-tasks">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
                <ShieldAlert size={12} className="text-[#F5A524]" />
                待核任务
                <span className="ml-auto font-mono text-[9px] text-[#6A7299]">{stats.pending}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {pendingSignals.length > 0 ? pendingSignals.slice(0, 4).map((signal) => (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => onSelectSignal(signal.id)}
                    className="w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-[#E0553A]/35"
                  >
                    <div className="line-clamp-1 text-[10px] font-semibold text-[#D9DDEB]">{signal.title}</div>
                    <div className="mt-1 text-[8px] text-[#747D9B]">{signal.regionLabel} · {signal.credibility === 'low' ? '低可信' : '待复查'}</div>
                  </button>
                )) : (
                  <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[9px] text-[#747D9B]">暂无待核任务。</div>
                )}
              </div>
            </section>
            <JinyiweiCapabilityList phase={phase} latestLabel={latestLabel} />
          </>
        )}
      </div>
    </GlassPanel>
  );
}
