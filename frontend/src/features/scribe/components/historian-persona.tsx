/**
 * 史馆 · 史官人像
 * 金袍博冠 · 白髯 · 手持毛笔与史册
 */

'use client';

export type HistorianMood = 'contemplative' | 'stern' | 'recalling';

export interface HistorianPersonaProps {
  mood?: HistorianMood;
  size?: 'sm' | 'md' | 'lg';
  archivedCount?: number;
}

const MOOD: Record<HistorianMood, { color: string; label: string; halo: string }> = {
  contemplative: { color: '#F0C66A', label: '阅卷沉思', halo: 'rgba(240,198,106,0.28)' },
  stern:         { color: '#F43F5E', label: '秉笔直书', halo: 'rgba(244,63,94,0.25)' },
  recalling:     { color: '#3DD68C', label: '对案追忆', halo: 'rgba(61,214,140,0.25)' },
};

export function HistorianPersona({
  mood = 'contemplative',
  size = 'md',
  archivedCount,
}: HistorianPersonaProps) {
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
          <radialGradient id="hSkin" cx="0.5" cy="0.35" r="0.6">
            <stop offset="0%" stopColor="#F6DCC0" />
            <stop offset="55%" stopColor="#E6BE95" />
            <stop offset="100%" stopColor="#B5936F" />
          </radialGradient>
          <linearGradient id="hRobe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D2F0E" />
            <stop offset="100%" stopColor="#1A1408" />
          </linearGradient>
          <linearGradient id="hRobeGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F0C66A" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFD97A" />
            <stop offset="100%" stopColor="#F0C66A" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hSealGem" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#FFECB3" />
            <stop offset="55%" stopColor="#F0C66A" />
            <stop offset="100%" stopColor="#7A5A20" />
          </radialGradient>
          <filter id="hGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* 后背光 */}
        <circle cx="100" cy="75" r="62" fill={meta.halo} opacity="0.55" filter="url(#hGlow)" />

        {/* 颈 */}
        <path d="M85 120 L90 140 Q100 146 110 140 L115 120 Z" fill="url(#hSkin)" />

        {/* 金袍 */}
        <path
          d="M55 140 Q60 135 85 135 L115 135 Q140 135 145 140
             L175 210 Q178 225 165 230 L155 232 Q140 230 130 224
             L118 220 L118 240 L82 240 L82 220 L70 224 Q60 230 45 232
             L35 230 Q22 225 25 210 L55 140 Z"
          fill="url(#hRobe)"
          stroke="#F0C66A"
          strokeWidth="0.7"
        />
        {/* 金纹回字 */}
        <g fill="none" stroke="#F0C66A" strokeWidth="0.5" opacity="0.85">
          <path d="M70 160 L82 160 L82 168 L74 168 L74 164 L78 164" />
          <path d="M118 160 L130 160 L130 168 L122 168 L122 164 L126 164" />
          <path d="M70 200 L82 200 L82 208 L74 208 L74 204 L78 204" />
          <path d="M118 200 L130 200 L130 208 L122 208 L122 204 L126 204" />
        </g>
        {/* 腰玉 */}
        <rect x="92" y="148" width="16" height="68" fill="#1A1408" stroke="#F0C66A" strokeWidth="0.5" />
        <circle cx="100" cy="178" r="4.5" fill="url(#hSealGem)" />
        <circle cx="100" cy="200" r="2.5" fill="#F0C66A" opacity="0.85" />

        {/* 袍边金线 */}
        <path d="M55 145 Q100 150 145 145" stroke="url(#hRobeGold)" strokeWidth="1.2" fill="none" />
        <path d="M55 200 Q100 210 145 200" stroke="url(#hRobeGold)" strokeWidth="0.9" fill="none" opacity="0.85" />

        {/* 袖 · 大袖飘 */}
        <path d="M55 140 L30 225 L58 220 L66 160 Z" fill="#2A2008" stroke="#F0C66A" strokeWidth="0.5" />
        <path d="M145 140 L170 225 L142 220 L134 160 Z" fill="#2A2008" stroke="#F0C66A" strokeWidth="0.5" />

        {/* 头 */}
        <ellipse cx="100" cy="80" rx="32" ry="38" fill="url(#hSkin)" />
        <ellipse cx="68" cy="82" rx="5" ry="9" fill="url(#hSkin)" />
        <ellipse cx="132" cy="82" rx="5" ry="9" fill="url(#hSkin)" />

        {/* 博冠 */}
        <rect x="64" y="32" width="72" height="12" fill="#1A1408" stroke="#F0C66A" strokeWidth="0.8" />
        <path d="M70 44 Q72 30 100 28 Q128 30 130 44" fill="#2A2008" stroke="#F0C66A" strokeWidth="0.7" />
        {/* 冠前金饰 */}
        <rect x="94" y="36" width="12" height="8" fill="url(#hSealGem)" stroke="#F0C66A" strokeWidth="0.5" />
        {/* 冠边流苏 */}
        <g stroke="#F0C66A" strokeWidth="0.6" opacity="0.85">
          <line x1="64" y1="44" x2="62" y2="58" />
          <line x1="136" y1="44" x2="138" y2="58" />
          <circle cx="62" cy="60" r="1.5" fill="#F0C66A" />
          <circle cx="138" cy="60" r="1.5" fill="#F0C66A" />
        </g>

        {/* 白发鬓 */}
        <path d="M68 78 Q65 96 66 108" stroke="#EAEAF0" strokeWidth="2.8" fill="none" />
        <path d="M132 78 Q135 96 134 108" stroke="#EAEAF0" strokeWidth="2.8" fill="none" />

        {/* 眉 */}
        <path d="M82 77 Q90 73 98 77" stroke="#2a2826" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M102 77 Q110 73 118 77" stroke="#2a2826" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* 眼 · 下视简册 */}
        <path d="M82 87 Q90 90 98 87" stroke="#2a2826" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M102 87 Q110 90 118 87" stroke="#2a2826" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <circle cx="90" cy="88" r="1.1" fill="#2a2826" />
        <circle cx="110" cy="88" r="1.1" fill="#2a2826" />

        {/* 鼻嘴 */}
        <path d="M99 93 Q100 100 100 104 L98 107" stroke="#8a6a4f" strokeWidth="1" fill="none" />
        <path d="M93 112 Q100 114 107 112" stroke="#6b3a20" strokeWidth="1.3" fill="none" strokeLinecap="round" />

        {/* 白髯 · 长飘 */}
        <path
          d="M90 116 Q100 122 110 116
             M86 120 Q100 132 114 120
             M82 128 Q100 150 118 128
             M86 142 Q100 160 114 142"
          stroke="#EAEAF0"
          strokeWidth="1.2"
          fill="none"
          opacity="0.9"
        />

        {/* 左手 · 持毛笔（兰亭笔） */}
        <g transform="translate(55,172) rotate(-25)">
          {/* 笔杆 */}
          <rect x="0" y="0" width="26" height="3.5" fill="#5B3A16" />
          <rect x="0" y="0" width="26" height="3.5" fill="none" stroke="#F0C66A" strokeWidth="0.4" />
          {/* 笔锋 · 墨色 */}
          <path d="M26 0 L34 1 L36 2 L34 2.5 L26 3.5 Z" fill="#1A1A1A" />
          {/* 笔毛高光 */}
          <circle cx="34" cy="1.5" r="0.8" fill="#3A3A3A" />
          {/* 笔穗 */}
          <line x1="0" y1="-1" x2="0" y2="5" stroke="#F0C66A" strokeWidth="0.5" />
          <circle cx="0" cy="-2" r="1.5" fill="#F0C66A" />
        </g>

        {/* 右手 · 持简册（展开一片） */}
        <g transform="translate(118,168)">
          {/* 简册背板 */}
          <rect x="0" y="0" width="30" height="38" fill="#5B3A16" stroke="#F0C66A" strokeWidth="0.8" />
          <rect x="0" y="0" width="30" height="38" fill="none" stroke="#FFD97A" strokeWidth="0.3" />
          {/* 竹简条纹 */}
          <line x1="3" y1="0" x2="3" y2="38" stroke="#2A1810" strokeWidth="0.3" />
          <line x1="8" y1="0" x2="8" y2="38" stroke="#2A1810" strokeWidth="0.3" />
          <line x1="13" y1="0" x2="13" y2="38" stroke="#2A1810" strokeWidth="0.3" />
          <line x1="18" y1="0" x2="18" y2="38" stroke="#2A1810" strokeWidth="0.3" />
          <line x1="23" y1="0" x2="23" y2="38" stroke="#2A1810" strokeWidth="0.3" />
          <line x1="28" y1="0" x2="28" y2="38" stroke="#2A1810" strokeWidth="0.3" />
          {/* 绑绳 */}
          <line x1="-1" y1="8" x2="31" y2="8" stroke="#F0C66A" strokeWidth="0.5" />
          <line x1="-1" y1="30" x2="31" y2="30" stroke="#F0C66A" strokeWidth="0.5" />
          {/* 墨字（装饰点） */}
          <circle cx="5.5" cy="16" r="0.6" fill="#F5E9C9" />
          <circle cx="5.5" cy="20" r="0.6" fill="#F5E9C9" />
          <circle cx="15.5" cy="16" r="0.6" fill="#F5E9C9" />
          <circle cx="15.5" cy="23" r="0.6" fill="#F5E9C9" />
          <circle cx="25.5" cy="18" r="0.6" fill="#F5E9C9" />
        </g>

        {/* 状态印章 */}
        <circle cx="152" cy="36" r="12" fill={meta.color} opacity="0.2" />
        <circle cx="152" cy="36" r="8" fill={meta.color} stroke="#F5E9C9" strokeWidth="1" />
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

      {archivedCount !== undefined && (
        <div
          className="mt-2 rounded-full border px-3 py-1 font-mono text-[13px] font-bold"
          style={{
            background: `linear-gradient(135deg, ${meta.color}22, transparent)`,
            borderColor: `${meta.color}55`,
            color: meta.color,
          }}
        >
          在录卷宗 {archivedCount}
        </div>
      )}
    </div>
  );
}
