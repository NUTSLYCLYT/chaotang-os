'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Cpu, CheckCircle2, ArrowRight, X } from 'lucide-react';

const SEEN_KEY = 'courtos.onboarding.v1.seen';

interface ContrastRow { label: string; text: string; highlight?: boolean }
interface Step {
  num: string;
  Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  tint: string;
  title: string;
  subtitle: string;
  desc: string;
  contrast: ContrastRow[];
}

const STEPS: Step[] = [
  {
    num: '一',
    Icon: Crown,
    tint: '#F0C66A',
    title: '下旨',
    subtitle: '说出意图，不是填写表单',
    desc: '用自然语言写下你想要完成的目标 — 一句话即可。AI 会自动理解意图、规划执行路径。',
    contrast: [
      { label: '普通软件', text: '填表 → 选选项 → 提交 → 固定流程' },
      { label: 'CourtOS', text: '说目标 → AI 自主决策执行路径', highlight: true },
    ],
  },
  {
    num: '二',
    Icon: Cpu,
    tint: '#6BA0FF',
    title: '蜂群自动执行',
    subtitle: '多个 AI 智能体并行工作',
    desc: '系统将目标拆解为多条子任务，分配给对应的蜂群并行推进。通常 30 秒到 3 分钟完成。',
    contrast: [
      { label: '普通软件', text: '单线程，等一个接一个' },
      { label: 'CourtOS', text: '十个蜂群同时动，你在等待时任务已完成', highlight: true },
    ],
  },
  {
    num: '三',
    Icon: CheckCircle2,
    tint: '#A78BFA',
    title: '批奏报 · 精准决断',
    subtitle: '结果汇报，等你最终裁决',
    desc: '执行完毕后，报告自动进入军机处。摘要清晰，一键批准、退回，或继续追问。',
    contrast: [
      { label: '普通软件', text: '结果黑盒，不知道过程发生了什么' },
      { label: 'CourtOS', text: '每步透明，每个决策都有完整依据', highlight: true },
    ],
  },
];

export function OnboardingHero() {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch { /* private browsing */ }
    setVisible(true);
    const t = setTimeout(() => setEntered(true), 40);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /**/ }
    setEntered(false);
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto px-4 py-8"
      style={{
        background: 'rgba(4, 6, 14, 0.93)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        transition: 'opacity 0.3s ease',
        opacity: entered ? 1 : 0,
      }}
    >
      {/* Background radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% -5%, rgba(240,198,106,0.14), transparent 70%)' }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(rgba(240,198,106,1) 1px, transparent 1px), linear-gradient(90deg, rgba(240,198,106,1) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-[900px]"
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Dismiss */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭引导"
          className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[#6A7299] transition hover:border-white/20 hover:text-[#F5E9C9]"
        >
          <X size={13} />
        </button>

        {/* ── HERO COPY ── */}
        <div className="flex flex-col items-center text-center">
          <div
            className="animate-decree-float mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 35%, #F0C66A, #8A6A2A)',
              boxShadow: '0 0 48px rgba(240,198,106,0.40), 0 0 100px rgba(240,198,106,0.12)',
            }}
          >
            <Crown size={30} className="text-[#04060E]" />
          </div>

          <div className="animate-slide-up-1 text-[10px] uppercase tracking-[0.4em] text-[#F0C66A]/50">
            CourtOS · Autonomous AI Command · 朝堂
          </div>

          <h1
            className="animate-slide-up-1 display-serif mt-5 text-[52px] font-bold leading-[1.08] md:text-[72px] lg:text-[80px]"
            style={{
              background: 'linear-gradient(150deg, #FFFFFF 0%, #F6EFD8 25%, #F0C66A 55%, #C8943A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
            }}
          >
            你不是在用软件
            <br />
            你在指挥
            <span
              style={{
                background: 'linear-gradient(135deg, #F0C66A, #FFE09A, #D4A84B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            > AI 军队</span>
          </h1>

          <p className="animate-slide-up-2 mt-5 max-w-[520px] text-[14px] leading-8 text-[#7A83A8]">
            说出目标 · 蜂群自动分工执行 · 结果汇报等你裁决
            <br />
            <span className="text-[#4A5278]">世界首个多智能体朝堂指挥台</span>
          </p>
        </div>

        {/* ── THREE STEPS ── */}
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`animate-slide-up-${i + 2} relative flex flex-col rounded-2xl border p-5`}
              style={{
                borderColor: `${step.tint}28`,
                background: `radial-gradient(ellipse 120% 80% at 0% 0%, ${step.tint}0C, transparent 55%), rgba(255,255,255,0.015)`,
              }}
            >
              {/* Step number + icon row */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: `${step.tint}1A`, color: step.tint, border: `1px solid ${step.tint}3A` }}
                >
                  {step.num}
                </div>
                <step.Icon size={18} style={{ color: step.tint }} />
              </div>

              <div className="mt-4">
                <div className="text-[15px] font-semibold text-[#F5E9C9]">{step.title}</div>
                <div className="mt-0.5 text-[11px]" style={{ color: `${step.tint}99` }}>{step.subtitle}</div>
              </div>

              <p className="mt-3 text-[12px] leading-[1.7] text-[#8A92B4]">{step.desc}</p>

              {/* Contrast callout */}
              <div
                className="mt-4 space-y-1.5 rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {step.contrast.map((c) => (
                  <div key={c.label} className="flex items-start gap-2 text-[10px] leading-[1.6]">
                    <span
                      className="mt-px shrink-0 rounded px-1.5 py-0.5 font-medium"
                      style={
                        c.highlight
                          ? { background: `${step.tint}22`, color: step.tint }
                          : { background: 'rgba(255,255,255,0.04)', color: '#4A5278' }
                      }
                    >
                      {c.label}
                    </span>
                    <span style={{ color: c.highlight ? '#C8CDD8' : '#4A5278' }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/throne/compose"
            onClick={dismiss}
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-9 py-3.5 text-[13px] font-bold text-[#04060E] transition-all hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98]"
            style={{
              background: 'linear-gradient(110deg, #F0C66A 0%, #E0A83A 40%, #F0C66A 70%, #D4A84B 100%)',
              backgroundSize: '200% auto',
              animation: 'shimmer-h 2.8s linear infinite',
              boxShadow: '0 0 40px rgba(240,198,106,0.38), 0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <Crown size={15} />
            立即下达第一道旨意
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>

          <button
            type="button"
            onClick={dismiss}
            className="text-[11px] tracking-wide text-[#4A5278] transition hover:text-[#8A92B4]"
          >
            已了解，先自己探索
          </button>
        </div>

        {/* Bottom tagline */}
        <div className="mt-8 text-center text-[10px] uppercase tracking-[0.28em] text-[#2A3258]">
          CourtOS · Autonomous AI Command · 朝堂
        </div>
      </div>
    </div>
  );
}
