import { Activity } from 'lucide-react';
import type { IntelSignal } from '@/types/intel';
import { LEVEL_COLOR, MAP_REGIONS, type MapRegion, type ProjectedSignal, type VisualMode } from '../../lib/hero-map-view-model';

function orbitalPoint(lat: number, lng: number): { left: number; top: number; depth: number } {
  const normalizedLng = Math.max(-180, Math.min(180, lng));
  const normalizedLat = Math.max(-70, Math.min(70, lat));
  const lngRadians = (normalizedLng / 180) * Math.PI;
  return {
    left: 50 + (normalizedLng / 180) * 31,
    top: 50 - (normalizedLat / 90) * 28,
    depth: 0.45 + Math.cos(lngRadians) * 0.35,
  };
}

function regionOrbitalPoint(region: MapRegion): { left: number; top: number } {
  const point = orbitalPoint(region.center.lat, region.center.lng);
  return { left: point.left, top: point.top };
}

export function OrbitalIntelGlobe({
  projectedSignals,
  activeRegionId,
  selectedSignalId,
  visualMode,
  onRegion,
  onSignal,
}: {
  projectedSignals: ProjectedSignal[];
  activeRegionId: string | null;
  selectedSignalId: string | null;
  visualMode: VisualMode;
  onRegion: (regionId: string) => void;
  onSignal: (signal: IntelSignal) => void;
}) {
  const lite = visualMode === 'lite';

  return (
    <div
      data-testid="intel-orbital-globe"
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      aria-label="锦衣卫球面情报视图"
    >
      <div
        className="pointer-events-none absolute inset-8 rounded-full border border-[#6BA0FF]/10 opacity-70"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(107,160,255,0.08), rgba(107,160,255,0.01) 58%, transparent 70%)',
        }}
      />
      <div
        className="relative aspect-square rounded-full border border-[#6BA0FF]/20 shadow-[inset_-28px_-28px_70px_rgba(0,0,0,0.46),inset_16px_16px_60px_rgba(107,160,255,0.12),0_0_70px_rgba(74,130,240,0.12)]"
        style={{
          width: 'min(76%, 560px)',
          background:
            'radial-gradient(circle at 35% 28%, rgba(240,198,106,0.13), transparent 20%), radial-gradient(circle at 50% 50%, rgba(15,28,55,0.96), rgba(3,6,14,0.98) 72%)',
        }}
      >
        <div className="pointer-events-none absolute inset-[9%] rounded-full border border-[#6BA0FF]/12" />
        <div className="pointer-events-none absolute inset-[20%] rounded-full border border-[#6BA0FF]/10" />
        <div className="pointer-events-none absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 bg-[#6BA0FF]/12" />
        <div className="pointer-events-none absolute left-[8%] top-1/2 h-px w-[84%] -translate-y-1/2 bg-[#6BA0FF]/12" />
        <div
          className="pointer-events-none absolute left-[12%] top-[24%] h-[52%] w-[76%] rounded-full border border-[#F0C66A]/12"
          style={{ transform: 'rotate(-16deg)' }}
        />
        <div
          className="pointer-events-none absolute left-[16%] top-[14%] h-[72%] w-[68%] rounded-full border border-[#6BA0FF]/10"
          style={{ transform: 'rotate(23deg)' }}
        />

        {MAP_REGIONS.map((region) => {
          const point = regionOrbitalPoint(region);
          const active = activeRegionId === region.id;
          const muted = Boolean(activeRegionId && !active);
          return (
            <button
              key={region.id}
              type="button"
              data-testid={`intel-orbit-region-${region.id}`}
              onClick={() => onRegion(region.id)}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[9px] transition hover:border-[#F0C66A]/60 hover:bg-[#F0C66A]/10"
              style={{
                left: `${point.left}%`,
                top: `${point.top}%`,
                borderColor: active ? 'rgba(240,198,106,0.58)' : 'rgba(255,255,255,0.12)',
                color: active ? '#F0C66A' : region.accent,
                backgroundColor: active ? 'rgba(240,198,106,0.1)' : 'rgba(4,6,14,0.58)',
                opacity: muted ? 0.32 : 0.9,
              }}
              aria-label={`下钻 ${region.label}`}
            >
              {region.shortLabel}
            </button>
          );
        })}

        {projectedSignals.map(({ signal, regionId }) => {
          if (activeRegionId && regionId !== activeRegionId) return null;
          const coordinates = signal.coordinates;
          if (!coordinates) return null;
          const point = orbitalPoint(coordinates.lat, coordinates.lng);
          const selected = selectedSignalId === signal.id;
          const color = LEVEL_COLOR[signal.level];
          const size = selected ? 16 : signal.level === 'critical' ? 14 : 11;
          const urgent = signal.level === 'critical' || signal.level === 'warning';

          return (
            <button
              key={signal.id}
              type="button"
              data-testid={`intel-orbit-signal-${signal.id}`}
              onClick={() => onSignal(signal)}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#F0C66A]"
              style={{
                left: `${point.left}%`,
                top: `${point.top}%`,
                width: size,
                height: size,
                opacity: Math.max(0.48, point.depth),
                backgroundColor: color,
                border: selected ? '2px solid #F0C66A' : '1px solid rgba(4,6,14,0.85)',
                boxShadow: lite
                  ? `0 0 8px ${color}66`
                  : `0 0 14px ${color}AA, 0 0 28px ${color}44`,
              }}
              aria-label={`情报 ${signal.regionLabel} ${signal.title}`}
            >
              {!lite && urgent && (
                <span
                  className="absolute inset-[-7px] rounded-full border animate-breathe"
                  style={{ borderColor: color, opacity: 0.72 }}
                />
              )}
              <span className="sr-only">{signal.title}</span>
            </button>
          );
        })}

        <div className="pointer-events-none absolute bottom-[10%] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-[#F0C66A]/18 bg-[#05070D]/70 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#8F835F]">
          <Activity size={11} />
          ORBITAL WATCH
        </div>
      </div>
    </div>
  );
}
