/**
 * 观天台 · 天气 + 24 节气
 */

'use client';

import {
  Cloud,
  CloudRain,
  Sun as SunIcon,
  CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  AlertTriangle,
  MapPin,
  Sunrise,
  Sunset,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

const GOLD = '#F0C66A';
const CYAN = '#5EEAD4';

interface CityWeather {
  city: string;
  icon: LucideIcon;
  condition: string;
  temp: number;
  range: string;
  aqi: number;
  wind: string;
  humidity: number;
  sunrise: string;
  sunset: string;
  tint: string;
}

const CITIES: CityWeather[] = [
  { city: '北京',   icon: SunIcon,   condition: '晴',    temp: 19, range: '9 / 21',  aqi: 68,  wind: '北风 2 级', humidity: 32, sunrise: '05:38', sunset: '18:52', tint: '#F0C66A' },
  { city: '上海',   icon: Cloud,     condition: '多云',  temp: 21, range: '16 / 24', aqi: 52,  wind: '东风 3 级', humidity: 64, sunrise: '05:12', sunset: '18:28', tint: '#6BA0FF' },
  { city: '深圳',   icon: CloudRain, condition: '阵雨',  temp: 25, range: '23 / 29', aqi: 38,  wind: '东南风 3 级', humidity: 82, sunrise: '05:50', sunset: '18:35', tint: '#3DD68C' },
  { city: '成都',   icon: Cloud,     condition: '阴',    temp: 17, range: '14 / 20', aqi: 85,  wind: '微风',     humidity: 78, sunrise: '06:05', sunset: '19:02', tint: '#F5A524' },
  { city: '杭州',   icon: CloudRain, condition: '小雨',  temp: 18, range: '14 / 20', aqi: 44,  wind: '东北风 2 级', humidity: 88, sunrise: '05:20', sunset: '18:33', tint: '#B794F4' },
  { city: '香港',   icon: Cloud,     condition: '多云转晴', temp: 26, range: '24 / 29', aqi: 35, wind: '东风 4 级', humidity: 75, sunrise: '05:56', sunset: '18:40', tint: '#5EEAD4' },
];

const SOLAR_TERMS = [
  '立春','雨水','惊蛰','春分','清明','谷雨',
  '立夏','小满','芒种','夏至','小暑','大暑',
  '立秋','处暑','白露','秋分','寒露','霜降',
  '立冬','小雪','大雪','冬至','小寒','大寒',
];
const CURRENT_TERM_INDEX = 4; // 清明

interface Alert {
  level: 'blue' | 'yellow' | 'orange' | 'red';
  type: string;
  region: string;
  detail: string;
}

const ALERTS: Alert[] = [
  { level: 'yellow', type: '沙尘',       region: '华北北部',   detail: '未来 24h PM10 >300 · 减少户外' },
  { level: 'orange', type: '暴雨',       region: '华南沿海',   detail: '24h 累计降水 100-250 mm · 注意地质灾害' },
  { level: 'blue',   type: '大风',       region: '黄渤海',     detail: '海上 7-8 级大风 · 渔船避风' },
];

const ALERT_COLOR: Record<Alert['level'], string> = {
  blue: '#6BA0FF',
  yellow: '#F0C66A',
  orange: '#FB923C',
  red: '#F43F5E',
};

export function WeatherBoard() {
  return (
    <div className="space-y-5">
      <GlassPanel variant="gold" tone="elevated" padding="md">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(107,160,255,0.25), rgba(240,198,106,0.1))',
              border: '1px solid rgba(107,160,255,0.5)',
            }}
          >
            <Cloud size={17} className="text-[#6BA0FF]" />
          </div>
          <div>
            <div className="page-eyebrow">Weather · 天气与节气</div>
            <h2 className="mt-1 text-[20px] font-semibold text-[#F5E9C9]">
              六城天气 · 24 节气 · 极端预警
            </h2>
            <div className="mt-1 text-[11px] text-[#9AA3C4]">
              今日节气 · <span style={{ color: GOLD }}>{SOLAR_TERMS[CURRENT_TERM_INDEX]}</span> · 桐始华、田鼠化鴽、虹始见
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* 6 城市 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CITIES.map((c) => (
          <CityCard key={c.city} w={c} />
        ))}
      </div>

      {/* 节气轮 + 预警 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_1fr]">
        <SolarTermWheel />
        <AlertsPanel />
      </div>
    </div>
  );
}

/* ========================================================================== */

function CityCard({ w }: { w: CityWeather }) {
  const Icon = w.icon;
  const aqiColor =
    w.aqi <= 50 ? '#3DD68C' : w.aqi <= 100 ? '#F0C66A' : w.aqi <= 150 ? '#FB923C' : '#F43F5E';
  const aqiLabel =
    w.aqi <= 50 ? '优' : w.aqi <= 100 ? '良' : w.aqi <= 150 ? '轻度污染' : '中度污染';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        borderColor: `${w.tint}44`,
        background: `linear-gradient(160deg, ${w.tint}12, rgba(20,22,30,0.7))`,
        boxShadow: `0 4px 20px ${w.tint}10`,
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 opacity-15">
        <Icon size={120} style={{ color: w.tint }} strokeWidth={0.7} />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin size={11} style={{ color: w.tint }} />
          <span className="text-[14px] font-semibold text-[#F5E9C9]">{w.city}</span>
        </div>
        <div
          className="rounded-full border px-2 py-0.5 text-[10px]"
          style={{
            borderColor: `${aqiColor}55`,
            background: `${aqiColor}14`,
            color: aqiColor,
          }}
        >
          AQI {w.aqi} · {aqiLabel}
        </div>
      </div>

      <div className="relative mt-3 flex items-end gap-3">
        <Icon size={42} style={{ color: w.tint }} />
        <div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[38px] font-bold" style={{ color: '#F5E9C9' }}>
              {w.temp}
            </span>
            <span className="text-[14px] text-[#9AA3C4]">°C</span>
          </div>
          <div className="text-[11px]" style={{ color: w.tint }}>
            {w.condition} · {w.range}°
          </div>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <Chip icon={Wind} label={w.wind} />
        <Chip icon={Droplets} label={`湿度 ${w.humidity}%`} />
        <Chip icon={Sunrise} label={w.sunrise} />
        <Chip icon={Sunset} label={w.sunset} />
      </div>
    </div>
  );
}

