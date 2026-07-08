/**
 * 朝堂 OS V2 · 锦衣卫 · 全球情报地图
 *
 * 交互层级：
 * 1. 全球战区热区
 * 2. 国家/地区
 * 3. 产业
 * 4. 情报信号详情
 */

'use client';

import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  Activity,
  ChevronLeft,
  Crosshair,
  Gauge,
  Globe2,
  Layers3,
  Map as MapIcon,
  MapPinned,
  RadioTower,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { IntelLevel, IntelSignal } from '@/types/intel';
import { useAppStore } from '@/lib/store/app-store';

const TILE_SIZE = 256;
const REAL_MAP_ZOOM = 2;
const MERCATOR_WORLD_SIZE = TILE_SIZE * 2 ** REAL_MAP_ZOOM;
const MAP_NORTH_LAT = 72;
const MAP_SOUTH_LAT = -58;
const MAP_Y_OFFSET = mercatorWorldY(MAP_NORTH_LAT);
const MAP_W = MERCATOR_WORLD_SIZE;
const MAP_H = mercatorWorldY(MAP_SOUTH_LAT) - MAP_Y_OFFSET;
const REAL_MAP_TILE_TEMPLATE =
  process.env.NEXT_PUBLIC_INTEL_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const REAL_MAP_TILES = Array.from({ length: 2 ** REAL_MAP_ZOOM }, (_, y) =>
  Array.from({ length: 2 ** REAL_MAP_ZOOM }, (_unused, x) => ({ x, y })),
).flat();

type MapViewMode = 'flat' | 'orbital';
type VisualMode = 'full' | 'lite';

const LEVEL_COLOR: Record<IntelLevel, string> = {
  info: '#60A5FA',
  watch: '#F0C66A',
  warning: '#F5A524',
  critical: '#F43F5E',
};

const LEVEL_RADIUS: Record<IntelLevel, number> = {
  info: 5,
  watch: 6,
  warning: 7,
  critical: 9,
};

const LEVEL_WEIGHT: Record<IntelLevel, number> = {
  info: 1,
  watch: 2,
  warning: 3,
  critical: 4,
};

const LEVEL_LABEL: Record<IntelLevel, string> = {
  info: '情报',
  watch: '关注',
  warning: '警报',
  critical: '危急',
};

interface MapRegion {
  id: string;
  label: string;
  shortLabel: string;
  codes: string[];
  bounds: GeoBounds;
  center: { lat: number; lng: number };
  accent: string;
  dossier: string;
}

interface GeoBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

const MAP_REGIONS: MapRegion[] = [
  {
    id: 'north_america',
    label: '北美战区',
    shortLabel: '北美',
    codes: ['US', 'CA', 'MX'],
    bounds: { north: 72, south: 7, west: -170, east: -50 },
    center: { lat: 42, lng: -102 },
    accent: '#6BA0FF',
    dossier: '宏观流动性、AI 算力、关键客户预算与监管风向。',
  },
  {
    id: 'south_america',
    label: '南美战区',
    shortLabel: '南美',
    codes: ['BR', 'AR', 'CL', 'CO', 'PE'],
    bounds: { north: 13, south: -58, west: -82, east: -35 },
    center: { lat: -16, lng: -61 },
    accent: '#3DD68C',
    dossier: '资源、能源、基础设施和新兴市场窗口。',
  },
  {
    id: 'europe',
    label: '欧洲战区',
    shortLabel: '欧洲',
    codes: ['EU', 'UK', 'RU', 'DE', 'FR', 'NL'],
    bounds: { north: 70, south: 35, west: -12, east: 45 },
    center: { lat: 52, lng: 16 },
    accent: '#C084FC',
    dossier: '监管、制裁、金融政策与合规约束。',
  },
  {
    id: 'africa',
    label: '非洲战区',
    shortLabel: '非洲',
    codes: ['AF', 'ZA', 'EG', 'NG', 'KE'],
    bounds: { north: 37, south: -35, west: -20, east: 55 },
    center: { lat: 5, lng: 20 },
    accent: '#7FC9A8',
    dossier: '数字贸易、能源矿产、人口市场和跨境交付。',
  },
  {
    id: 'middle_east',
    label: '中东战区',
    shortLabel: '中东',
    codes: ['ME', 'SA', 'AE', 'IL', 'TR'],
    bounds: { north: 42, south: 12, west: 30, east: 65 },
    center: { lat: 28, lng: 47 },
    accent: '#F5A524',
    dossier: '航运、能源、地缘冲突和供应链保费。',
  },
  {
    id: 'south_asia',
    label: '南亚战区',
    shortLabel: '南亚',
    codes: ['IN', 'PK', 'BD'],
    bounds: { north: 35, south: 5, west: 60, east: 95 },
    center: { lat: 22, lng: 78 },
    accent: '#F0C66A',
    dossier: '资本市场、软件服务、制造迁移和政府采购。',
  },
  {
    id: 'east_asia',
    label: '东亚战区',
    shortLabel: '东亚',
    codes: ['CN', 'JP', 'KR', 'TW', 'HK'],
    bounds: { north: 55, south: 5, west: 95, east: 150 },
    center: { lat: 34, lng: 122 },
    accent: '#F43F5E',
    dossier: '半导体、存储、AI 硬件、出口管制和产能节奏。',
  },
  {
    id: 'southeast_asia',
    label: '东南亚战区',
    shortLabel: '东南亚',
    codes: ['SEA', 'SG', 'ID', 'VN', 'MY', 'TH'],
    bounds: { north: 25, south: -12, west: 92, east: 142 },
    center: { lat: 7, lng: 113 },
    accent: '#3DD68C',
    dossier: '数据中心、制造转移、渠道窗口和本地政策补贴。',
  },
  {
    id: 'oceania',
    label: '大洋洲战区',
    shortLabel: '大洋洲',
    codes: ['AU', 'NZ'],
    bounds: { north: -5, south: -50, west: 110, east: 180 },
    center: { lat: -27, lng: 137 },
    accent: '#9AA3C4',
    dossier: '稀土、矿产、能源出口和盟友供应链约束。',
  },
];

