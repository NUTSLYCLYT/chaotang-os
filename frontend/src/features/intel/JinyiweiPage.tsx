'use client';

import { useMemo, useState } from 'react';
import { Archive, FileSearch, RadioTower, ShieldCheck } from 'lucide-react';

import { DepartmentPageCanvas, DepartmentStage } from '@/features/departments/components/DepartmentPageShell';
import { assetUrl } from '@/lib/asset';
import { useIntelSignals } from '@/lib/hooks/use-intel-signals';
import { useAppStore } from '@/lib/store/app-store';
import type { IntelSignal } from '@/types/intel';

import { JinyiweiAuxViews, JinyiweiViewTabs } from './components/JinyiweiAuxViews';
import { JinyiweiBriefScroll } from './components/JinyiweiBriefScroll';
import { JinyiweiEvidenceRail } from './components/JinyiweiEvidenceRail';
import { JinyiweiVerdictRail } from './components/JinyiweiVerdictRail';
import { useJinyiweiBrief } from './hooks/use-jinyiwei-brief';
import {
  countSignalStats,
  resolveBriefSourceLabel,
  type JinyiweiAuxView,
} from './lib/jinyiwei-brief-contract';
import styles from './JinyiweiPage.module.css';

const JINYIWEI_SCENE = '/assets/jinyiwei/scene-jinyiwei-guards.png';

