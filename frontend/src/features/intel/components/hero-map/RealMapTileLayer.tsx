import { MAP_H, MAP_W, MAP_Y_OFFSET, REAL_MAP_TILES, TILE_SIZE, tileUrl } from '../../lib/hero-map-view-model';

export function RealMapTileLayer() {
  return (
    <g data-testid="intel-real-tile-layer" aria-hidden="true">
      <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="#06101A" />
      {REAL_MAP_TILES.map(({ x, y }) => (
        <image
          key={`${x}-${y}`}
          href={tileUrl(x, y)}
          x={x * TILE_SIZE}
          y={y * TILE_SIZE - MAP_Y_OFFSET}
          width={TILE_SIZE}
          height={TILE_SIZE}
          preserveAspectRatio="none"
          opacity="0.78"
          style={{ filter: 'saturate(0.7) contrast(1.12) brightness(0.6)' }}
        />
      ))}
      <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="rgba(3, 7, 14, 0.34)" />
      <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#real-map-vignette)" />
    </g>
  );
}

export function MapTileAttribution() {
  return (
    <a
      data-testid="intel-map-attribution"
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      className="pointer-events-auto absolute bottom-8 right-3 z-30 rounded border border-white/[0.08] bg-[#05070D]/75 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.08em] text-[#8A92AC] backdrop-blur transition hover:border-[#F0C66A]/35 hover:text-[#F0C66A] lg:right-[384px]"
    >
      © OpenStreetMap contributors
    </a>
  );
}
