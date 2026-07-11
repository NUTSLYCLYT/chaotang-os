import { Activity, ChevronLeft, Gauge, Globe2, Layers3, Map as MapIcon } from 'lucide-react';
import type { MapRegion, MapViewMode, VisualMode } from '../../lib/hero-map-view-model';

export function MapHudTopBar({
  signalCount,
  activeRegion,
  viewMode,
  visualMode,
  onViewModeChange,
  onVisualModeChange,
  onReset,
}: {
  signalCount: number;
  activeRegion: MapRegion | null;
  viewMode: MapViewMode;
  visualMode: VisualMode;
  onViewModeChange: (mode: MapViewMode) => void;
  onVisualModeChange: (mode: VisualMode) => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-3 font-mono text-[9px] text-[#6BA0FF]">
      <div className="flex min-w-0 items-center gap-2">
        {activeRegion && (
          <button
            type="button"
            onClick={onReset}
            className="pointer-events-auto inline-grid h-6 w-6 place-items-center rounded border border-[#F0C66A]/35 bg-[#05070D]/80 text-[#F0C66A] transition hover:bg-[#F0C66A]/10"
            aria-label="返回全球总览"
            title="返回全球总览"
          >
            <ChevronLeft size={13} />
          </button>
        )}
        <span className="truncate tracking-wider">
          锦衣卫实时监控{activeRegion ? ` · ${activeRegion.label}` : ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden shrink-0 tracking-wider xl:inline">
          活跃信号 <span className="text-[#F0C66A]">{signalCount}</span> · 真实 OSM 地图瓦片
        </span>
        <div className="pointer-events-auto hidden items-center gap-1 rounded border border-white/[0.08] bg-[#05070D]/78 p-0.5 backdrop-blur sm:flex">
          <HudToggle
            testId="intel-map-view-flat"
            active={viewMode === 'flat'}
            label="平图"
            icon={MapIcon}
            onClick={() => onViewModeChange('flat')}
          />
          <HudToggle
            testId="intel-map-view-orbital"
            active={viewMode === 'orbital'}
            label="球面"
            icon={Globe2}
            onClick={() => onViewModeChange('orbital')}
          />
        </div>
        <div className="pointer-events-auto hidden items-center gap-1 rounded border border-white/[0.08] bg-[#05070D]/78 p-0.5 backdrop-blur md:flex">
          <HudToggle
            testId="intel-visual-mode-full"
            active={visualMode === 'full'}
            label="完整"
            icon={Activity}
            onClick={() => onVisualModeChange('full')}
          />
          <HudToggle
            testId="intel-visual-mode-lite"
            active={visualMode === 'lite'}
            label="轻量"
            icon={Gauge}
            onClick={() => onVisualModeChange('lite')}
          />
        </div>
      </div>
    </div>
  );
}

function HudToggle({
  testId,
  active,
  label,
  icon: Icon,
  onClick,
}: {
  testId: string;
  active: boolean;
  label: string;
  icon: typeof Layers3;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center gap-1 rounded px-1.5 transition hover:bg-white/[0.055]"
      style={{
        color: active ? '#F0C66A' : '#6BA0FF',
        backgroundColor: active ? 'rgba(240,198,106,0.11)' : 'transparent',
      }}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <Icon size={11} />
      <span>{label}</span>
    </button>
  );
}
