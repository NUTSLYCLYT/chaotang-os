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

import { useMemo, useState } from 'react';
import type { IntelSignal } from '@/types/intel';
import { useAppStore } from '@/lib/store/app-store';
import {
  LEVEL_COLOR,
  LEVEL_RADIUS,
  LEVEL_WEIGHT,
  MAP_H,
  MAP_REGIONS,
  MAP_W,
  computeSweepDelta,
  groupSignals,
  onRegionKeyDown,
  project,
  regionForSignal,
  regionRect,
  regionSignals,
  topLevel,
  levelTone,
  type MapViewMode,
  type ProjectedSignal,
  type VisualMode,
} from '../lib/hero-map-view-model';
import { GridLayer } from './hero-map/GridLayer';
import { MapCornerMarks } from './hero-map/MapCornerMarks';
import { MapDrilldownPanel } from './hero-map/MapDrilldownPanel';
import { MapHudBottomBar } from './hero-map/MapHudBottomBar';
import { MapHudTopBar } from './hero-map/MapHudTopBar';
import { MapLegend } from './hero-map/MapLegend';
import { MapTileAttribution, RealMapTileLayer } from './hero-map/RealMapTileLayer';
import { OrbitalIntelGlobe } from './hero-map/OrbitalIntelGlobe';
import { SweepDeltaPanel } from './hero-map/SweepDeltaPanel';

export interface IntelHeroMapProps {
  signals: IntelSignal[];
  height?: number;
  source?: 'turso' | 'fallback';
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
