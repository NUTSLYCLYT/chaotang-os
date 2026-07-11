import { ChevronLeft, Crosshair, Layers3, MapPinned, RadioTower, ShieldAlert } from 'lucide-react';
import type { IntelLevel, IntelSignal } from '@/types/intel';
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  categoryLabel,
  industryTestId,
  levelTone,
  sourceCopy,
  type GroupSummary,
  type MapRegion,
} from '../../lib/hero-map-view-model';

export function MapDrilldownPanel({
  source,
  activeRegion,
  regionGroups,
  countryGroups,
  industryGroups,
  activeCountry,
  activeIndustry,
  finalSignals,
  selectedSignalId,
  onRegion,
  onCountry,
  onIndustry,
  onSignal,
  onReset,
}: {
  source: 'turso' | 'fallback';
  activeRegion: MapRegion | null;
  regionGroups: Array<{ region: MapRegion; signals: IntelSignal[]; count: number; topLevel: IntelLevel }>;
  countryGroups: GroupSummary[];
  industryGroups: GroupSummary[];
  activeCountry: string | null;
  activeIndustry: string | null;
  finalSignals: IntelSignal[];
  selectedSignalId: string | null;
  onRegion: (regionId: string) => void;
  onCountry: (country: string) => void;
  onIndustry: (industry: string | null) => void;
  onSignal: (signal: IntelSignal) => void;
  onReset: () => void;
}) {
  const activeCountryLabel = countryGroups.find((group) => group.key === activeCountry)?.label;
  const stage = activeIndustry ? '信号' : activeCountry ? '产业' : activeRegion ? '国家/地区' : '区域';

  return (
    <aside
      data-testid="intel-map-drilldown"
      className="absolute bottom-[54px] left-3 right-3 z-50 max-h-[46%] overflow-hidden rounded-lg border border-[#F0C66A]/20 bg-[#05070D]/88 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-xl lg:left-auto lg:top-[54px] lg:bottom-[42px] lg:w-[360px] lg:max-h-none"
    >
      <div className="flex h-full min-h-[210px] flex-col">
        <header className="border-b border-white/[0.08] px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-[#8F835F]">
                <MapPinned size={12} />
                锦衣卫级联
              </div>
              <h3 className="mt-1 truncate font-serif text-[17px] font-black text-[#F5E9C9]">
                {activeRegion ? activeRegion.label : '全球总览'}
              </h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#9AA3C4]">
                {activeRegion ? activeRegion.dossier : '按战区汇总外部信号，再下钻到国家、产业和单条证据。'}
              </p>
            </div>
            <span
              className="shrink-0 rounded border px-2 py-1 font-mono text-[9px]"
              style={{
                borderColor: source === 'turso' ? 'rgba(61,214,140,0.35)' : 'rgba(138,106,42,0.45)',
                color: source === 'turso' ? '#3DD68C' : '#D8C18A',
                backgroundColor: source === 'turso' ? 'rgba(61,214,140,0.08)' : 'rgba(138,106,42,0.12)',
              }}
            >
              {sourceCopy(source)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[9px]">
            {['区域', '国家/地区', '产业', '信号'].map((item) => (
              <div
                key={item}
                className="rounded border px-1.5 py-1"
                style={{
                  borderColor: stage === item ? 'rgba(240,198,106,0.52)' : 'rgba(255,255,255,0.07)',
                  color: stage === item ? '#F0C66A' : '#6A7299',
                  backgroundColor: stage === item ? 'rgba(240,198,106,0.08)' : 'rgba(255,255,255,0.025)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-3.5">
          {!activeRegion ? (
            <RegionList groups={regionGroups} onRegion={onRegion} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 rounded border border-[#F0C66A]/24 bg-[#F0C66A]/[0.06] px-2 py-1 text-[10px] text-[#F0C66A] transition hover:bg-[#F0C66A]/10"
                >
                  <ChevronLeft size={11} />
                  全球
                </button>
                <MiniMetric label="信号" value={finalSignals.length} tone={levelTone(finalSignals)} />
                <MiniMetric label="国家/地区" value={countryGroups.length} tone="#6BA0FF" />
                <MiniMetric label="产业" value={industryGroups.length} tone="#3DD68C" />
              </div>

              <CascadeGroup title="国家/地区" icon={Layers3}>
                <div className="grid grid-cols-2 gap-1.5">
                  {countryGroups.map((group) => (
                    <CascadeButton
                      key={group.key}
                      testId={`intel-map-country-${group.key}`}
                      active={activeCountry === group.key}
                      label={group.label}
                      meta={`${group.count} 条`}
                      tone={LEVEL_COLOR[group.topLevel]}
                      onClick={() => onCountry(group.key)}
                    />
                  ))}
                </div>
              </CascadeGroup>

              <CascadeGroup title={activeCountryLabel ? `${activeCountryLabel} · 产业` : '产业'} icon={RadioTower}>
                <div className="grid grid-cols-1 gap-1.5">
                  <CascadeButton
                    testId="intel-map-industry-all"
                    active={!activeIndustry}
                    label="全部产业"
                    meta={`${countryGroups.find((group) => group.key === activeCountry)?.count ?? finalSignals.length} 条`}
                    tone="#9AA3C4"
                    onClick={() => onIndustry(null)}
                  />
                  {industryGroups.map((group) => (
                    <CascadeButton
                      key={group.key}
                      testId={industryTestId(group.key)}
                      active={activeIndustry === group.key}
                      label={group.label}
                      meta={`${group.count} 条`}
                      tone={LEVEL_COLOR[group.topLevel]}
                      onClick={() => onIndustry(group.key)}
                    />
                  ))}
                </div>
              </CascadeGroup>

              <CascadeGroup title={activeIndustry ? `${activeIndustry} · 信号` : '信号'} icon={ShieldAlert}>
                <div className="space-y-1.5">
                  {finalSignals.length === 0 ? (
                    <div className="rounded border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] text-[#8A92AC]">
                      当前筛选下暂无信号。
                    </div>
                  ) : (
                    finalSignals.slice(0, 8).map((signal) => (
                      <button
                        key={signal.id}
                        data-testid={`intel-map-signal-${signal.id}`}
                        type="button"
                        onClick={() => onSignal(signal)}
                        className="group w-full rounded border px-3 py-2 text-left transition hover:bg-white/[0.045]"
                        style={{
                          borderColor:
                            selectedSignalId === signal.id
                              ? 'rgba(240,198,106,0.64)'
                              : 'rgba(255,255,255,0.08)',
                          backgroundColor:
                            selectedSignalId === signal.id ? 'rgba(240,198,106,0.08)' : 'rgba(255,255,255,0.025)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-semibold text-[#EAEEFB]">{signal.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px]">
                              <span style={{ color: LEVEL_COLOR[signal.level] }}>{LEVEL_LABEL[signal.level]}</span>
                              <span className="text-[#6A7299]">{categoryLabel(signal)}</span>
                              <span className="text-[#8F835F]">{signal.credibility}</span>
                            </div>
                          </div>
                          <Crosshair
                            size={12}
                            className="shrink-0 text-[#6A7299] transition group-hover:text-[#F0C66A]"
                          />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CascadeGroup>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function RegionList({
  groups,
  onRegion,
}: {
  groups: Array<{ region: MapRegion; signals: IntelSignal[]; count: number; topLevel: IntelLevel }>;
  onRegion: (regionId: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      {groups.map(({ region, signals, count, topLevel: level }) => (
        <button
          key={region.id}
          type="button"
          onClick={() => onRegion(region.id)}
          className="group flex items-center justify-between gap-3 rounded border px-3 py-2 text-left transition hover:bg-white/[0.045]"
          style={{
            borderColor: count > 0 ? `${LEVEL_COLOR[level]}55` : 'rgba(255,255,255,0.07)',
            backgroundColor: count > 0 ? `${LEVEL_COLOR[level]}0D` : 'rgba(255,255,255,0.025)',
          }}
        >
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-[#F5E9C9]">{region.label}</div>
            <div className="mt-0.5 truncate text-[10px] text-[#8A92AC]">
              {signals[0]?.title ?? region.dossier}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[15px] font-semibold" style={{ color: LEVEL_COLOR[level] }}>
              {count}
            </div>
            <div className="text-[9px] text-[#6A7299]">信号</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function CascadeGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Layers3;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#8F835F]">
        <Icon size={12} />
        {title}
      </div>
      {children}
    </section>
  );
}

function CascadeButton({
  testId,
  active,
  label,
  meta,
  tone,
  onClick,
}: {
  testId: string;
  active: boolean;
  label: string;
  meta: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left transition hover:bg-white/[0.045]"
      style={{
        borderColor: active ? `${tone}88` : 'rgba(255,255,255,0.08)',
        backgroundColor: active ? `${tone}14` : 'rgba(255,255,255,0.025)',
      }}
    >
      <span className="min-w-0 truncate text-[11px]" style={{ color: active ? tone : '#C6CEE6' }}>
        {label}
      </span>
      <span className="shrink-0 font-mono text-[9px] text-[#6A7299]">{meta}</span>
    </button>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-right">
      <div className="text-[9px] text-[#6A7299]">{label}</div>
      <div className="font-mono text-[13px] font-semibold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}
