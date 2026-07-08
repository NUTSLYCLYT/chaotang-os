/**
 * 朝堂 OS · 登朝大片（3.5s 开场仪式）
 *
 * 触发：每天第一次进入 /overview（localStorage 按日期存一个 key）。
 * 流程：
 *   0.0s  黑屏 + 金点萌动
 *   0.4s  「朝堂 OS · 陛下登朝」八字浮现（篆书风格金字）
 *   0.8s  御座 panorama 从远推近 + vignette 揭开
 *   1.6s  11 部 orbit 点亮序列（每 80ms 一位）
 *   2.6s  八方文字淡出 + 光晕收束
 *   3.2s  整体淡出 → 进入主页
 *
 * 任意键、任意点击 → 跳过。
 * "今日已登朝"后不再触发。
 */

'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { assetUrl } from '@/lib/asset';

const SESSION_KEY = 'courtos.opening.played'; // sessionStorage — tab 内只播一次
const MUTE_KEY = 'courtos.opening.mute'; // localStorage — 永久关闭

/** 11 部 orbit 的围绕角度（围一圈） */
const MINISTER_ANGLES = Array.from({ length: 11 }, (_, i) => (i * 360) / 11);

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

function getSeason(d: Date = new Date()): Season {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

const SEASON_META: Record<Season, { title: string; sub: string; tint: string }> = {
  spring: {
    title: '春和景明 · 陛下登朝',
    sub: '万物萌发 · 百事待兴',
    tint: 'rgba(144,205,124,0.08)', // 淡青
  },
  summer: {
    title: '骄阳临朝 · 陛下御极',
    sub: '日盛千里 · 四海无险',
    tint: 'rgba(240,198,106,0.10)', // 金暖
  },
  autumn: {
    title: '秋高气清 · 陛下听政',
    sub: '五谷归仓 · 百官呈报',
    tint: 'rgba(203,148,82,0.10)', // 金褐
  },
  winter: {
    title: '瑞雪登朝 · 陛下御殿',
    sub: '岁末结算 · 朝堂肃然',
    tint: 'rgba(180,200,230,0.08)', // 冷蓝
  },
};

export function CourtOpeningCeremony() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const season = getSeason();
  const seasonMeta = SEASON_META[season];
  const prefersReducedMotion = useReducedMotion();

  // 尊重 OS 级别的动画偏好 · a11y 硬性要求
  useEffect(() => {
    if (!visible || !prefersReducedMotion) return;
    setPhase(3);
    const t = setTimeout(() => {
      try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
      setVisible(false);
    }, 600);
    return () => clearTimeout(t);
  }, [visible, prefersReducedMotion]);

  // 触发判定
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('replay') === '1') { setVisible(true); return; }
      if (window.localStorage.getItem(MUTE_KEY) === '1') return;
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return; // 本 tab 已播
    } catch { /* ignore */ }
    setVisible(true);
  }, []);

  // 阶段推进
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 400); // 标题浮现
    const t2 = setTimeout(() => setPhase(2), 800); // panorama 推近
    const t3 = setTimeout(() => setPhase(3), 1600); // 群臣点亮
    const t4 = setTimeout(() => finish(), 3400); // 淡出
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [visible]);

  // 跳过
  useEffect(() => {
    if (!visible) return;
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('click', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
    };
  }, [visible]);

  function finish() {
    try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  }

  function muteForever() {
    try {
      window.localStorage.setItem(MUTE_KEY, '1');
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch { /* ignore */ }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="court-opening"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] overflow-hidden bg-[#04030a]"
          role="presentation"
          aria-label="朝堂登朝"
        >
          {/* 黑色基底 */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#08050a] via-[#04030a] to-[#02010a]" />

          {/* 放射金色底光 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: phase >= 2 ? 0.8 : 0, scale: phase >= 2 ? 1 : 0.7 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 55%, rgba(240,198,106,0.25) 0%, rgba(240,198,106,0.08) 30%, transparent 70%)',
            }}
          />

          {/* 御座 panorama */}
          <motion.div
            initial={{ opacity: 0, scale: 1.25 }}
            animate={{
              opacity: phase >= 2 ? 0.55 : 0,
              scale: phase >= 2 ? 1 : 1.25,
            }}
            transition={{ duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0"
          >
            <img
              src={assetUrl('/heroes/7-throne.webp')}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: 'center 40%' }}
            />
            {/* 二层金色 vignette */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(4,3,10,0.88) 75%)',
              }}
            />
          </motion.div>

          {/* 粒子金尘 · 12 颗发光星屑 · 覆盖全屏 */}
          <div className="pointer-events-none absolute inset-0">
            {[
              { x: '14%', y: '22%', delay: 0.2 },
              { x: '30%', y: '12%', delay: 0.5 },
              { x: '48%', y: '8%', delay: 0.3 },
              { x: '68%', y: '14%', delay: 0.7 },
              { x: '86%', y: '22%', delay: 0.4 },
              { x: '22%', y: '44%', delay: 0.8 },
              { x: '78%', y: '40%', delay: 0.6 },
              { x: '8%', y: '62%', delay: 1.0 },
              { x: '40%', y: '70%', delay: 0.9 },
              { x: '60%', y: '74%', delay: 0.5 },
              { x: '92%', y: '64%', delay: 1.1 },
              { x: '50%', y: '86%', delay: 0.3 },
            ].map((p, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.6, 0.8] }}
                transition={{
                  duration: 2.4,
                  delay: p.delay,
                  ease: 'easeOut',
                  repeat: 1,
                }}
                className="absolute h-2 w-2 rounded-full"
                style={{
                  left: p.x,
                  top: p.y,
                  background:
                    'radial-gradient(circle, #F5E9C9, rgba(240,198,106,0.4))',
                  filter: 'blur(0.4px)',
                  boxShadow: '0 0 16px rgba(240,198,106,0.8)',
                }}
              />
            ))}
          </div>

          {/* 11 部 orbit 点亮序列（中心向外辐射） */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[520px] w-[520px]">
              {MINISTER_ANGLES.map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const radius = 220;
                const cx = 260 + Math.cos(rad) * radius;
                const cy = 260 + Math.sin(rad) * radius;
                return (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: phase >= 3 ? [0, 1, 0.8] : 0,
                      scale: phase >= 3 ? [0, 1.4, 1] : 0,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: phase >= 3 ? 0.06 * i : 0,
                      ease: 'easeOut',
                    }}
                    className="absolute h-3 w-3 rounded-full"
                    style={{
                      left: cx,
                      top: cy,
                      background:
                        'radial-gradient(circle, #F5E9C9, #F0C66A 50%, transparent)',
                      boxShadow: '0 0 18px rgba(240,198,106,0.9)',
                    }}
                  />
                );
              })}
              {/* 中心丞相点 */}
              <motion.span
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: phase >= 3 ? [0, 1, 1] : 0,
                  scale: phase >= 3 ? [0, 1.8, 1] : 0,
                }}
                transition={{
                  duration: 0.7,
                  delay: phase >= 3 ? 0.7 : 0,
                  ease: 'easeOut',
                }}
                className="absolute h-5 w-5 rounded-full"
                style={{
                  left: 250,
                  top: 250,
                  background:
                    'radial-gradient(circle, #FFFFFF, #F0C66A 40%, transparent)',
                  boxShadow: '0 0 28px rgba(240,198,106,1)',
                }}
              />
            </div>
          </div>

          {/* 标题 · 朝堂 OS · 陛下登朝 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              initial={{ opacity: 0, letterSpacing: '0.9em', y: 12 }}
              animate={{
                opacity: phase >= 1 ? 1 : 0,
                letterSpacing: phase >= 1 ? '0.24em' : '0.9em',
                y: phase >= 1 ? 0 : 12,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="text-[14px] font-semibold uppercase tracking-[0.5em]"
              style={{ color: '#F0C66A' }}
            >
              CourtOS · Imperial Court OS
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{
                opacity: phase >= 1 ? 1 : 0,
                y: phase >= 1 ? 0 : 32,
              }}
              transition={{ duration: 1.6, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="mt-6 text-center text-[40px] font-black leading-[1.05] tracking-[0.18em] md:text-[64px]"
              style={{
                color: '#F5E9C9',
                fontFamily: '"Noto Serif SC", serif',
                textShadow:
                  '0 4px 20px rgba(0,0,0,0.9), 0 0 40px rgba(240,198,106,0.45)',
                background:
                  'linear-gradient(180deg, #FFF5D6 0%, #F0C66A 45%, #C29A42 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {seasonMeta.title}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{
                opacity: phase >= 1 ? 0.8 : 0,
                width: phase >= 1 ? '280px' : 0,
              }}
              transition={{ duration: 1.4, delay: 0.5 }}
              className="mt-7 h-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #F0C66A 50%, transparent)',
                boxShadow: '0 0 12px rgba(240,198,106,0.7)',
              }}
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 2 ? 0.78 : 0 }}
              transition={{ duration: 1.2, delay: 0.4 }}
              className="mt-7 max-w-[560px] text-center text-[13px] leading-[1.8] tracking-[0.24em]"
              style={{
                color: '#E6DBBC',
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              {seasonMeta.sub} · 金玺已备 · 请陛下接见
            </motion.div>
          </div>

          {/* 顶部金线 */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{
              opacity: phase >= 1 ? 1 : 0,
              scaleX: phase >= 1 ? 1 : 0,
            }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-x-0 top-0 h-[2px] origin-center"
            style={{
              background:
                'linear-gradient(90deg, transparent, #F0C66A 50%, transparent)',
              boxShadow: '0 1px 12px rgba(240,198,106,0.8)',
            }}
          />
          {/* 底部金线 */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{
              opacity: phase >= 1 ? 1 : 0,
              scaleX: phase >= 1 ? 1 : 0,
            }}
            transition={{ duration: 1.2, delay: 0.2, ease: 'easeOut' }}
            className="absolute inset-x-0 bottom-0 h-[2px] origin-center"
            style={{
              background:
                'linear-gradient(90deg, transparent, #F0C66A 50%, transparent)',
              boxShadow: '0 -1px 12px rgba(240,198,106,0.8)',
            }}
          />

          {/* 跳过提示 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 2 ? 0.55 : 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute bottom-6 right-6 flex items-center gap-3 text-[11px] tracking-[0.28em] text-[#8F835F]"
          >
            <span className="flex items-center gap-2">
              <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[11px]">
                按任意键
              </span>
              跳过
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                muteForever();
              }}
              className="pointer-events-auto rounded border border-white/15 bg-white/5 px-2.5 py-1 font-mono text-[11px] tracking-[0.2em] text-[#8F835F] transition hover:border-[#F0C66A]/40 hover:bg-[#F0C66A]/8 hover:text-[#F0C66A]"
            >
              今后不再登朝
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