export interface IntelHeroMapProps {
  signals: IntelSignal[];
  height?: number;
  source?: 'turso' | 'fallback';
}

interface ProjectedSignal {
  signal: IntelSignal;
  x: number;
  y: number;
  regionId: string | null;
}

interface GroupSummary {
  key: string;
  label: string;
  count: number;
  critical: number;
  warning: number;
  topLevel: IntelLevel;
  signals: IntelSignal[];
}

interface SweepDelta {
  fresh: number;
  hot: number;
  verified: number;
  regions: number;
  sourceEdges: number;
  topSignal: IntelSignal | null;
  latestAtLabel: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mercatorWorldY(lat: number): number {
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * MERCATOR_WORLD_SIZE;
}

function project(lat: number, lng: number): { x: number; y: number } {
  const safeLng = clamp(lng, -180, 180);
  return {
    x: ((safeLng + 180) / 360) * MERCATOR_WORLD_SIZE,
    y: mercatorWorldY(lat) - MAP_Y_OFFSET,
  };
}

function tileUrl(x: number, y: number): string {
  return REAL_MAP_TILE_TEMPLATE.replace('{z}', String(REAL_MAP_ZOOM))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

function regionRect(region: MapRegion): { x: number; y: number; width: number; height: number } {
  const topLeft = project(region.bounds.north, region.bounds.west);
  const bottomRight = project(region.bounds.south, region.bounds.east);
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);

  return {
    x,
    y,
    width: Math.max(width, 24),
    height: Math.max(height, 24),
  };
}

function regionForSignal(signal: IntelSignal): MapRegion | null {
  return MAP_REGIONS.find((region) => region.codes.includes(signal.region)) ?? null;
}

function topLevel(signals: IntelSignal[]): IntelLevel {
  return signals.reduce<IntelLevel>(
    (top, signal) => (LEVEL_WEIGHT[signal.level] > LEVEL_WEIGHT[top] ? signal.level : top),
    'info',
  );
}

function groupSignals(
  signals: IntelSignal[],
  getKey: (signal: IntelSignal) => string,
  getLabel: (signal: IntelSignal) => string,
): GroupSummary[] {
  const groups = new Map<string, IntelSignal[]>();
  const labels = new Map<string, string>();
  for (const signal of signals) {
    const key = getKey(signal);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(signal);
    labels.set(key, getLabel(signal));
  }

  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      label: labels.get(key) ?? key,
      count: items.length,
      critical: items.filter((item) => item.level === 'critical').length,
      warning: items.filter((item) => item.level === 'warning').length,
      topLevel: topLevel(items),
      signals: items.sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0)),
    }))
    .sort((a, b) => LEVEL_WEIGHT[b.topLevel] - LEVEL_WEIGHT[a.topLevel] || b.count - a.count);
}

