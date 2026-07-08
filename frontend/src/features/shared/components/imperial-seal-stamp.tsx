/**
 * 朝堂 OS · 玺印落印 0.8s 批示动画
 *
 * 全站统一的"确认/批示"仪式化交互。
 *
 * 触发：任何代码中 dispatch `court:seal-stamp` 事件
 *   window.dispatchEvent(new CustomEvent('court:seal-stamp', {
 *     detail: { verdict: '准' | '驳' | '再议', note?: '某月某日' }
 *   }))
 *
 *   或使用 useImperialSeal() hook：
 *   const stamp = useImperialSeal()
 *   stamp({ verdict: '准' })
 *
 * 流程：
 *   0.00s  金玺从右上飞入 · 悬停在屏幕中心
 *   0.18s  短暂悬停（蓄势）
 *   0.30s  下砸 · 放大后缩回 · 轻微旋转
 *   0.40s  红色印泥从中心扩散
 *   0.50s  印文「准·XX」浮现
 *   0.80s  整体淡出
 *
 * 依赖：framer-motion（已有）
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';

export type Verdict = '准' | '驳' | '再议' | '行' | '查';

const VERDICT_COLOR: Record<Verdict, string> = {
  准: '#C03030',
  行: '#C03030',
  驳: '#A02828',
  再议: '#8A6224',
  查: '#5A7CB8',
};

export interface SealStampEvent {
  verdict: Verdict;
  /** 可选 · 印章下方的日期/备注 */
  note?: string;
  /** 可选 · 强制重复一次动画（通过改变 key） */
  nonce?: number;
}

interface InternalState extends SealStampEvent {
  id: number;
}

declare global {
  interface WindowEventMap {
    'court:seal-stamp': CustomEvent<SealStampEvent>;
  }
}

/** 随手可调用的 hook */
export function useImperialSeal() {
  return useCallback((payload: SealStampEvent) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('court:seal-stamp', { detail: payload }));
  }, []);
}

