/**
 * 朝堂 OS · 归档庆典 1.2s（第三 wow · 完成登朝/落印/归档三部曲）
 *
 * 触发：
 *   window.dispatchEvent(new CustomEvent('court:archive-ceremony', {
 *     detail: { title?: string, note?: string }
 *   }))
 *
 * 视觉分层：
 *   0.00s  背景闪金 + 弦乐起
 *   0.10s  20 片金花从顶部撒落
 *   0.30s  中央卷轴展开（显示任务标题 + 归档金印）
 *   0.70s  11 位大臣剪影微微下拜（SVG stroke opacity pulse）
 *   0.95s  卷轴缓慢闭合 + 金花落尽
 *   1.15s  整体淡出
 *
 * 全站使用，挂在 root layout。
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Award } from 'lucide-react';

export interface ArchiveCeremonyEvent {
  title?: string;
  note?: string;
  nonce?: number;
}

interface Internal extends ArchiveCeremonyEvent {
  id: number;
}

declare global {
  interface WindowEventMap {
    'court:archive-ceremony': CustomEvent<ArchiveCeremonyEvent>;
  }
}

export function useArchiveCeremony() {
  return (payload: ArchiveCeremonyEvent = {}) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('court:archive-ceremony', { detail: payload }),
    );
  };
}

/* ========================================================================== *
 *  Overlay · 挂在 root
 * ========================================================================== */

export function ArchiveCeremonyOverlay() {
  const [queue, setQueue] = useState<Internal[]>([]);

  useEffect(() => {
    const handler = (e: CustomEvent<ArchiveCeremonyEvent>) => {
      const data = e.detail ?? {};
      const next: Internal = {
        ...data,
        id: Date.now() + Math.random(),
      };
      setQueue((q) => [...q, next]);
      setTimeout(() => {
        setQueue((q) => q.filter((x) => x.id !== next.id));
      }, 1400);
    };
    window.addEventListener('court:archive-ceremony', handler as EventListener);
    return () =>
      window.removeEventListener('court:archive-ceremony', handler as EventListener);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[160]">
      <AnimatePresence>
        {queue.map((item) => (
          <Ceremony key={item.id} data={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ========================================================================== *
 *  Ceremony · 单次动画
 * ========================================================================== */

function Ceremony({ data }: { data: Internal }) {
  // 随机粒子种子
  const petals = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        x: Math.random() * 100, // %
        delay: Math.random() * 0.35,
        dur: 0.9 + Math.random() * 0.6,
        size: 8 + Math.random() * 10,
        rot: -180 + Math.random() * 360,
        drift: -40 + Math.random() * 80,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* 背景金光闪 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0.3, 0] }}
        transition={{ duration: 1.2, times: [0, 0.15, 0.4, 1], ease: 'easeOut' }}
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(240,198,106,0.28) 0%, rgba(240,198,106,0.08) 30%, transparent 70%)',
        }}
      />

      {/* 金花粒子撒落 */}
      <div className="absolute inset-0 overflow-hidden">
        {petals.map((p) => (
          <motion.span
            key={p.id}
            initial={{
              opacity: 0,
              y: -80,
              x: 0,
              rotate: 0,
              scale: 0.6,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [- 80, 120, 520, 780],
              x: [0, p.drift, p.drift * 1.4, p.drift * 1.8],
              rotate: [0, p.rot * 0.6, p.rot, p.rot * 1.3],
              scale: [0.6, 1, 1, 0.7],
            }}
            transition={{
              duration: p.dur,
              delay: 0.1 + p.delay,
              ease: 'easeIn',
              times: [0, 0.2, 0.7, 1],
            }}
            className="absolute -top-6"
            style={{
              left: `${p.x}%`,
              width: p.size,
              height: p.size * 0.7,
            }}
          >
            <svg viewBox="0 0 20 14" className="h-full w-full">
              <path
                d="M 10 0 Q 18 4 20 14 Q 10 10 0 14 Q 2 4 10 0 Z"
                fill="url(#petalGrad)"
                opacity="0.95"
              />
              <defs>
                <linearGradient id="petalGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFF3C8" />
                  <stop offset="60%" stopColor="#F0C66A" />
                  <stop offset="100%" stopColor="#8A6224" />
                </linearGradient>
              </defs>
            </svg>
          </motion.span>
        ))}
      </div>

      {/* 中央卷轴 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 16 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          scale: [0.6, 1.05, 1, 1, 0.85],
          y: [16, 0, 0, 0, -30],
        }}
        transition={{
          duration: 1.2,
          times: [0, 0.25, 0.4, 0.75, 1],
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className="relative flex h-[180px] w-[520px] max-w-[90vw] items-center justify-center"
      >
        <ScrollSvg />

        {/* 中央文字 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-10">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#8A6224]">
            <Award size={14} style={{ color: '#8A6224' }} />
            入史馆 · Archived Forever
          </div>
          <div
            className="mt-2 max-w-full truncate text-center text-[22px] font-black tracking-[0.1em]"
            style={{
              color: '#5A3E1A',
              fontFamily: '"Noto Serif SC", serif',
              textShadow: '0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            {data.title ?? '此案已归档 · 千载留名'}
          </div>
          <div className="mt-2 text-[11px] tracking-[0.22em] text-[#8A6224]/70">
            {data.note ?? '司马迁 秉笔直书 · 陛下圣明'}
          </div>
          {/* 金印 */}
          <div
            className="mt-2 flex h-8 w-8 items-center justify-center rounded-sm border-2"
            style={{
              background: 'linear-gradient(135deg, #DC3A3A, #8A1818)',
              borderColor: '#8A1818',
              color: '#FFF',
              fontFamily: '"Noto Serif SC", serif',
              fontWeight: 900,
              fontSize: '14px',
              boxShadow: '0 2px 6px rgba(138,24,24,0.5)',
            }}
          >
            档
          </div>
        </div>
      </motion.div>

      {/* 11 大臣剪影朝拜（底部半弧线） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[10%] flex items-end justify-center gap-6">
        {Array.from({ length: 11 }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: [0, 0.55, 0.7, 0],
              y: [10, 0, 2, 8],
            }}
            transition={{
              duration: 1.1,
              times: [0, 0.4, 0.7, 1],
              delay: 0.45 + i * 0.035,
              ease: 'easeOut',
            }}
            className="h-[28px] w-[14px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(240,198,106,0.55) 0%, rgba(138,98,36,0.8) 70%, transparent 100%)',
              clipPath:
                'polygon(30% 0, 70% 0, 85% 30%, 90% 100%, 10% 100%, 15% 30%)',
              filter: 'blur(0.3px)',
            }}
          />
        ))}
      </div>

      {/* 底部金线波动 */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.2 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scaleX: [0.2, 1, 1, 1.2],
        }}
        transition={{ duration: 1.1, delay: 0.3 }}
        className="absolute inset-x-0 bottom-[14%] h-[2px] origin-center"
        style={{
          background:
            'linear-gradient(90deg, transparent, #F0C66A, transparent)',
          boxShadow: '0 0 10px rgba(240,198,106,0.8)',
        }}
      />
    </div>
  );
}