function regionSignals(signals: IntelSignal[], region: MapRegion | null): IntelSignal[] {
  if (!region) return signals;
  return signals.filter((signal) => region.codes.includes(signal.region));
}

function levelTone(signals: IntelSignal[]): string {
  return LEVEL_COLOR[topLevel(signals)];
}

function categoryLabel(signal: IntelSignal): string {
  if (signal.category === 'risk') return '风险';
  if (signal.category === 'opportunity') return '机会';
  return '中性';
}

function timestampOf(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function computeSweepDelta(signals: IntelSignal[]): SweepDelta {
  const latestAt = Math.max(0, ...signals.map((signal) => timestampOf(signal.lastUpdatedAt)));
  const cutoff = (latestAt || Date.now()) - 24 * 60 * 60 * 1000;
  const regions = new Set(signals.map((signal) => regionForSignal(signal)?.id ?? signal.region));
  const topSignal =
    signals
      .slice()
      .sort(
        (a, b) =>
          LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] ||
          (b.impactScore ?? 0) - (a.impactScore ?? 0) ||
          timestampOf(b.lastUpdatedAt) - timestampOf(a.lastUpdatedAt),
      )[0] ?? null;

  return {
    fresh: signals.filter((signal) => timestampOf(signal.firstSeenAt) >= cutoff).length,
    hot: signals.filter((signal) => signal.level === 'critical' || signal.level === 'warning').length,
    verified: signals.filter((signal) => signal.credibility === 'verified').length,
    regions: regions.size,
    sourceEdges: signals.reduce((total, signal) => total + signal.sources.length, 0),
    topSignal,
    latestAtLabel: latestAt ? new Date(latestAt).toISOString().slice(11, 16) : '--:--',
  };
}

function sourceCopy(source: 'turso' | 'fallback'): string {
  return source === 'turso' ? '真实情报库' : '兜底演示';
}

function industryTestId(industry: string): string {
  return `intel-map-industry-${encodeURIComponent(industry).replace(/%/g, '')}`;
}

function onRegionKeyDown(event: KeyboardEvent<SVGGElement>, onActivate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
}

