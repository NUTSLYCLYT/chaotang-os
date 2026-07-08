/**
 * 观天台 · 钦天监正
 *
 * 白发星袍 · 手持浑天仪 · 情绪随头部情景置信度变化
 */

'use client';

export type AstronomerMood = 'cosmic' | 'alert' | 'foreboding';

export interface AstronomerPersonaProps {
  mood?: AstronomerMood;
  size?: 'sm' | 'md' | 'lg';
  /** 头部徽章 · 今日置信度 0-100 */
  confidence?: number;
}

const MOOD: Record<AstronomerMood, { color: string; label: string; halo: string }> = {
  cosmic:     { color: '#B794F4', label: '观星入微', halo: 'rgba(183,148,244,0.3)' },
  alert:      { color: '#F0C66A', label: '占验须察', halo: 'rgba(240,198,106,0.3)' },
  foreboding: { color: '#F43F5E', label: '荧惑守心', halo: 'rgba(244,63,94,0.3)' },
};

export function AstronomerPersona({
  mood = 'cosmic',
  size = 'md',
  confidence,
}: AstronomerPersonaProps) {
  const meta = MOOD[mood];
  const svgSize = size === 'lg' ? 200 : size === 'md' ? 150 : 96;

  return (
    <div className="relative flex flex-col items-center">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${meta.halo}, transparent 65%)`,
          transform: 'scale(1.25)',
        }}
      />

      <svg
        viewBox="0 0 200 240"
        width={svgSize}
        height={svgSize * 1.2}
        className="relative drop-shadow-xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="astroSkin" cx="0.5" cy="0.35" r="0.6">
            <stop offset="0%" stopColor="#EED7BA" />
            <stop offset="55%" stopColor="#D6B68F" />
            <stop offset="100%" stopColor="#A08560" />
          </radialGradient>
          <linearGradient id="astroRobe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1d30" />
            <stop offset="100%" stopColor="#0a0c18" />
          </linearGradient>
          <radialGradient id="astroGem" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#E2D3FF" />
            <stop offset="55%" stopColor="#B794F4" />
            <stop offset="100%" stopColor="#4A3780" />
          </radialGradient>
          <linearGradient id="astroTrim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#B794F4" stopOpacity="0" />
            <stop offset="50%" stopColor="#B794F4" />
            <stop offset="100%" stopColor="#B794F4" stopOpacity="0" />
          </linearGradient>
          <filter id="astroGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* 背后星河光 */}
        <circle cx="100" cy="75" r="62" fill={meta.halo} opacity="0.55" filter="url(#astroGlow)" />

        {/* 星点背景 */}
        <g opacity="0.7">
          {[[50,30,1],[150,40,1.2],[30,60,0.8],[170,70,1],[140,18,0.8],[60,12,1.2],[180,110,0.8]].map((p,i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill="#F5E9C9" opacity={0.8}>
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur={`${3 + i}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>

        {/* 颈 */}
        <path d="M85 120 L90 140 Q100 146 110 140 L115 120 Z" fill="url(#astroSkin)" />

        {/* 袍子 · 星纹点缀 */}
        <path
          d="M55 140 Q60 135 85 135 L115 135 Q140 135 145 140
             L175 210 Q178 225 165 230 L155 232 Q140 230 130 224
             L118 220 L118 240 L82 240 L82 220 L70 224 Q60 230 45 232
             L35 230 Q22 225 25 210 L55 140 Z"
          fill="url(#astroRobe)"
          stroke="#B794F4"
          strokeWidth="0.6"
        />
        {/* 袍上星宿 */}
        <g fill="#E2D3FF" opacity="0.85">
          <circle cx="80" cy="160" r="1.2" />
          <circle cx="90" cy="180" r="1" />
          <circle cx="100" cy="170" r="1.4" />
          <circle cx="115" cy="195" r="1.1" />
          <circle cx="130" cy="180" r="1" />
          <circle cx="70" cy="190" r="0.9" />
          <circle cx="105" cy="210" r="1.1" />
          {/* 连线 · 构成一个简化北斗 */}
          <path
            d="M80 160 L90 180 L100 170 L115 195 M80 160 L105 210"
            stroke="#B794F4"
            strokeWidth="0.5"
            fill="none"
            opacity="0.6"
          />
        </g>
        {/* 腰带 */}
        <rect x="92" y="148" width="16" height="68" fill="#0a0c18" stroke="#B794F4" strokeWidth="0.5" />
        <circle cx="100" cy="178" r="4" fill="url(#astroGem)" />
        <circle cx="100" cy="200" r="2.5" fill="#B794F4" opacity="0.8" />

        {/* 袍边金线 */}
        <path d="M55 145 Q100 150 145 145" stroke="url(#astroTrim)" strokeWidth="1.1" fill="none" />
        <path d="M55 200 Q100 210 145 200" stroke="url(#astroTrim)" strokeWidth="0.9" fill="none" opacity="0.8" />

        {/* 袖 */}
        <path d="M55 140 L35 220 L55 215 L65 160 Z" fill="#141627" stroke="#B794F4" strokeWidth="0.4" opacity="0.9" />
        <path d="M145 140 L165 220 L145 215 L135 160 Z" fill="#141627" stroke="#B794F4" strokeWidth="0.4" opacity="0.9" />

        {/* 头 */}
        <ellipse cx="100" cy="80" rx="32" ry="38" fill="url(#astroSkin)" />

        {/* 耳 */}
        <ellipse cx="68" cy="82" rx="5" ry="9" fill="url(#astroSkin)" />
        <ellipse cx="132" cy="82" rx="5" ry="9" fill="url(#astroSkin)" />

        {/* 头冠 · 太一冠 */}
        <path
          d="M70 50 Q72 32 100 30 Q128 32 130 50 L128 64 L72 64 Z"
          fill="#0d0f1c"
          stroke="#B794F4"
          strokeWidth="0.7"
        />
        {/* 冠前玉饰 */}
        <circle cx="100" cy="44" r="6" fill="url(#astroGem)" />
        <circle cx="100" cy="44" r="3" fill="#E2D3FF" opacity="0.9" />
        {/* 冠垂珠 */}
        <g stroke="#F5E9C9" strokeWidth="0.5" fill="none" opacity="0.8">
          <line x1="72" y1="64" x2="70" y2="78" />
          <line x1="128" y1="64" x2="130" y2="78" />
        </g>

        {/* 白色鬓发 */}
        <path d="M68 78 Q65 96 66 108" stroke="#EAEAF0" strokeWidth="2.8" fill="none" />
        <path d="M132 78 Q135 96 134 108" stroke="#EAEAF0" strokeWidth="2.8" fill="none" />

        {/* 眉 · 长眉 */}
        <path d="M82 77 Q90 73 98 77" stroke="#2a2826" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M102 77 Q110 73 118 77" stroke="#2a2826" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* 眼 · 闭目观星 */}
        <path d="M83 86 Q90 89 97 86" stroke="#2a2826" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M103 86 Q110 89 117 86" stroke="#2a2826" strokeWidth="1.4" fill="none" strokeLinecap="round" />

        {/* 鼻 */}
        <path d="M99 93 Q100 100 100 104 L98 107" stroke="#8a6a4f" strokeWidth="1" fill="none" />
        {/* 嘴 */}
        <path d="M93 112 Q100 114 107 112" stroke="#6b3a20" strokeWidth="1.3" fill="none" strokeLinecap="round" />

        {/* 白髯 · 长而飘 */}
        <path
          d="M90 116 Q100 122 110 116
             M86 120 Q100 132 114 120
             M82 128 Q100 150 118 128
             M86 140 Q100 160 114 140"
          stroke="#EAEAF0"
          strokeWidth="1.2"
          fill="none"
          opacity="0.9"
        />

        {/* 浑天仪 · 手持 */}
        <g transform="translate(125,170)">
          {/* 外环 */}
          <circle cx="0" cy="0" r="16" fill="none" stroke="#B794F4" strokeWidth="1.2" />
          <ellipse cx="0" cy="0" rx="16" ry="6" fill="none" stroke="#B794F4" strokeWidth="0.8" />
          <ellipse cx="0" cy="0" rx="6" ry="16" fill="none" stroke="#B794F4" strokeWidth="0.8" />
          {/* 核心 */}
          <circle cx="0" cy="0" r="3" fill="url(#astroGem)" />
          <circle cx="0" cy="0" r="1" fill="#F5E9C9" />
          {/* 旋转 */}
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 0"
            to="360 0 0"
            dur="20s"
            repeatCount="indefinite"
            additive="sum"
          />
        </g>

        {/* 状态印章 */}
        <circle cx="150" cy="36" r="12" fill={meta.color} opacity="0.2" />
        <circle cx="150" cy="36" r="8" fill={meta.color} stroke="#F5E9C9" strokeWidth="1" />
      </svg>

      <div
        className="absolute -right-1 top-4 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]"
        style={{
          background: `${meta.color}1a`,
          borderColor: `${meta.color}66`,
          color: meta.color,
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
        />
        {meta.label}
      </div>

      {confidence !== undefined && (
        <div
          className="mt-2 rounded-full border px-3 py-1 font-mono text-[13px] font-bold"
          style={{
            background: `linear-gradient(135deg, ${meta.color}22, transparent)`,
            borderColor: `${meta.color}55`,
            color: meta.color,
          }}
        >
          今日占验 {confidence}%
        </div>
      )}
    </div>
  );
}

export function moodFromConfidence(c: number | undefined): AstronomerMood {
  if (c === undefined) return 'cosmic';
  if (c >= 70) return 'cosmic';
  if (c >= 50) return 'alert';
  return 'foreboding';
}
