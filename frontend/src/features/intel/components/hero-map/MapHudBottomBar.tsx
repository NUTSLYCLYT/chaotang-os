import { sourceCopy, type MapViewMode, type VisualMode } from '../../lib/hero-map-view-model';

export function MapHudBottomBar({
  source,
  viewMode,
  visualMode,
}: {
  source: 'turso' | 'fallback';
  viewMode: MapViewMode;
  visualMode: VisualMode;
}) {
  const live = source === 'turso';
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 pb-3 font-mono text-[9px] text-[#484F72]">
      <span>
        投影：{viewMode === 'flat' ? '网络墨卡托' : '球面'} · 显示：{visualMode === 'full' ? '完整' : '轻量'}
      </span>
      <span style={{ color: live ? '#3DD68C' : '#8A6A2A' }}>{sourceCopy(source)}</span>
      <span className="hidden sm:inline">{new Date().toUTCString().slice(0, 16)}</span>
    </div>
  );
}