export function IntelHeroMap({ signals, height = 460, source = 'fallback' }: IntelHeroMapProps) {
  const selectedSignalId = useAppStore((state) => state.selectedSignalId);
  const selectSignal = useAppStore((state) => state.selectSignal);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>('flat');
  const [visualMode, setVisualMode] = useState<VisualMode>('full');

  const activeRegion = MAP_REGIONS.find((region) => region.id === activeRegionId) ?? null;
  const liteVisuals = visualMode === 'lite';
  const sweepDelta = useMemo(() => computeSweepDelta(signals), [signals]);

  const projectedSignals = useMemo<ProjectedSignal[]>(
    () =>
      signals
        .filter((signal) => signal.coordinates)
        .map((signal) => {
          const point = project(signal.coordinates!.lat, signal.coordinates!.lng);
          return {
            signal,
            ...point,
            regionId: regionForSignal(signal)?.id ?? null,
          };
        }),
    [signals],
  );

  const regionGroups = useMemo(
    () =>
      MAP_REGIONS.map((region) => {
        const scoped = regionSignals(signals, region);
        return { region, signals: scoped, count: scoped.length, topLevel: topLevel(scoped) };
      }).sort((a, b) => LEVEL_WEIGHT[b.topLevel] - LEVEL_WEIGHT[a.topLevel] || b.count - a.count),
    [signals],
  );

  const scopedSignals = useMemo(() => regionSignals(signals, activeRegion), [signals, activeRegion]);
  const countryGroups = useMemo(
    () => groupSignals(scopedSignals, (signal) => signal.region, (signal) => signal.regionLabel),
    [scopedSignals],
  );

  const countrySignals = activeCountry
    ? scopedSignals.filter((signal) => signal.region === activeCountry)
    : scopedSignals;
  const industryGroups = useMemo(
    () => groupSignals(countrySignals, (signal) => signal.industry, (signal) => signal.industry),
    [countrySignals],
  );

  const finalSignals = activeIndustry
    ? countrySignals.filter((signal) => signal.industry === activeIndustry)
    : countrySignals;

  function enterRegion(regionId: string) {
    setActiveRegionId(regionId);
    setActiveCountry(null);
    setActiveIndustry(null);
  }

  function enterSignal(signal: IntelSignal) {
    const region = regionForSignal(signal);
    if (region) setActiveRegionId(region.id);
    setActiveCountry(signal.region);
    setActiveIndustry(signal.industry);
    selectSignal(signal.id);
  }

  function resetRegion() {
    setActiveRegionId(null);
    setActiveCountry(null);
    setActiveIndustry(null);
  }

  return (
    <div
      data-testid="intel-world-map"
      className="relative z-50 w-full overflow-hidden rounded-xl"
      style={{
        height,
        minHeight: height,
        background:
          'radial-gradient(ellipse at center, rgba(15, 20, 40, 0.95) 0%, rgba(4, 6, 14, 1) 80%)',
        border: '1px solid rgba(240, 198, 106, 0.25)',
        boxShadow: '0 0 40px rgba(74, 130, 240, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      <MapCornerMarks />
      <MapHudTopBar
        signalCount={signals.length}
        activeRegion={activeRegion}
        viewMode={viewMode}
        visualMode={visualMode}
        onViewModeChange={setViewMode}
        onVisualModeChange={setVisualMode}
        onReset={resetRegion}
      />
      <MapHudBottomBar source={source} viewMode={viewMode} visualMode={visualMode} />

      <div className="absolute inset-0 lg:right-[372px]">
        {viewMode === 'flat' ? (
          <>
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="h-full w-full transition-transform duration-500"
              preserveAspectRatio="xMidYMid slice"
              aria-label="锦衣卫真实世界情报地图"
            >
              <defs>
                <radialGradient id="active-region-fill" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="rgba(240, 198, 106, 0.18)" />
                  <stop offset="100%" stopColor="rgba(240, 198, 106, 0.04)" />
                </radialGradient>
                <radialGradient id="pulse-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.7" />
                  <stop offset="60%" stopColor="currentColor" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="real-map-vignette" cx="50%" cy="50%" r="72%">
                  <stop offset="0%" stopColor="rgba(3, 8, 16, 0.06)" />
                  <stop offset="68%" stopColor="rgba(3, 8, 16, 0.42)" />
                  <stop offset="100%" stopColor="rgba(3, 6, 14, 0.9)" />
                </radialGradient>
                <filter id="region-glow">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F0C66A" floodOpacity="0.26" />
                </filter>
              </defs>

              <RealMapTileLayer />
              <GridLayer />

              <g>
                {MAP_REGIONS.map((region) => {
                  const scoped = regionSignals(signals, region);
                  const active = activeRegionId === region.id;
                  const muted = Boolean(activeRegionId && !active);
                  const tone = scoped.length > 0 ? levelTone(scoped) : region.accent;
                  const rect = regionRect(region);
                  const labelPoint = project(region.center.lat, region.center.lng);

                  return (
                    <g
                      key={region.id}
                      data-testid={`intel-map-region-${region.id}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`下钻 ${region.label}`}
                      className="cursor-pointer outline-none"
                      onClick={() => enterRegion(region.id)}
                      onKeyDown={(event) => onRegionKeyDown(event, () => enterRegion(region.id))}
                      filter={active ? 'url(#region-glow)' : undefined}
                    >
                      <rect
                        x={rect.x}
                        y={rect.y}
                        width={rect.width}
                        height={rect.height}
                        rx="8"
                        fill={active ? 'url(#active-region-fill)' : `${tone}0F`}
                        stroke={active ? '#F0C66A' : tone}
                        strokeWidth={active ? 1.8 : 0.85}
                        strokeDasharray={active ? undefined : '5 7'}
                        opacity={muted ? 0.22 : scoped.length > 0 ? 0.72 : 0.34}
                      />
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y}
                        textAnchor="middle"
                        fontSize={active ? 14 : 11}
                        fontFamily="var(--font-mono)"
                        fill={active ? '#F0C66A' : tone}
                        opacity={muted ? 0.34 : 0.9}
                        pointerEvents="none"
                      >
                        {region.shortLabel}
                      </text>
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y + 16}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="var(--font-mono)"
                        fill="#8A92AC"
                        opacity={muted ? 0.24 : 0.82}
                        pointerEvents="none"
                      >
                        {scoped.length}
                      </text>
                    </g>
                  );
                })}
              </g>

              <g opacity={liteVisuals ? 0 : activeRegionId ? 0.12 : 0.24}>
                {projectedSignals.map((a, index) => {
                  const next = projectedSignals[(index + 1) % projectedSignals.length];
                  if (!next) return null;
                  return (
                    <line
                      key={`link-${a.signal.id}`}
                      x1={a.x}
                      y1={a.y}
                      x2={next.x}
                      y2={next.y}
                      stroke="#D4A84B"
                      strokeWidth="0.6"
                      strokeDasharray="3 6"
                    />
                  );
                })}
              </g>

              <g>
                {projectedSignals.map(({ signal, x, y, regionId }, index) => {
                  if (activeRegionId && regionId !== activeRegionId) return null;
                  const color = LEVEL_COLOR[signal.level];
                  const radius = LEVEL_RADIUS[signal.level];
                  const selected = selectedSignalId === signal.id;
                  const urgent = signal.level === 'critical' || signal.level === 'warning';

                  return (
                    <g
                      key={signal.id}
                      data-testid={`intel-map-signal-dot-${signal.id}`}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer"
                      style={{ color }}
                      role="button"
                      tabIndex={0}
                      aria-label={`情报 ${signal.regionLabel} ${signal.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        enterSignal(signal);
                      }}
                      onKeyDown={(event) => onRegionKeyDown(event, () => enterSignal(signal))}
                    >
                      {!liteVisuals && <circle r={radius * 4} fill="url(#pulse-glow)" className="animate-breathe" />}
                      {urgent && !liteVisuals && (
                        <>
                          <circle r={radius} fill="none" stroke={color} strokeWidth="1.5" opacity="0.9">
                            <animate
                              attributeName="r"
                              from={radius}
                              to={radius * 5}
                              dur="1.8s"
                              begin={`${(index % 6) * 0.3}s`}
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              from="0.9"
                              to="0"
                              dur="1.8s"
                              begin={`${(index % 6) * 0.3}s`}
                              repeatCount="indefinite"
                            />
                          </circle>
                          <circle r={radius} fill="none" stroke={color} strokeWidth="1.2" opacity="0.7">
                            <animate
                              attributeName="r"
                              from={radius}
                              to={radius * 4}
                              dur="1.8s"
                              begin={`${(index % 6) * 0.3 + 0.6}s`}
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              from="0.7"
                              to="0"
                              dur="1.8s"
                              begin={`${(index % 6) * 0.3 + 0.6}s`}
                              repeatCount="indefinite"
                            />
                          </circle>
                        </>
                      )}
                      {urgent && liteVisuals && (
                        <circle r={radius * 2.4} fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
                      )}
                      <circle r={radius * 2} fill="none" stroke={color} strokeWidth="1" opacity={selected ? 0.9 : 0.5} />
                      <circle
                        r={radius}
                        fill={color}
                        stroke={selected ? '#F0C66A' : 'rgba(4, 6, 14, 0.8)'}
                        strokeWidth={selected ? 2 : 1}
                      />
                      {selected && (
                        <>
                          <line x1="-18" y1="0" x2="-10" y2="0" stroke="#F0C66A" strokeWidth="1.2" />
                          <line x1="10" y1="0" x2="18" y2="0" stroke="#F0C66A" strokeWidth="1.2" />
                          <line x1="0" y1="-18" x2="0" y2="-10" stroke="#F0C66A" strokeWidth="1.2" />
                          <line x1="0" y1="10" x2="0" y2="18" stroke="#F0C66A" strokeWidth="1.2" />
                        </>
                      )}
                      <text
                        x={radius + 8}
                        y={4}
                        fontSize="10"
                        fontFamily="var(--font-mono)"
                        fill={selected ? '#F0C66A' : color}
                        opacity={selected ? 1 : 0.72}
                      >
                        {signal.regionLabel}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            <MapTileAttribution />
          </>
        ) : (
          <OrbitalIntelGlobe
            projectedSignals={projectedSignals}
            activeRegionId={activeRegionId}
            selectedSignalId={selectedSignalId}
            visualMode={visualMode}
            onRegion={enterRegion}
            onSignal={enterSignal}
          />
        )}
      </div>

      <SweepDeltaPanel delta={sweepDelta} source={source} />
      <MapLegend />

      <MapDrilldownPanel
        source={source}
        activeRegion={activeRegion}
        regionGroups={regionGroups}
        countryGroups={countryGroups}
        industryGroups={industryGroups}
        activeCountry={activeCountry}
        activeIndustry={activeIndustry}
        finalSignals={finalSignals}
        selectedSignalId={selectedSignalId}
        onRegion={enterRegion}
        onCountry={(country) => {
          setActiveCountry(country);
          setActiveIndustry(null);
        }}
        onIndustry={setActiveIndustry}
        onSignal={enterSignal}
        onReset={resetRegion}
      />
    </div>
  );
}

function RealMapTileLayer() {
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

function MapTileAttribution() {
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

function GridLayer() {
  const latLines: number[] = [];
  for (let lat = -60; lat <= 60; lat += 30) latLines.push(lat);

  const lngLines: number[] = [];
  for (let lng = -150; lng <= 150; lng += 30) lngLines.push(lng);

  return (
    <g>
      {latLines.map((lat) => {
        const y = project(lat, 0).y;
        return (
          <line
            key={`lat-${lat}`}
            x1="0"
            y1={y}
            x2={MAP_W}
            y2={y}
            stroke="rgba(107, 160, 255, 0.08)"
            strokeWidth="0.5"
            strokeDasharray={lat === 0 ? '0' : '2 3'}
          />
        );
      })}
      {lngLines.map((lng) => {
        const x = project(0, lng).x;
        return (
          <line
            key={`lng-${lng}`}
            x1={x}
            y1="0"
            x2={x}
            y2={MAP_H}
            stroke="rgba(107, 160, 255, 0.08)"
            strokeWidth="0.5"
            strokeDasharray={lng === 0 ? '0' : '2 3'}
          />
        );
      })}
      <rect
        x="0"
        y="0"
        width={MAP_W}
        height={MAP_H}
        fill="none"
        stroke="rgba(107, 160, 255, 0.15)"
        strokeWidth="1"
      />
    </g>
  );
}

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

function OrbitalIntelGlobe({
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

function MapCornerMarks() {
  return (
    <>
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((position) => (
        <div
          key={position}
          className="pointer-events-none absolute h-3 w-3"
          style={{
            top: position.startsWith('top') ? 8 : undefined,
            bottom: position.startsWith('bottom') ? 8 : undefined,
            left: position.endsWith('left') ? 8 : undefined,
            right: position.endsWith('right') ? 8 : undefined,
            borderColor: '#F0C66A',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            opacity: 0.7,
            borderTop: position.startsWith('bottom') ? 'none' : undefined,
            borderBottom: position.startsWith('top') ? 'none' : undefined,
            borderLeft: position.endsWith('right') ? 'none' : undefined,
            borderRight: position.endsWith('left') ? 'none' : undefined,
          }}
        />
      ))}
    </>
  );
}

function MapHudTopBar({
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

function MapHudBottomBar({
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

function SweepDeltaPanel({ delta, source }: { delta: SweepDelta; source: 'turso' | 'fallback' }) {
  const items = [
    { label: '本轮新增', value: `+${delta.fresh}`, tone: '#F0C66A' },
    { label: '热信号', value: delta.hot, tone: '#F43F5E' },
    { label: '已核', value: delta.verified, tone: '#3DD68C' },
    { label: '区域', value: delta.regions, tone: '#6BA0FF' },
  ];

  return (
    <section
      data-testid="intel-sweep-delta"
      className="pointer-events-none absolute left-4 top-[54px] z-20 hidden w-[212px] rounded-lg border border-[#F0C66A]/16 bg-[#05070D]/72 p-3 font-mono shadow-[0_16px_48px_rgba(0,0,0,0.28)] backdrop-blur lg:block"
    >
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.18em] text-[#8F835F]">
        <span className="inline-flex items-center gap-1.5">
          <Zap size={11} />
          巡检变化
        </span>
        <span style={{ color: source === 'turso' ? '#3DD68C' : '#8A6A2A' }}>{delta.latestAtLabel}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="rounded border border-white/[0.07] bg-white/[0.025] px-2 py-1.5">
            <div className="text-[8px] uppercase tracking-[0.12em] text-[#5D668C]">{item.label}</div>
            <div className="mt-0.5 text-[14px] font-semibold" style={{ color: item.tone }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded border border-white/[0.07] bg-black/15 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.14em] text-[#5D668C]">
          <span>来源</span>
          <span>{delta.sourceEdges}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#BFC7DD]">
          {delta.topSignal?.title ?? '等待新情报信号接入。'}
        </div>
      </div>
    </section>
  );
}

function MapLegend() {
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

function MapDrilldownPanel({
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
