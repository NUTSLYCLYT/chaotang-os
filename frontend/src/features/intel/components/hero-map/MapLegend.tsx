import type { IntelLevel } from '@/types/intel';
import { LEVEL_COLOR } from '../../lib/hero-map-view-model';

export function MapLegend() {
  const items: { level: IntelLevel; label: string }[] = [
    { level: 'critical', label: '危急' },
    { level: 'warning', label: '警报' },
    { level: 'watch', label: '关注' },
    { level: 'info', label: '情报' },
  ];
  return (
    <div
      className="pointer-events-none absolute bottom-8 left-4 z-20 flex flex-col gap-1.5 rounded border px-2 py-1.5 font-mono text-[9px]"
      style={{
        borderColor: 'rgba(26, 33, 66, 0.8)',
        backgroundColor: 'rgba(4, 6, 14, 0.72)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {items.map(({ level, label }) => (
        <div key={level} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor: LEVEL_COLOR[level],
              boxShadow: `0 0 6px ${LEVEL_COLOR[level]}`,
            }}
          />
          <span style={{ color: LEVEL_COLOR[level] }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
