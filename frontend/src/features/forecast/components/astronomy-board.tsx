/**
 * 观天台 · 星象 · 黄道十二宫 + 今夜天象 + 月相
 */

'use client';

import { useMemo } from 'react';
import { Telescope, Moon, Sun, Orbit, Sparkles, Clock } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { CelestialChart } from './celestial-chart';
import type { ForecastScenario } from '@/types/forecast';

const GOLD = '#F0C66A';
const PURPLE = '#B794F4';
const SILVER = '#E8E8F0';

const ZODIAC_12 = [
  { name: '白羊', en: 'Aries',        symbol: '♈', tint: '#F43F5E' },
  { name: '金牛', en: 'Taurus',       symbol: '♉', tint: '#3DD68C' },
  { name: '双子', en: 'Gemini',       symbol: '♊', tint: '#F0C66A' },
  { name: '巨蟹', en: 'Cancer',       symbol: '♋', tint: '#E8E8F0' },
  { name: '狮子', en: 'Leo',          symbol: '♌', tint: '#FB923C' },
  { name: '处女', en: 'Virgo',        symbol: '♍', tint: '#6BA0FF' },
  { name: '天秤', en: 'Libra',        symbol: '♎', tint: '#F472B6' },
  { name: '天蝎', en: 'Scorpio',      symbol: '♏', tint: '#B794F4' },
  { name: '射手', en: 'Sagittarius',  symbol: '♐', tint: '#F0C66A' },
  { name: '摩羯', en: 'Capricorn',    symbol: '♑', tint: '#6A7299' },
  { name: '水瓶', en: 'Aquarius',     symbol: '♒', tint: '#5EEAD4' },
  { name: '双鱼', en: 'Pisces',       symbol: '♓', tint: '#B794F4' },
];

/** 今日太阳宫（示意：双鱼） */
const TODAY_SUN_SIGN = 7;

interface Event {
  icon: typeof Moon;
  name: string;
  time: string;
  tone: 'rare' | 'common';
  detail: string;
}

const TONIGHT_EVENTS: Event[] = [
  {
    icon: Moon,
    name: '盈凸月',
    time: '18:42 升起 · 04:28 落下',
    tone: 'common',
    detail: '月龄 11.6 · 月盘 86% · 今夜易见于东南方',
  },
  {
    icon: Sparkles,
    name: '水星西大距',
    time: '今晨 05:12',
    tone: 'rare',
    detail: '水星达到最大西距角 · 日出前东南方 30 分钟窗口',
  },
  {
    icon: Orbit,
    name: '木土相合',
    time: '明日 03:24 极近',
    tone: 'rare',
    detail: '角距 ≈ 0.8° · 小望远镜可同视场观测',
  },
  {
    icon: Sparkles,
    name: '宝瓶座流星雨',
    time: '活跃期 · 峰值 5/5',
    tone: 'common',
    detail: '辐射点在东方 · ZHR≈30 · 新月期观测优',
  },
];

export interface AstronomyBoardProps {
  scenarios: ForecastScenario[];
}