/* ========================================================================== *
 *  卷轴 SVG · 米黄绢纸 + 两端金色木轴
 * ========================================================================== */

function ScrollSvg() {
  return (
    <svg
      viewBox="0 0 520 180"
      className="h-full w-full drop-shadow-[0_8px_26px_rgba(0,0,0,0.5)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDF4D8" />
          <stop offset="45%" stopColor="#F4E1B0" />
          <stop offset="100%" stopColor="#D9BC7A" />
        </linearGradient>
        <linearGradient id="paperShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(138,98,36,0.2)" />
          <stop offset="100%" stopColor="rgba(138,98,36,0)" />
        </linearGradient>
        <linearGradient id="rodGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3C8" />
          <stop offset="45%" stopColor="#F0C66A" />
          <stop offset="100%" stopColor="#8A6224" />
        </linearGradient>
      </defs>

      {/* 左木轴 */}
      <g>
        <ellipse cx="24" cy="90" rx="12" ry="80" fill="url(#rodGold)" stroke="#5A3E1A" strokeWidth="1" />
        <ellipse cx="24" cy="10" rx="12" ry="5" fill="#8A6224" stroke="#5A3E1A" strokeWidth="1" />
        <ellipse cx="24" cy="170" rx="12" ry="5" fill="#8A6224" stroke="#5A3E1A" strokeWidth="1" />
      </g>
      {/* 右木轴 */}
      <g>
        <ellipse cx="496" cy="90" rx="12" ry="80" fill="url(#rodGold)" stroke="#5A3E1A" strokeWidth="1" />
        <ellipse cx="496" cy="10" rx="12" ry="5" fill="#8A6224" stroke="#5A3E1A" strokeWidth="1" />
        <ellipse cx="496" cy="170" rx="12" ry="5" fill="#8A6224" stroke="#5A3E1A" strokeWidth="1" />
      </g>

      {/* 主纸面 */}
      <rect
        x="30"
        y="18"
        width="460"
        height="144"
        rx="2"
        fill="url(#paper)"
        stroke="#8A6224"
        strokeWidth="1.2"
      />
      {/* 纸面上沿阴影 */}
      <rect x="30" y="18" width="460" height="26" fill="url(#paperShade)" opacity="0.5" />
      {/* 纸面下沿阴影 */}
      <rect x="30" y="136" width="460" height="26" fill="url(#paperShade)" opacity="0.6" />

      {/* 装饰金线 · 上下 */}
      <line
        x1="44"
        x2="476"
        y1="30"
        y2="30"
        stroke="#8A6224"
        strokeWidth="0.6"
        opacity="0.55"
      />
      <line
        x1="44"
        x2="476"
        y1="150"
        y2="150"
        stroke="#8A6224"
        strokeWidth="0.6"
        opacity="0.55"
      />
    </svg>
  );
}
