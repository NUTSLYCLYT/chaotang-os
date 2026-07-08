/**
 * 太医院 · 太医人像
 *
 * 顶级 SVG 绘制 · 汉服药师形象 · 情绪状态随健康总分变化
 * 伴金线印章 + 名号 + 一句开场问诊
 */

'use client';

import { useMemo } from 'react';

export type PhysicianMood = 'calm' | 'alert' | 'concerned';

export interface PhysicianPersonaProps {
  /** 当前情绪（根据总分推导） */
  mood?: PhysicianMood;
  /** 开场一句 */
  greeting?: string;
  /** 右上角徽章：总分 */
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

const MOOD_META: Record<PhysicianMood, { color: string; label: string; halo: string }> = {
  calm:      { color: '#34D399', label: '从容诊脉', halo: 'rgba(52,211,153,0.25)' },
  alert:     { color: '#F5A524', label: '正在细察', halo: 'rgba(245,165,36,0.3)' },
  concerned: { color: '#F43F5E', label: '有所警觉', halo: 'rgba(244,63,94,0.3)' },
};

export function PhysicianPersona({
  mood = 'calm',
  greeting = '陛下安，臣已阅过昨日脉案，今日可议。',
  score,
  size = 'md',
}: PhysicianPersonaProps) {
  const meta = MOOD_META[mood];
  const svgSize = size === 'lg' ? 200 : size === 'md' ? 150 : 96;

  return (
    <div className="relative flex flex-col items-center">
      {/* Outer halo */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${meta.halo}, transparent 65%)`,
          transform: 'scale(1.2)',
        }}
      />

      {/* SVG Portrait */}
      <svg
        viewBox="0 0 200 240"
        width={svgSize}
        height={svgSize * 1.2}
        className="relative drop-shadow-xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 皮肤渐变 */}
          <radialGradient id="skin" cx="0.5" cy="0.35" r="0.6">
            <stop offset="0%" stopColor="#F6DCC0" />
            <stop offset="55%" stopColor="#E6BE95" />
            <stop offset="100%" stopColor="#B5936F" />
          </radialGradient>
          {/* 袍子金线 */}
          <linearGradient id="robe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d2130" />
            <stop offset="100%" stopColor="#0b0e18" />
          </linearGradient>
          <linearGradient id="robeTrim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F0C66A" stopOpacity="0" />
            <stop offset="50%" stopColor="#F0C66A" />
            <stop offset="100%" stopColor="#F0C66A" stopOpacity="0" />
          </linearGradient>
          {/* 头饰光 */}
          <radialGradient id="hatGleam" cx="0.5" cy="0.3" r="0.7">
            <stop offset="0%" stopColor="#F0C66A" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#7a5a20" />
          </radialGradient>
          {/* 脉动光晕 */}
          <filter id="personaGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Back halo */}
        <circle
          cx="100"
          cy="75"
          r="58"
          fill={meta.halo}
          opacity="0.55"
          filter="url(#personaGlow)"
        />

        {/* Neck */}
        <path d="M85 120 L90 140 Q100 146 110 140 L115 120 Z" fill="url(#skin)" />

        {/* Robe body · flowing下摆 */}
        <path
          d="M55 140 Q60 135 85 135 L115 135 Q140 135 145 140
             L175 210 Q178 225 165 230 L155 232 Q140 230 130 224
             L118 220 L118 240 L82 240 L82 220 L70 224 Q60 230 45 232
             L35 230 Q22 225 25 210 L55 140 Z"
          fill="url(#robe)"
          stroke="#F0C66A"
          strokeWidth="0.6"
          opacity="0.95"
        />

        {/* Robe center seam (束带) */}
        <rect x="92" y="148" width="16" height="68" fill="#0b0e18" stroke="#F0C66A" strokeWidth="0.5" />
        <circle cx="100" cy="175" r="3" fill="#F0C66A" opacity="0.9" />
        <circle cx="100" cy="195" r="2" fill="#F0C66A" opacity="0.7" />

        {/* Robe decorative trim */}
        <path
          d="M55 145 Q100 150 145 145"
          stroke="url(#robeTrim)"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M55 200 Q100 210 145 200"
          stroke="url(#robeTrim)"
          strokeWidth="0.9"
          fill="none"
          opacity="0.8"
        />

        {/* Sleeves */}
        <path d="M55 140 L35 220 L55 215 L65 160 Z" fill="#141826" stroke="#F0C66A" strokeWidth="0.4" opacity="0.9" />
        <path d="M145 140 L165 220 L145 215 L135 160 Z" fill="#141826" stroke="#F0C66A" strokeWidth="0.4" opacity="0.9" />

        {/* Head */}
        <ellipse cx="100" cy="80" rx="32" ry="38" fill="url(#skin)" />

        {/* Ears */}
        <ellipse cx="68" cy="82" rx="5" ry="9" fill="url(#skin)" />
        <ellipse cx="132" cy="82" rx="5" ry="9" fill="url(#skin)" />

        {/* Hat 纱帽 */}
        <path
          d="M70 55 Q72 35 100 32 Q128 35 130 55 L128 68 L72 68 Z"
          fill="url(#hatGleam)"
          stroke="#F0C66A"
          strokeWidth="0.7"
        />
        <rect x="72" y="66" width="56" height="5" fill="#0b0e18" />
        {/* 帽翅 */}
        <path d="M65 68 L55 64 L55 74 L65 72 Z" fill="#0b0e18" stroke="#F0C66A" strokeWidth="0.5" />
        <path d="M135 68 L145 64 L145 74 L135 72 Z" fill="#0b0e18" stroke="#F0C66A" strokeWidth="0.5" />

        {/* Hair at sideburns */}
        <path d="M68 78 Q65 90 68 100" stroke="#1a1815" strokeWidth="2.5" fill="none" />
        <path d="M132 78 Q135 90 132 100" stroke="#1a1815" strokeWidth="2.5" fill="none" />

        {/* Eyebrows */}
        <path d="M84 78 Q89 74 96 77" stroke="#1a1815" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M104 77 Q111 74 116 78" stroke="#1a1815" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {/* Eyes · 半眯 贤士态 */}
        <path d="M83 86 Q90 88 97 86" stroke="#1a1815" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M103 86 Q110 88 117 86" stroke="#1a1815" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="90" cy="86" r="1.2" fill="#1a1815" />
        <circle cx="110" cy="86" r="1.2" fill="#1a1815" />

        {/* Nose */}
        <path d="M99 93 Q100 100 100 104 L98 107" stroke="#8a6a4f" strokeWidth="1" fill="none" />

        {/* Mouth · 捻须微笑 */}
        <path d="M93 112 Q100 115 107 112" stroke="#6b3a20" strokeWidth="1.4" fill="none" strokeLinecap="round" />

        {/* Beard · 飘逸 */}
        <path
          d="M95 116 Q100 122 105 116
             M92 118 Q100 128 108 118
             M88 120 Q100 138 112 120
             M94 124 Q100 144 106 124"
          stroke="#1a1815"
          strokeWidth="1"
          fill="none"
          opacity="0.85"
        />

        {/* Hand holding scroll/pulse tablet (placeholder rectangle glow) */}
        <g transform="translate(118,180) rotate(-15)">
          <rect x="0" y="0" width="22" height="30" fill="#F0C66A" opacity="0.18" />
          <rect x="0" y="0" width="22" height="30" fill="none" stroke="#F0C66A" strokeWidth="0.8" />
          <line x1="4" y1="8" x2="18" y2="8" stroke="#F0C66A" strokeWidth="0.4" />
          <line x1="4" y1="14" x2="18" y2="14" stroke="#F0C66A" strokeWidth="0.4" />
          <line x1="4" y1="20" x2="14" y2="20" stroke="#F0C66A" strokeWidth="0.4" />
        </g>

        {/* Status dot · 印章式 */}
        <circle cx="148" cy="40" r="12" fill={meta.color} opacity="0.18" />
        <circle cx="148" cy="40" r="8" fill={meta.color} stroke="#F5E9C9" strokeWidth="1" />
      </svg>

      {/* Badge · mood label */}
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

      {score !== undefined && (
        <div
          className="mt-2 rounded-full border px-3 py-1 font-mono text-[13px] font-bold"
          style={{
            background: `linear-gradient(135deg, ${meta.color}22, transparent)`,
            borderColor: `${meta.color}55`,
            color: meta.color,
          }}
        >
          今日脉象 {score}
        </div>
      )}
    </div>
  );
}

/** 由总分推导情绪 */
export function moodFromScore(score: number | undefined): PhysicianMood {
  if (score === undefined) return 'calm';
  if (score >= 80) return 'calm';
  if (score >= 65) return 'alert';
  return 'concerned';
}