export function AstronomyBoard({ scenarios }: AstronomyBoardProps) {
  return (
    <div className="space-y-5">
      <GlassPanel variant="gold" tone="elevated" padding="md">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(183,148,244,0.28), rgba(240,198,106,0.08))',
              border: `1px solid ${PURPLE}66`,
            }}
          >
            <Telescope size={17} style={{ color: PURPLE }} />
          </div>
          <div>
            <div className="page-eyebrow">Astronomy · 星象</div>
            <h2 className="mt-1 text-[20px] font-semibold text-[#F5E9C9]">
              天象盘 · 黄道十二宫 · 今夜可观
            </h2>
            <div className="mt-1 text-[11px] text-[#9AA3C4]">
              与群策/玄机互参 · 人事顺天时则事半功倍
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* 天象盘（主） */}
      <CelestialChart scenarios={scenarios} />

      {/* 黄道 + 今夜 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.05fr]">
        <ZodiacWheel />
        <TonightEvents />
      </div>
    </div>
  );
}

/* ========================================================================== */

function ZodiacWheel() {
  const stars = useMemo(() => {
    const rng = mulberry32(13);
    return Array.from({ length: 40 }).map(() => ({
      x: (rng() - 0.5) * 400,
      y: (rng() - 0.5) * 400,
      r: rng() * 0.8 + 0.3,
      d: rng() * 3 + 2,
    }));
  }, []);

  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(183,148,244,0.12), transparent 60%)',
        }}
      />
      <div className="relative mb-3 flex items-center gap-2">
        <Sun size={14} style={{ color: GOLD }} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
            Zodiac · 黄道十二宫
          </div>
          <h3 className="text-[16px] font-semibold text-[#F5E9C9]">
            今日太阳过 <span style={{ color: ZODIAC_12[TODAY_SUN_SIGN]!.tint }}>
              {ZODIAC_12[TODAY_SUN_SIGN]!.symbol} {ZODIAC_12[TODAY_SUN_SIGN]!.name}座
            </span>
          </h3>
        </div>
      </div>

      <div className="relative flex justify-center rounded-2xl border border-white/8 bg-black/45 p-4">
        <svg viewBox="-200 -200 400 400" className="h-[380px] w-[380px]">
          <defs>
            <radialGradient id="zodiacCore" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#FFFDF0" />
              <stop offset="60%" stopColor={GOLD} stopOpacity="0.55" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
            </radialGradient>
            <filter id="zStar" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.8" />
            </filter>
          </defs>

          {/* 星点背景 */}
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={SILVER} opacity="0.45">
              <animate attributeName="opacity" values="0.15;0.6;0.15" dur={`${s.d}s`} repeatCount="indefinite" />
            </circle>
          ))}

          {/* 黄道带 · 斜椭圆 */}
          <ellipse
            rx="170"
            ry="55"
            fill="none"
            stroke={PURPLE}
            strokeWidth="0.9"
            strokeDasharray="3 4"
            opacity="0.55"
            transform="rotate(15)"
          />

          {/* 主环 */}
          <circle r="160" fill="none" stroke={GOLD} strokeWidth="0.8" opacity="0.35" />
          <circle r="125" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.25" strokeDasharray="2 4" />
          <circle r="80"  fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.3" />

          {/* 十二宫 */}
          {ZODIAC_12.map((z, i) => {
            const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * 145;
            const y = Math.sin(angle) * 145;
            const isActive = i === TODAY_SUN_SIGN;
            return (
              <g key={z.name}>
                {/* 宫位槽 */}
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 22 : 16}
                  fill={isActive ? `${z.tint}22` : 'rgba(30,30,50,0.35)'}
                  stroke={z.tint}
                  strokeWidth={isActive ? 1.4 : 0.6}
                  opacity={isActive ? 0.95 : 0.7}
                  filter={isActive ? 'url(#zStar)' : undefined}
                >
                  {isActive && (
                    <animate attributeName="r" values="20;25;20" dur="3s" repeatCount="indefinite" />
                  )}
                </circle>
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize={isActive ? 20 : 14}
                  fontWeight="700"
                  fill={isActive ? z.tint : SILVER}
                  opacity={isActive ? 1 : 0.75}
                >
                  {z.symbol}
                </text>
                <text
                  x={Math.cos(angle) * 178}
                  y={Math.sin(angle) * 178 + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isActive ? z.tint : '#9AA3C4'}
                  style={{
                    paintOrder: 'stroke',
                    stroke: 'rgba(0,0,0,0.8)',
                    strokeWidth: '2px',
                  }}
                >
                  {z.name}
                </text>
              </g>
            );
          })}

          {/* 太阳 · 在激活宫位上 */}
          {(() => {
            const angle = (TODAY_SUN_SIGN / 12) * 2 * Math.PI - Math.PI / 2;
            const r = 145;
            return (
              <g transform={`translate(${Math.cos(angle) * r}, ${Math.sin(angle) * r})`}>
                <circle r="10" fill="url(#zodiacCore)" filter="url(#zStar)" />
                <circle r="4" fill={GOLD}>
                  <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })()}

          {/* 中心 · 太一 */}
          <circle r="30" fill="url(#zodiacCore)" />
          <circle r="10" fill={GOLD} opacity="0.8">
            <animate attributeName="r" values="8;12;8" dur="4s" repeatCount="indefinite" />
          </circle>
          <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#F5E9C9">
            太
          </text>
        </svg>
      </div>

      <div
        className="relative mt-3 rounded-xl border p-3"
        style={{ borderColor: `${GOLD}44`, background: `${GOLD}0c` }}
      >
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          今日运势提要
        </div>
        <p className="mt-2 text-[12px] leading-7 text-[#D6CCB0]">
          太阳过{ZODIAC_12[TODAY_SUN_SIGN]!.name}座 · 金木相望 · 宜求新不宜求稳。情绪波动小，创造力偏强。
        </p>
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

function TonightEvents() {
  return (
    <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 100% 0%, rgba(232,232,240,0.1), transparent 55%)',
        }}
      />
      <div className="relative mb-3 flex items-center gap-2">
        <Moon size={14} style={{ color: SILVER }} />
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: SILVER }}>
            Tonight · 今夜天象
          </div>
          <h3 className="text-[16px] font-semibold text-[#F5E9C9]">可观天象 · {TONIGHT_EVENTS.length} 件</h3>
        </div>
      </div>

      <div className="relative space-y-3">
        {TONIGHT_EVENTS.map((e) => {
          const Icon = e.icon;
          const tone = e.tone === 'rare' ? GOLD : SILVER;
          return (
            <div
              key={e.name}
              className="flex items-start gap-3 rounded-xl border p-3"
              style={{
                borderColor: e.tone === 'rare' ? `${GOLD}55` : 'rgba(255,255,255,0.1)',
                background: e.tone === 'rare' ? `${GOLD}0d` : 'rgba(255,255,255,0.02)',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `${tone}18`,
                  border: `1px solid ${tone}55`,
                }}
              >
                <Icon size={16} style={{ color: tone }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] font-semibold text-[#F5E9C9]">{e.name}</div>
                  {e.tone === 'rare' && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]"
                      style={{ borderColor: `${GOLD}66`, background: `${GOLD}14`, color: GOLD }}
                    >
                      稀象
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: tone }}>
                  <Clock size={10} />
                  {e.time}
                </div>
                <div className="mt-1 text-[11px] leading-6 text-[#C8CDD8]">{e.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
