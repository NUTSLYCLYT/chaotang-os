/**
 * 朝堂 OS V2 · 大殿 · 钦天监 · 先知导师
 *
 * 大殿的"吉祥物钩子"：
 *   - 圆形 SVG 头像（乌纱帽 + 圆脸 + 红袍领）
 *   - 右侧说话泡，自动轮播重要通报
 *   - 点击展开 4 个快速动作，一键跳转
 *   - 永久脉冲外环暗示"这里有事"
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Users, ScrollText, Radar, Telescope, Sparkles, ChevronRight } from 'lucide-react';

export interface EunuchMessage {
  text: string;
  urgency?: 'normal' | 'alert';
}

export interface EunuchAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

const DEFAULT_MESSAGES: EunuchMessage[] = [
  { text: '禀陛下 · 军机处有 3 件急章等您定夺', urgency: 'alert' },
  { text: '禀陛下 · 户部春粮收仓已达九成二', urgency: 'normal' },
  { text: '禀陛下 · 锦衣卫西北方向烽火 1 条', urgency: 'alert' },
  { text: '禀陛下 · 钦天监说北方 90 天窗口已开', urgency: 'normal' },
  { text: '钦天监候星中 · 有疑问时只提示下一步', urgency: 'normal' },
];

const DEFAULT_ACTIONS: EunuchAction[] = [
  { label: '传丞相', href: '/command-center', icon: Users },
  { label: '御前简报', href: '/throne', icon: ScrollText },
  { label: '召锦衣卫', href: '/intel', icon: Radar },
  { label: '问钦天监', href: '/forecast', icon: Telescope },
];

export function EunuchMascot({
  messages = DEFAULT_MESSAGES,
  actions = DEFAULT_ACTIONS,
}: {
  messages?: EunuchMessage[];
  actions?: EunuchAction[];
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [messages.length, expanded]);

  const current = messages[index];
  const isAlert = current?.urgency === 'alert';
  const accent = isAlert ? '#F5A524' : '#F0C66A';

  return (
    <div className="relative flex items-center gap-4 rounded-2xl border border-[#F0C66A]/25 bg-gradient-to-r from-[#1c160a] to-[#0f0b06] px-5 py-4">
      {/* 脉冲外环（一直在叫陛下） */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[12px] top-[12px] h-[64px] w-[64px] animate-ping rounded-full opacity-30"
        style={{ background: `radial-gradient(circle, ${accent}88, transparent 70%)` }}
      />

      {/* 钦天监头像 */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="relative z-10 shrink-0 transition-transform hover:scale-[1.03] active:scale-95"
        title="点钦天监问策"
      >
        <EunuchAvatar accent={accent} />
      </button>

      {/* 名号 + 说话泡 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className="text-[11px] font-bold tracking-[0.24em]"
            style={{ color: accent, fontFamily: '"Noto Serif SC", serif' }}
          >
            钦天监
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#8A92AC]">
            先知导师
          </div>
          <div
            className="ml-auto flex items-center gap-1 text-[11px]"
            style={{ color: accent, opacity: 0.8 }}
          >
            <Sparkles size={10} />
            候旨中
          </div>
        </div>

        {/* 说话泡 */}
        <div
          key={index}
          className="mt-1.5 animate-[fadeIn_0.5s_ease-out] text-[13.5px] font-medium leading-[1.6] tracking-[0.02em]"
          style={{
            color: isAlert ? '#F5A524' : '#F5E9C9',
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          「{current?.text}」
        </div>

        {/* 轮播指示 */}
        <div className="mt-2 flex items-center gap-1.5">
          {messages.map((_, i) => (
            <span
              key={i}
              className="h-[2px] w-4 rounded-full transition-all"
              style={{
                background: i === index ? accent : 'rgba(255,255,255,0.12)',
                width: i === index ? '18px' : '10px',
              }}
            />
          ))}
          <span className="ml-2 text-[11px] text-[#6A7299]">
            点头像打开快速动作 →
          </span>
        </div>
      </div>

      {/* 展开的动作面板 */}
      {expanded && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-[#F0C66A]/30 bg-[#0a0704]/98 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          style={{
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            钦天监为陛下问策
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setExpanded(false)}
                  className="group flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-[12px] transition-all hover:border-[#F0C66A]/40 hover:bg-[#F0C66A]/10"
                >
                  <Icon size={13} style={{ color: accent }} />
                  <span
                    className="flex-1 font-semibold"
                    style={{ color: '#F5E9C9', fontFamily: '"Noto Serif SC", serif' }}
                  >
                    {a.label}
                  </span>
                  <ChevronRight
                    size={11}
                    className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-80"
                    style={{ color: accent }}
                  />
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-2 w-full rounded-lg border border-white/8 bg-white/[0.02] py-1.5 text-[11px] text-[#8A92AC] hover:bg-white/[0.04]"
          >
            收起
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
 * EunuchAvatar · 钦天监头像 SVG
 *   - 乌纱帽（黑圆帽 + 左右帽翅）
 *   - 圆脸（米黄）+ 眯眯笑眼 + 小嘴
 *   - 红袍领 + 中央金扣
 * ========================================================================== */

function EunuchAvatar({ accent = '#F0C66A' }: { accent?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className="h-[68px] w-[68px] drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
      aria-label="钦天监"
    >
      {/* 外金圈 */}
      <defs>
        <radialGradient id="face-grad" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#fce8c1" />
          <stop offset="100%" stopColor="#d4a870" />
        </radialGradient>
        <linearGradient id="hat-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2a1f12" />
          <stop offset="100%" stopColor="#0e0a05" />
        </linearGradient>
        <linearGradient id="robe-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a82020" />
          <stop offset="100%" stopColor="#5a0f0f" />
        </linearGradient>
      </defs>

      {/* 外发光环 */}
      <circle cx="40" cy="40" r="37" fill="none" stroke={`${accent}aa`} strokeWidth="1" opacity="0.6" />
      <circle cx="40" cy="40" r="35" fill="#0a0704" />

      {/* 红袍领（下部） */}
      <path d="M 14 62 L 40 52 L 66 62 L 66 72 L 14 72 Z" fill="url(#robe-grad)" />
      {/* 领边金线 */}
      <path d="M 14 62 L 40 52 L 66 62" stroke={accent} strokeWidth="1.2" fill="none" opacity="0.8" />
      {/* 金扣 */}
      <circle cx="40" cy="63" r="2" fill={accent} />
      <circle cx="40" cy="63" r="3" fill="none" stroke={`${accent}66`} strokeWidth="0.8" />

      {/* 圆脸 */}
      <circle cx="40" cy="42" r="15" fill="url(#face-grad)" />

      {/* 眯眯笑眼（小弯弧） */}
      <path d="M 31 41 Q 33.5 43 36 41" stroke="#3A2614" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M 44 41 Q 46.5 43 49 41" stroke="#3A2614" strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* 红嫩两颊 */}
      <circle cx="31" cy="46.5" r="1.8" fill="#e08080" opacity="0.5" />
      <circle cx="49" cy="46.5" r="1.8" fill="#e08080" opacity="0.5" />

      {/* 小嘴 */}
      <path d="M 37 49 Q 40 51.5 43 49" stroke="#6a2a1a" strokeWidth="1.1" fill="none" strokeLinecap="round" />

      {/* 乌纱帽主体 */}
      <rect x="26" y="22" width="28" height="10" rx="3" fill="url(#hat-grad)" />
      {/* 帽顶圆 */}
      <ellipse cx="40" cy="22" rx="14" ry="4" fill="url(#hat-grad)" />
      {/* 帽翅（两侧长条） */}
      <rect x="4" y="25" width="24" height="3.5" rx="1.5" fill="url(#hat-grad)" />
      <rect x="52" y="25" width="24" height="3.5" rx="1.5" fill="url(#hat-grad)" />
      {/* 帽翅尖端金点 */}
      <circle cx="6" cy="26.75" r="1" fill={accent} opacity="0.85" />
      <circle cx="74" cy="26.75" r="1" fill={accent} opacity="0.85" />
      {/* 帽正中金饰 */}
      <circle cx="40" cy="22" r="2.2" fill={accent} opacity="0.9" />
      <circle cx="40" cy="22" r="3.4" fill="none" stroke={`${accent}88`} strokeWidth="0.8" />
    </svg>
  );
}
