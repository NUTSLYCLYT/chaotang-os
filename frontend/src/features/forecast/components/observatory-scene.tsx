/**
 * 观天台 · Observatory Scene（首页 Hero）
 *
 * 山巅观星台夜景：远山 + 星河 + 月 + 观星台 + 浑天仪 + 日晷 + 钦天监剪影
 * 用 SVG 纯绘制，动画无 JS（CSS/SMIL）
 */

'use client';

import { useMemo } from 'react';

export interface ObservatorySceneProps {
  /** 今日占验一句话 */
  briefing?: string;
  /** 置信度 0-100 */
  confidence?: number;
  /** 活跃预测主题数 */
  activeDomains?: number;
}

export function ObservatoryScene({
  briefing = '紫微稳定 · 太白略西 · 今夜宜推演',
  confidence = 67,
  activeDomains = 6,
}: ObservatorySceneProps) {
  // 星点 · SSR 友好的 deterministic 随机
  const stars = useMemo(() => {
    const rng = mulberry32(7);
    const arr = [];
    for (let i = 0; i < 140; i++) {
      arr.push({
        x: rng() * 800,
        y: rng() * 220,
        r: rng() * 1.2 + 0.3,
        d: rng() * 4 + 2,
        o: rng() * 0.5 + 0.3,
      });
    }
    return arr;
  }, []);

  // 流星轨迹（3 条随机角度）
  const meteors = useMemo(() => {
    const rng = mulberry32(19);
    return Array.from({ length: 3 }).map((_, i) => ({
      x: rng() * 400 + 100,
      y: rng() * 80 + 20,
      dx: rng() * 80 + 60,
      dy: rng() * 30 + 20,
      delay: i * 4,
      dur: 1.8,
    }));
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border"
      style={{
        borderColor: 'rgba(183,148,244,0.3)',
        background:
          'linear-gradient(180deg, #05061E 0%, #0B0F2E 40%, #171339 70%, #201645 100%)',
        boxShadow:
          '0 10px 60px rgba(183,148,244,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <svg
        viewBox="0 0 800 400"
        className="block h-[360px] w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* 天空渐变 */}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#05061E" />
            <stop offset="45%" stopColor="#0B0F2E" />
            <stop offset="80%" stopColor="#1C1547" />
            <stop offset="100%" stopColor="#2A1A58" />
          </linearGradient>
          {/* 月光 */}
          <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#FFFDF0" stopOpacity="1" />
            <stop offset="40%" stopColor="#F5E9C9" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F5E9C9" stopOpacity="0" />
          </radialGradient>
          {/* 银河 */}
          <linearGradient id="milky" x1="0" y1="0" x2="1" y2="0.5">
            <stop offset="0%" stopColor="rgba(183,148,244,0)" />
            <stop offset="25%" stopColor="rgba(183,148,244,0.14)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="75%" stopColor="rgba(94,234,212,0.12)" />
            <stop offset="100%" stopColor="rgba(183,148,244,0)" />
          </linearGradient>
          {/* 石台 */}
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A3052" />
            <stop offset="50%" stopColor="#221B36" />
            <stop offset="100%" stopColor="#0E0B1C" />
          </linearGradient>
          <linearGradient id="stoneLip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0C66A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#F0C66A" stopOpacity="0" />
          </linearGradient>
          {/* 山 */}
          <linearGradient id="mtnFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2B2252" />
            <stop offset="100%" stopColor="#12102C" />
          </linearGradient>
          <linearGradient id="mtnNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A1440" />
            <stop offset="100%" stopColor="#080614" />
          </linearGradient>
          {/* 浑天仪核 */}
          <radialGradient id="sphereCore" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#F5E9C9" />
            <stop offset="55%" stopColor="#F0C66A" />
            <stop offset="100%" stopColor="#5A3F10" />
          </radialGradient>
          <filter id="sceneGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id="strongGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* 天空 */}
        <rect width="800" height="400" fill="url(#sky)" />

        {/* 银河斜带 */}
        <polygon
          points="0,90 800,50 800,180 0,220"
          fill="url(#milky)"
          opacity="0.55"
        />

        {/* 星点 · 闪烁 */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F5E9C9" opacity={s.o}>
            <animate
              attributeName="opacity"
              values={`${s.o * 0.3};${s.o};${s.o * 0.3}`}
              dur={`${s.d}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}

        {/* 流星 */}
        {meteors.map((m, i) => (
          <g key={i}>
            <line
              x1={m.x}
              y1={m.y}
              x2={m.x + m.dx * 0.25}
              y2={m.y + m.dy * 0.25}
              stroke="#F5E9C9"
              strokeWidth="0.8"
              opacity="0"
            >
              <animate
                attributeName="opacity"
                values="0;0.95;0"
                dur={`${m.dur}s`}
                begin={`${m.delay}s`}
                repeatCount="indefinite"
              />
            </line>
            <circle cx={m.x} cy={m.y} r="1.4" fill="#FFFDF0" opacity="0">
              <animate
                attributeName="opacity"
                values="0;1;0"
                dur={`${m.dur}s`}
                begin={`${m.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cx"
                values={`${m.x};${m.x + m.dx}`}
                dur={`${m.dur}s`}
                begin={`${m.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values={`${m.y};${m.y + m.dy}`}
                dur={`${m.dur}s`}
                begin={`${m.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

        {/* 月亮 */}
        <g transform="translate(640,80)">
          <circle r="50" fill="url(#moonGlow)" filter="url(#strongGlow)" opacity="0.7" />
          <circle r="28" fill="#FFFDF0" opacity="0.95" />
          <circle r="25" fill="#F7EFD2" opacity="0.9" />
          {/* 月纹 */}
          <circle cx="-8" cy="-4" r="5" fill="#EAD8A0" opacity="0.55" />
          <circle cx="6" cy="8" r="4" fill="#EAD8A0" opacity="0.45" />
          <circle cx="-2" cy="12" r="3" fill="#EAD8A0" opacity="0.35" />
        </g>

        {/* 远山 */}
        <path
          d="M 0 280 L 100 240 L 180 260 L 260 220 L 340 245 L 420 210 L 500 235 L 580 215 L 660 240 L 740 225 L 800 240 L 800 340 L 0 340 Z"
          fill="url(#mtnFar)"
          opacity="0.85"
        />
        {/* 近山 */}
        <path
          d="M 0 310 L 80 285 L 160 305 L 240 270 L 320 295 L 400 275 L 480 300 L 560 280 L 640 305 L 720 290 L 800 300 L 800 400 L 0 400 Z"
          fill="url(#mtnNear)"
        />

        {/* 观星台主台 */}
        <g>
          {/* 台面背景光晕 */}
          <ellipse cx="400" cy="340" rx="280" ry="30" fill="rgba(183,148,244,0.15)" filter="url(#sceneGlow)" />
          {/* 台阶 */}
          <rect x="180" y="330" width="440" height="14" fill="url(#stone)" stroke="#F0C66A" strokeWidth="0.6" opacity="0.95" />
          <rect x="210" y="344" width="380" height="10" fill="url(#stone)" stroke="#F0C66A" strokeWidth="0.5" opacity="0.9" />
          <rect x="240" y="354" width="320" height="10" fill="url(#stone)" stroke="#F0C66A" strokeWidth="0.5" opacity="0.85" />
          {/* 台面主石 */}
          <rect x="160" y="316" width="480" height="14" fill="#2A2340" stroke="#F0C66A" strokeWidth="0.8" />
          {/* 台面纹饰 */}
          {[200, 260, 320, 380, 440, 500, 560].map((x) => (
            <circle key={x} cx={x} cy="323" r="1.5" fill="#F0C66A" opacity="0.75" />
          ))}
          {/* 台沿金线 */}
          <rect x="160" y="316" width="480" height="2" fill="url(#stoneLip)" />
          {/* 栏杆柱 */}
          {[185, 225, 265, 535, 575, 615].map((x) => (
            <g key={x}>
              <rect x={x - 1} y="296" width="2" height="22" fill="#F0C66A" opacity="0.7" />
              <circle cx={x} cy="296" r="2" fill="#F0C66A" />
              <circle cx={x} cy="296" r="3.5" fill="#F0C66A" opacity="0.25" filter="url(#sceneGlow)" />
            </g>
          ))}
          {/* 栏杆横线 */}
          <line x1="185" y1="300" x2="265" y2="300" stroke="#F0C66A" strokeWidth="0.7" opacity="0.7" />
          <line x1="535" y1="300" x2="615" y2="300" stroke="#F0C66A" strokeWidth="0.7" opacity="0.7" />
        </g>

        {/* 日晷（左） */}
        <g transform="translate(220,298)">
          <ellipse cx="0" cy="16" rx="22" ry="6" fill="#1A1538" stroke="#F0C66A" strokeWidth="0.6" />
          <ellipse cx="0" cy="14" rx="20" ry="5" fill="url(#stone)" stroke="#F0C66A" strokeWidth="0.5" />
          {/* 刻度 */}
          {[0, 30, 60, 90, 120, 150, 180].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={Math.cos(rad) * 18}
                y1={14 - Math.sin(rad) * 4.5}
                x2={Math.cos(rad) * 20}
                y2={14 - Math.sin(rad) * 5}
                stroke="#F0C66A"
                strokeWidth="0.5"
              />
            );
          })}
          {/* 晷针 */}
          <line x1="0" y1="14" x2="0" y2="-10" stroke="#F0C66A" strokeWidth="1" />
          <circle cx="0" cy="-10" r="1.5" fill="#F0C66A" />
          {/* 投影 */}
          <line x1="0" y1="14" x2="12" y2="14" stroke="#2A1A58" strokeWidth="1.4" opacity="0.75" />
        </g>

        {/* 浑天仪（中） */}
        <g transform="translate(400,250)">
          {/* 支架 */}
          <line x1="0" y1="55" x2="0" y2="75" stroke="#F0C66A" strokeWidth="2" />
          <path d="M -10 80 L 10 80 L 8 76 L -8 76 Z" fill="#3A3052" stroke="#F0C66A" strokeWidth="0.7" />
          {/* 外环 · 赤道圈 */}
          <g>
            <circle r="42" fill="none" stroke="#F0C66A" strokeWidth="1.2" opacity="0.9" />
            <ellipse rx="42" ry="14" fill="none" stroke="#F0C66A" strokeWidth="0.9" />
            <ellipse rx="14" ry="42" fill="none" stroke="#F0C66A" strokeWidth="0.9" />
            {/* 刻度（12 地支） */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1={Math.cos(a) * 42}
                  y1={Math.sin(a) * 42}
                  x2={Math.cos(a) * 45}
                  y2={Math.sin(a) * 45}
                  stroke="#F0C66A"
                  strokeWidth="0.8"
                />
              );
            })}
            {/* 黄道带（斜椭圆） */}
            <ellipse
              rx="42"
              ry="14"
              fill="none"
              stroke="#B794F4"
              strokeWidth="0.9"
              strokeDasharray="2 3"
              transform="rotate(28)"
              opacity="0.9"
            />
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur="60s"
              repeatCount="indefinite"
            />
          </g>
          {/* 核心 */}
          <circle r="6" fill="url(#sphereCore)" filter="url(#sceneGlow)" />
          <circle r="3" fill="#FFFDF0">
            <animate attributeName="r" values="2.5;4;2.5" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* 钦天监剪影 · 观星动作（右侧站立） */}
        <g transform="translate(560,280)">
          {/* 袍身 */}
          <path
            d="M 0 60 Q 6 40 4 20 L -6 18 L -8 30 Q -6 45 -10 60 L -12 64 L 12 64 Z"
            fill="#1A1538"
            stroke="#B794F4"
            strokeWidth="0.6"
            opacity="0.95"
          />
          {/* 头 */}
          <circle cx="0" cy="12" r="5.5" fill="#1A1538" stroke="#B794F4" strokeWidth="0.5" />
          {/* 冠 */}
          <rect x="-6" y="6" width="12" height="3" fill="#0B0F2E" stroke="#F0C66A" strokeWidth="0.4" />
          <circle cx="0" cy="6" r="1" fill="#F0C66A" />
          {/* 手臂（指向浑天仪方向） */}
          <line x1="-4" y1="22" x2="-28" y2="14" stroke="#1A1538" strokeWidth="4" strokeLinecap="round" />
          <line x1="-4" y1="22" x2="-28" y2="14" stroke="#B794F4" strokeWidth="0.6" />
          {/* 手中持物 · 小铜镜 */}
          <circle cx="-30" cy="14" r="3.5" fill="#0B0F2E" stroke="#F0C66A" strokeWidth="0.6" />
          <circle cx="-30" cy="14" r="1.8" fill="#F0C66A" opacity="0.9" />
          {/* 长髯 */}
          <path d="M -2 17 Q 0 22 2 17" stroke="#EAEAF0" strokeWidth="0.6" fill="none" />
          <path d="M -4 19 Q 0 28 4 19" stroke="#EAEAF0" strokeWidth="0.5" fill="none" />
        </g>

        {/* 地面微光 */}
        <ellipse cx="400" cy="400" rx="340" ry="24" fill="rgba(183,148,244,0.18)" opacity="0.5" filter="url(#sceneGlow)" />

        {/* 从星空到浑天仪的光柱（装饰） */}
        <line
          x1="400"
          y1="0"
          x2="400"
          y2="250"
          stroke="rgba(183,148,244,0.25)"
          strokeWidth="0.8"
          strokeDasharray="2 8"
        >
          <animate attributeName="opacity" values="0.15;0.5;0.15" dur="4s" repeatCount="indefinite" />
        </line>
      </svg>

      {/* 覆盖文字层 · 今日简报 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="pointer-events-auto max-w-[60%]">
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em] backdrop-blur-md"
              style={{
                borderColor: 'rgba(183,148,244,0.5)',
                background: 'rgba(11,15,46,0.7)',
                color: '#B794F4',
              }}
            >
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#B794F4' }} />
              Imperial Observatory · 今夜占验
            </div>
            <h2 className="mt-2 text-[24px] font-semibold leading-tight text-[#F5E9C9] drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {briefing}
            </h2>
          </div>
          <div className="pointer-events-auto flex items-center gap-3">
            <Badge label="置信" value={`${confidence}%`} color="#B794F4" />
            <Badge label="在册主题" value={`${activeDomains}`} color="#F0C66A" />
          </div>
        </div>
      </div>

      {/* 底部光纹 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{
          background:
            'linear-gradient(180deg, transparent, rgba(11,15,46,0.85))',
        }}
      />
    </div>
  );
}

function Badge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border px-3 py-2 backdrop-blur-md"
      style={{
        borderColor: `${color}55`,
        background: 'rgba(11,15,46,0.75)',
        minWidth: '72px',
      }}
    >
      <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: `${color}` }}>
        {label}
      </span>
      <span className="font-mono text-[18px] font-bold" style={{ color: '#F5E9C9' }}>
        {value}
      </span>
    </div>
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