function Chip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[#C8CDD8]">
      <Icon size={10} className="text-[#9AA3C4]" />
      <span>{label}</span>
    </div>
  );
}

/* ========================================================================== */

function SolarTermWheel() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(240,198,106,0.12), transparent 60%)' }}
      />
      <div className="relative mb-3 flex items-center gap-2">
        <Thermometer size={14} style={{ color: GOLD }} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
            24 Solar Terms · 二十四节气
          </div>
          <h3 className="text-[16px] font-semibold text-[#F5E9C9]">
            当前 <span style={{ color: GOLD }}>{SOLAR_TERMS[CURRENT_TERM_INDEX]}</span> · 第 {CURRENT_TERM_INDEX + 1} / 24
          </h3>
        </div>
      </div>

      <div className="relative flex justify-center rounded-2xl border border-white/8 bg-black/45 p-4">
        <svg viewBox="-200 -200 400 400" className="h-[360px] w-[360px]">
          <defs>
            <radialGradient id="termCore" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#FFFDF0" />
              <stop offset="60%" stopColor={GOLD} stopOpacity="0.4" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 外环 */}
          <circle r="170" fill="none" stroke={GOLD} strokeWidth="0.8" opacity="0.35" />
          <circle r="135" fill="none" stroke={GOLD} strokeWidth="0.5" opacity="0.25" strokeDasharray="2 4" />
          <circle r="70" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.3" />

          {/* 四季分隔线 */}
          {[0, 6, 12, 18].map((startIdx) => {
            const angle = (startIdx / 24) * 2 * Math.PI - Math.PI / 2;
            return (
              <line
                key={startIdx}
                x1={0}
                y1={0}
                x2={Math.cos(angle) * 165}
                y2={Math.sin(angle) * 165}
                stroke={GOLD}
                strokeWidth="0.5"
                opacity="0.3"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* 24 节气 */}
          {SOLAR_TERMS.map((term, i) => {
            const angle = (i / 24) * 2 * Math.PI - Math.PI / 2;
            const r = 155;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            const isActive = i === CURRENT_TERM_INDEX;
            return (
              <g key={term}>
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 14 : 8}
                  fill={isActive ? `${GOLD}30` : 'rgba(30,30,50,0.35)'}
                  stroke={isActive ? GOLD : `${GOLD}77`}
                  strokeWidth={isActive ? 1.4 : 0.6}
                >
                  {isActive && (
                    <animate attributeName="r" values="12;16;12" dur="2.5s" repeatCount="indefinite" />
                  )}
                </circle>
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize={isActive ? 10 : 9}
                  fontWeight={isActive ? 700 : 500}
                  fill={isActive ? '#F5E9C9' : GOLD}
                >
                  {term}
                </text>
              </g>
            );
          })}

          {/* 四季大字 */}
          {['春', '夏', '秋', '冬'].map((s, i) => {
            const angle = ((i * 6 + 3) / 24) * 2 * Math.PI - Math.PI / 2;
            const r = 100;
            const colors = ['#3DD68C', '#F43F5E', '#F0C66A', '#6BA0FF'];
            return (
              <text
                key={s}
                x={Math.cos(angle) * r}
                y={Math.sin(angle) * r + 10}
                textAnchor="middle"
                fontSize="28"
                fontWeight="700"
                fill={colors[i]}
                opacity="0.38"
              >
                {s}
              </text>
            );
          })}

          {/* 中心 */}
          <circle r="40" fill="url(#termCore)" />
          <text y="-3" textAnchor="middle" fontSize="10" fill={GOLD} opacity="0.8">
            节气
          </text>
          <text y="12" textAnchor="middle" fontSize="13" fontWeight="700" fill="#F5E9C9">
            {SOLAR_TERMS[CURRENT_TERM_INDEX]}
          </text>
        </svg>
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

function AlertsPanel() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 100% 100%, rgba(244,63,94,0.1), transparent 55%)' }}
      />
      <div className="relative mb-3 flex items-center gap-2">
        <AlertTriangle size={14} style={{ color: '#F43F5E' }} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: '#F43F5E' }}>
            Extreme Weather Alerts · 极端天气预警
          </div>
          <h3 className="text-[16px] font-semibold text-[#F5E9C9]">
            今日预警 · {ALERTS.length} 条
          </h3>
        </div>
      </div>

      <div className="relative space-y-3">
        {ALERTS.map((a) => {
          const color = ALERT_COLOR[a.level];
          return (
            <div
              key={a.type + a.region}
              className="flex items-start gap-3 rounded-xl border p-3"
              style={{
                borderColor: `${color}55`,
                background: `${color}0d`,
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold"
                style={{
                  background: `${color}22`,
                  border: `1px solid ${color}66`,
                  color,
                }}
              >
                {a.level === 'red' ? '红' : a.level === 'orange' ? '橙' : a.level === 'yellow' ? '黄' : '蓝'}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] font-semibold" style={{ color: '#F5E9C9' }}>
                    {a.type}预警
                  </div>
                  <span className="text-[10px]" style={{ color }}>
                    {a.region}
                  </span>
                </div>
                <div className="mt-1 text-[11px] leading-6 text-[#C8CDD8]">{a.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="relative mt-3 rounded-xl border p-3"
        style={{ borderColor: `${CYAN}55`, background: `${CYAN}0a` }}
      >
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: CYAN }}>
          钦天监小识
        </div>
        <p className="mt-2 text-[11px] leading-6 text-[#C8CDD8]">
          清明时节，雨渐多 · 阳气初发而未盛。宜动不宜静，宜阳不宜阴。
          供应链与海上业务注意华南暴雨与渤海大风，两路同防。
        </p>
      </div>
    </GlassPanel>
  );
}
