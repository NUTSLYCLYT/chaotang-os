import type { KeyboardEvent } from 'react';
import type { IntelLevel, IntelSignal } from '@/types/intel';

export const TILE_SIZE = 256;
export const REAL_MAP_ZOOM = 2;
export const MERCATOR_WORLD_SIZE = TILE_SIZE * 2 ** REAL_MAP_ZOOM;
export const MAP_NORTH_LAT = 72;
export const MAP_SOUTH_LAT = -58;
export const MAP_Y_OFFSET = mercatorWorldY(MAP_NORTH_LAT);
export const MAP_W = MERCATOR_WORLD_SIZE;
export const MAP_H = mercatorWorldY(MAP_SOUTH_LAT) - MAP_Y_OFFSET;
export const REAL_MAP_TILE_TEMPLATE =
  process.env.NEXT_PUBLIC_INTEL_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const REAL_MAP_TILES = Array.from({ length: 2 ** REAL_MAP_ZOOM }, (_, y) =>
  Array.from({ length: 2 ** REAL_MAP_ZOOM }, (_unused, x) => ({ x, y })),
).flat();

export type MapViewMode = 'flat' | 'orbital';
export type VisualMode = 'full' | 'lite';

export const LEVEL_COLOR: Record<IntelLevel, string> = {
  info: '#60A5FA',
  watch: '#F0C66A',
  warning: '#F5A524',
  critical: '#F43F5E',
};

export const LEVEL_RADIUS: Record<IntelLevel, number> = {
  info: 5,
  watch: 6,
  warning: 7,
  critical: 9,
};

export const LEVEL_WEIGHT: Record<IntelLevel, number> = {
  info: 1,
  watch: 2,
  warning: 3,
  critical: 4,
};

export const LEVEL_LABEL: Record<IntelLevel, string> = {
  info: '情报',
  watch: '关注',
  warning: '警报',
  critical: '危急',
};

export interface GeoBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

export interface MapRegion {
  id: string;
  label: string;
  shortLabel: string;
  codes: string[];
  bounds: GeoBounds;
  center: { lat: number; lng: number };
  accent: string;
  dossier: string;
}

export const MAP_REGIONS: MapRegion[] = [
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

export interface ProjectedSignal {
  signal: IntelSignal;
  x: number;
  y: number;
  regionId: string | null;
}

export interface GroupSummary {
  key: string;
  label: string;
  count: number;
  critical: number;
  warning: number;
  topLevel: IntelLevel;
  signals: IntelSignal[];
}

export interface SweepDelta {
  fresh: number;
  hot: number;
  verified: number;
  regions: number;
  sourceEdges: number;
  topSignal: IntelSignal | null;
  latestAtLabel: string;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mercatorWorldY(lat: number): number {
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * MERCATOR_WORLD_SIZE;
}

export function project(lat: number, lng: number): { x: number; y: number } {
  const safeLng = clamp(lng, -180, 180);
  return {
    x: ((safeLng + 180) / 360) * MERCATOR_WORLD_SIZE,
    y: mercatorWorldY(lat) - MAP_Y_OFFSET,
  };
}

export function tileUrl(x: number, y: number): string {
  return REAL_MAP_TILE_TEMPLATE.replace('{z}', String(REAL_MAP_ZOOM))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

export function regionRect(region: MapRegion): { x: number; y: number; width: number; height: number } {
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

export function regionForSignal(signal: IntelSignal): MapRegion | null {
  return MAP_REGIONS.find((region) => region.codes.includes(signal.region)) ?? null;
}

export function topLevel(signals: IntelSignal[]): IntelLevel {
  return signals.reduce<IntelLevel>(
    (top, signal) => (LEVEL_WEIGHT[signal.level] > LEVEL_WEIGHT[top] ? signal.level : top),
    'info',
  );
}

export function groupSignals(
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

export function regionSignals(signals: IntelSignal[], region: MapRegion | null): IntelSignal[] {
  if (!region) return signals;
  return signals.filter((signal) => region.codes.includes(signal.region));
}

export function levelTone(signals: IntelSignal[]): string {
  return LEVEL_COLOR[topLevel(signals)];
}

export function categoryLabel(signal: IntelSignal): string {
  if (signal.category === 'risk') return '风险';
  if (signal.category === 'opportunity') return '机会';
  return '中性';
}

export function timestampOf(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function computeSweepDelta(signals: IntelSignal[]): SweepDelta {
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

export function sourceCopy(source: 'turso' | 'fallback'): string {
  return source === 'turso' ? '真实情报库' : '兜底演示';
}

export function industryTestId(industry: string): string {
  return `intel-map-industry-${encodeURIComponent(industry).replace(/%/g, '')}`;
}

export function onRegionKeyDown(event: KeyboardEvent<SVGGElement>, onActivate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onActivate();
  }
}