function Header({
  signals,
  source,
  briefCount,
}: {
  signals: IntelSignal[];
  source: 'turso' | 'fallback';
  briefCount: number;
}) {
  const stats = countSignalStats(signals, source);
  return (
    <header className="rounded-2xl border border-[#E0553A]/22 bg-[#05070D]/82 px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="section-eyebrow text-[#E0553A]">专署 · 锦衣卫</div>
          <h1 className="mt-1 font-serif text-[24px] font-black tracking-[0.08em] text-[#F5E9C9]" data-testid="jinyiwei-page-title">锦衣卫密报巡察台</h1>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#AFA589]">左栏找证据，中栏呈密报，右栏判真假与去向。真实检索与可信度裁决由后端锦衣卫执行，前端不复制算法。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric icon={RadioTower} label="真实信号" value={`${stats.real}/${stats.total}`} tone="#3DD68C" />
          <Metric icon={FileSearch} label="公开来源" value={stats.sourceUrls} tone="#60A5FA" />
          <Metric icon={ShieldCheck} label="待核任务" value={stats.pending} tone="#F5A524" />
          <Metric icon={Archive} label="本次核验" value={briefCount} tone="#E88973" />
        </div>
      </div>
      {source === 'fallback' && (
        <div className="mt-3 rounded-lg border border-[#8A6A2A]/40 bg-[#8A6A2A]/12 px-3 py-2 text-[10px] text-[#D8C18A]">当前历史情报主库不可用或为空，辅助视图显示兜底样例；真实信号与公开来源均按 0 计。</div>
      )}
    </header>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof RadioTower; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2">
      <div className="flex items-center gap-1 text-[8px] uppercase tracking-[0.15em] text-[#6A7299]"><Icon size={9} />{label}</div>
      <div className="mt-1 font-mono text-[16px] font-bold" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function CenterStage({
  view,
  onView,
  signals,
  source,
  selectedId,
  selectedSignal,
  query,
  briefState,
  onSelectSignal,
}: {
  view: JinyiweiAuxView;
  onView: (view: JinyiweiAuxView) => void;
  signals: IntelSignal[];
  source: 'turso' | 'fallback';
  selectedId: string | null;
  selectedSignal: IntelSignal | null;
  query: string;
  briefState: ReturnType<typeof useJinyiweiBrief>;
  onSelectSignal: (id: string) => void;
}) {
  return (
    <section className="flex min-h-[620px] min-w-0 flex-col gap-2" data-testid="jinyiwei-center-stage">
      <div className="hidden md:block"><JinyiweiViewTabs active={view} onChange={onView} /></div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[20px] border border-[#8B1A1A]/28 bg-[#070A12]/94 shadow-[0_28px_90px_rgba(0,0,0,0.52)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(212,168,75,0.055),transparent_38%)]" />
        <div className="relative h-full min-h-0">
          {view === 'scroll' ? (
            <JinyiweiBriefScroll
              query={query}
              brief={briefState.brief}
              phase={briefState.phase}
              error={briefState.error}
              completedAt={briefState.completedAt}
              selectedSignal={selectedSignal}
              signalSource={source}
            />
          ) : (
            <>
              <div className="h-full md:hidden">
                <JinyiweiBriefScroll
                  query={query}
                  brief={briefState.brief}
                  phase={briefState.phase}
                  error={briefState.error}
                  completedAt={briefState.completedAt}
                  selectedSignal={selectedSignal}
                  signalSource={source}
                />
              </div>
              <div className="hidden h-full md:block">
                <JinyiweiAuxViews view={view} signals={signals} source={source} selectedId={selectedId} onSelect={onSelectSignal} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function JinyiweiPage() {
  const { signals, source, isLoading, mutate } = useIntelSignals();
  const selectedId = useAppStore((state) => state.selectedSignalId);
  const selectSignal = useAppStore((state) => state.selectSignal);
  const briefState = useJinyiweiBrief();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<JinyiweiAuxView>('scroll');

  const stats = useMemo(() => countSignalStats(signals, source), [signals, source]);
  const pendingSignals = useMemo(
    () => signals.filter((signal) => signal.credibility === 'low' || signal.credibility === 'medium'),
    [signals],
  );
  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedId) ?? null,
    [selectedId, signals],
  );
  const latestLabel = briefState.brief ? resolveBriefSourceLabel(briefState.brief) : null;

  const runBrief = () => {
    selectSignal(null);
    setView('scroll');
    void briefState.run(query);
  };
  const selectHistoricalSignal = (id: string) => {
    briefState.clear();
    selectSignal(id);
    setView('scroll');
  };

  const evidenceProps = {
    query,
    onQuery: setQuery,
    onRun: runBrief,
    phase: briefState.phase,
    error: briefState.error,
    source,
    stats,
    latestLabel,
    completedAt: briefState.completedAt,
    pendingSignals,
    onSelectSignal: selectHistoricalSignal,
  } as const;

  return (
    <DepartmentPageCanvas
      ariaLabel="锦衣卫密报卷轴三栏"
      bgSrc={assetUrl(JINYIWEI_SCENE)}
      bgAlt="锦衣卫情报场景"
      imageClassName="scale-[1.02] object-cover object-[27%_center] opacity-60 saturate-[0.86] md:object-center"
      overlayClassName="bg-[radial-gradient(ellipse_at_50%_18%,rgba(139,26,26,0.12)_0%,transparent_45%),linear-gradient(90deg,rgba(2,3,10,0.56)_0%,rgba(2,3,10,0.32)_30%,rgba(2,3,10,0.34)_70%,rgba(2,3,10,0.58)_100%)]"
    >
      <DepartmentStage hasLiveStrip={false} className="overflow-y-auto">
        <main className="relative z-10 mx-auto flex w-full max-w-[1840px] flex-col gap-3 px-3 py-3 lg:min-h-[calc(100vh-58px)]">
          <Header signals={signals} source={source} briefCount={briefState.brief?.items.length ?? 0} />

          {isLoading && signals.length === 0 && (
            <div className="rounded-lg border border-white/[0.08] bg-[#05070D]/70 px-3 py-2 text-[10px] text-[#8A92AC]">正在读取历史情报主库…</div>
          )}

          <section className={styles.layout} data-testid="jinyiwei-three-column-layout">
            <div className={styles.composer}>
              <JinyiweiEvidenceRail {...evidenceProps} mode="composer" />
            </div>

            <div className={styles.center}>
              <CenterStage
                view={view}
                onView={setView}
                signals={signals}
                source={source}
                selectedId={selectedId}
                selectedSignal={selectedSignal}
                query={query}
                briefState={briefState}
                onSelectSignal={selectHistoricalSignal}
              />
            </div>

            <div data-testid="jinyiwei-verdict-rail" className={styles.verdict}>
              <JinyiweiVerdictRail brief={briefState.brief} phase={briefState.phase} selectedSignal={selectedSignal} signalSource={source} onRerun={runBrief} />
            </div>

            <div className={styles.status}>
              <JinyiweiEvidenceRail {...evidenceProps} mode="status" />
            </div>

            <div className={`${styles.mobileAux} space-y-2`} data-testid="jinyiwei-mobile-auxiliary">
              <JinyiweiViewTabs active={view} onChange={setView} />
              {view !== 'scroll' && (
                <div className="overflow-hidden rounded-2xl border border-[#8B1A1A]/25 bg-[#070A12]/94">
                  <JinyiweiAuxViews view={view} signals={signals} source={source} selectedId={selectedId} onSelect={selectHistoricalSignal} />
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end">
            <button type="button" onClick={() => void mutate()} className="text-[9px] text-[#59617C] hover:text-[#E88973]">刷新历史情报数据</button>
          </div>
        </main>
      </DepartmentStage>
    </DepartmentPageCanvas>
  );
}