/** 中文年月日（用天干/简化版） */
function formatChineseDate(d: Date = new Date()): string {
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

/* ========================================================================== *
 *  Overlay · 挂在 root layout 全站可用
 * ========================================================================== */

export function SealStampOverlay() {
  const [queue, setQueue] = useState<InternalState[]>([]);

  // 监听事件
  useEffect(() => {
    const handler = (e: CustomEvent<SealStampEvent>) => {
      const payload = e.detail;
      const next: InternalState = {
        ...payload,
        id: Date.now() + Math.random(),
      };
      setQueue((q) => [...q, next]);
      // 玺印动画跑完后弹 toast 文字反馈（0.85s 后）
      setTimeout(() => {
        const verdictText: Record<Verdict, string> = {
          准: '已批 · 入史馆',
          行: '令已发 · 群臣分派',
          驳: '已驳 · 待重议',
          再议: '搁置 · 待复核',
          查: '已批"查" · 转御巡台',
        };
        const message = verdictText[payload.verdict] ?? '已落印';
        toast.success(message, {
          description: payload.note ?? undefined,
          icon: '🏯',
          action:
            payload.verdict === '准' || payload.verdict === '行'
              ? {
                  label: '生成朱批卡',
                  onClick: () => {
                    window.dispatchEvent(
                      new CustomEvent('court:verdict-card', {
                        detail: {
                          highlights: [
                            payload.note || '陛下今日御前决断一锤定音',
                            '丞相总批 · 六部执行 · 史馆归档',
                            '朝堂流程闭环 · 下一朝见',
                          ],
                          primeMinisterVerdict:
                            '决策既定 · 群臣奉行 · 此案入史馆传世。',
                          verdict: payload.verdict,
                        },
                      }),
                    );
                  },
                }
              : undefined,
        });
      }, 850);
      // 0.95s 后自动移除
      setTimeout(() => {
        setQueue((q) => q.filter((x) => x.id !== next.id));
      }, 950);
    };
    window.addEventListener('court:seal-stamp', handler as EventListener);
    return () => window.removeEventListener('court:seal-stamp', handler as EventListener);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[150] flex items-center justify-center">
      <AnimatePresence>
        {queue.map((item) => (
          <SealInstance key={item.id} data={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ========================================================================== *
 *  单次动画实例
 * ========================================================================== */

function SealInstance({ data }: { data: InternalState }) {
  const color = VERDICT_COLOR[data.verdict] ?? VERDICT_COLOR['准'];
  const note = data.note ?? formatChineseDate();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div
        className="relative flex flex-col items-center"
        style={{ color }}
      >
        <SealSvg verdict={data.verdict} color={color} />
        <div
          className="mt-2 text-[20px] font-black tracking-[0.32em]"
          style={{ color, fontFamily: '"Noto Serif SC", serif' }}
        >
          {data.verdict}
        </div>
        <div className="text-[11px] tracking-[0.24em]" style={{ color: `${color}dd` }}>
          {note}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 金色外圈光晕（伴随印章压下时爆开） */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{
          opacity: [0, 0.9, 0],
          scale: [0.4, 2.4, 3.2],
        }}
        transition={{
          duration: 0.8,
          times: [0, 0.38, 1],
          ease: 'easeOut',
          delay: 0.28,
        }}
        className="absolute inset-0 -left-40 -top-40 h-80 w-80 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}88 0%, ${color}22 40%, transparent 70%)`,
          filter: 'blur(4px)',
        }}
      />

      {/* 印章本体 */}
      <motion.div
        initial={{
          opacity: 0,
          x: 360,
          y: -260,
          scale: 0.6,
          rotate: 22,
        }}
        animate={{
          opacity: [0, 1, 1, 1, 0.95, 0],
          x: [360, 0, 0, 0, 0, 0],
          y: [-260, 0, 0, 8, 0, 0],
          scale: [0.6, 1.05, 0.95, 1.2, 1.0, 1.0],
          rotate: [22, 0, 0, -4, 0, 0],
        }}
        transition={{
          duration: 0.88,
          times: [0, 0.26, 0.32, 0.42, 0.54, 1],
          ease: 'easeOut',
        }}
        className="relative flex h-[160px] w-[160px] items-center justify-center"
      >
        <SealSvg verdict={data.verdict} color={color} />
      </motion.div>

      {/* 印文·底部日期 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: [0, 0, 1, 1, 0],
          y: [20, 20, 0, 0, -10],
        }}
        transition={{
          duration: 0.88,
          times: [0, 0.52, 0.62, 0.86, 1],
          ease: 'easeOut',
        }}
        className="absolute left-1/2 top-[170px] -translate-x-1/2 whitespace-nowrap text-center"
      >
        <div
          className="text-[28px] font-black tracking-[0.4em]"
          style={{
            color,
            fontFamily: '"Noto Serif SC", serif',
            textShadow: `0 2px 10px ${color}88, 0 0 20px rgba(0,0,0,0.8)`,
          }}
        >
          {data.verdict}
        </div>
        <div
          className="mt-1 text-[11px] tracking-[0.32em]"
          style={{ color: `${color}dd` }}
        >
          {note}
        </div>
      </motion.div>

      {/* 印泥扩散圈（印章压下后第二波） */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{
          opacity: [0, 0.5, 0],
          scale: [0.2, 2.8, 4.2],
        }}
        transition={{
          duration: 0.7,
          times: [0, 0.3, 1],
          ease: 'easeOut',
          delay: 0.34,
        }}
        className="absolute inset-0 -left-40 -top-40 h-80 w-80 rounded-full"
        style={{
          background: `radial-gradient(circle, transparent 48%, ${color}55 55%, transparent 75%)`,
        }}
      />

      {/* 盖下瞬间的金色火星飞溅（8 粒） */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 70 + Math.random() * 30;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 10;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0],
              x: [0, dx],
              y: [0, dy],
              scale: [0.4, 1.2, 0.6],
            }}
            transition={{
              duration: 0.55,
              delay: 0.34 + i * 0.02,
              ease: 'easeOut',
              times: [0, 0.25, 1],
            }}
            className="absolute left-1/2 top-1/2 h-[5px] w-[5px] rounded-full"
            style={{
              background: 'radial-gradient(circle, #FFF5D6, #F0C66A 60%, transparent)',
              boxShadow: '0 0 8px rgba(240,198,106,0.9)',
            }}
          />
        );
      })}
    </div>
  );
}

/* ========================================================================== *
 *  玺印 SVG · 古代皇帝方形朱印 · 正面带字
 * ========================================================================== */

function SealSvg({ verdict, color }: { verdict: Verdict; color: string }) {
  return (
    <svg
      viewBox="0 0 160 160"
      className="h-full w-full drop-shadow-[0_12px_28px_rgba(0,0,0,0.7)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="sealBodyGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE7A6" />
          <stop offset="45%" stopColor="#F0C66A" />
          <stop offset="100%" stopColor="#8A6224" />
        </linearGradient>
        <linearGradient id="sealBodyShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
        <linearGradient id="sealFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DC3A3A" />
          <stop offset="100%" stopColor="#8A1818" />
        </linearGradient>
      </defs>

      {/* 印章顶部的螭龙钮（简化为金柱 + 球） */}
      <g transform="translate(80, 22)">
        {/* 底座 */}
        <rect
          x="-22"
          y="20"
          width="44"
          height="8"
          rx="2"
          fill="url(#sealBodyGold)"
          stroke="#8A6224"
          strokeWidth="0.8"
        />
        {/* 柱 */}
        <rect
          x="-10"
          y="6"
          width="20"
          height="16"
          fill="url(#sealBodyGold)"
          stroke="#8A6224"
          strokeWidth="0.6"
        />
        {/* 顶部螭龙球 */}
        <circle cx="0" cy="2" r="8" fill="url(#sealBodyGold)" stroke="#8A6224" strokeWidth="0.6" />
        <circle cx="-2" cy="0" r="2" fill="rgba(255,255,255,0.6)" />
        {/* 龙须纹路 */}
        <path
          d="M -6 2 Q 0 -6 6 2"
          stroke="#8A6224"
          strokeWidth="0.8"
          fill="none"
        />
      </g>

      {/* 主印体（正方形） */}
      <g transform="translate(20, 48)">
        {/* 阴影底 */}
        <rect x="2" y="4" width="120" height="100" rx="4" fill="rgba(0,0,0,0.5)" />
        {/* 金边框 */}
        <rect
          x="0"
          y="0"
          width="120"
          height="100"
          rx="4"
          fill="url(#sealBodyGold)"
          stroke="#8A6224"
          strokeWidth="1.4"
        />
        {/* 左上金色高光条 */}
        <rect
          x="0"
          y="0"
          width="120"
          height="100"
          rx="4"
          fill="url(#sealBodyShade)"
          opacity="0.6"
        />
        {/* 四周金色竖纹装饰 */}
        {[14, 30, 90, 106].map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={10}
            y2={90}
            stroke="#8A6224"
            strokeWidth="0.5"
            opacity="0.5"
          />
        ))}
        {/* 印面朱红核心 */}
        <rect
          x="12"
          y="12"
          width="96"
          height="76"
          rx="3"
          fill="url(#sealFace)"
          stroke="#8A1818"
          strokeWidth="1.2"
        />
        {/* 印面内细框 */}
        <rect
          x="17"
          y="17"
          width="86"
          height="66"
          rx="1.5"
          fill="none"
          stroke="#FFD6D6"
          strokeWidth="0.8"
          opacity="0.5"
        />
        {/* 印字 */}
        <text
          x="60"
          y="62"
          textAnchor="middle"
          fontSize="48"
          fontWeight="900"
          fontFamily='"Noto Serif SC", serif'
          fill="#FFFFFF"
          style={{
            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.6))',
          }}
        >
          {verdict}
        </text>
      </g>

      {/* 整体金光锁边效果（环绕印章） */}
      <rect
        x="18"
        y="46"
        width="124"
        height="104"
        rx="5"
        fill="none"
        stroke={color}
        strokeWidth="0.6"
        opacity="0.6"
      />
    </svg>
  );
}
