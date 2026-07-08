/**
 * 朝堂 OS V2 · PageGuidePanel
 *
 * 每个主页面的"说明"Tab 共享模板。四段式：
 *   这是什么 (What)  —— 一句话定义
 *   怎么用   (How)   —— 3 步操作路径
 *   价值     (Value) —— 3 条核心价值
 *   设计理念 (Why)   —— 为什么这样做 / 与传统方案差异
 *
 * 视觉按部门 accent 变奏（传入 accent 色），保证统一感 + 部门识别度。
 */

'use client';

import type { LucideIcon } from 'lucide-react';
import { Compass, ArrowRight, Sparkles, Lightbulb } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface PageGuideStep {
  /** 短标题（如 "先看总分"） */
  title: string;
  /** 说明 1-2 句 */
  body: string;
}

export interface PageGuideValue {
  /** 价值标题 */
  title: string;
  /** 说明 1-2 句 */
  body: string;
}

export interface PageGuidePanelProps {
  /** 部门中文名（大字） */
  department: string;
  /** 英文副标 */
  english: string;
  /** 部门图标 */
  icon: LucideIcon;
  /** 部门主色 */
  accent: string;
  /** 这是什么（一句话定义） */
  what: string;
  /** 怎么用（3 步） */
  how: PageGuideStep[];
  /** 价值（3 条） */
  value: PageGuideValue[];
  /** 设计理念（为什么这样做 · 1-2 段） */
  philosophy: string;
  /** 可选：与传统方案的对比短句（如 "传统 BI：一堆图表，要自己判断。太医院：先给你判断"） */
  contrast?: { traditional: string; ours: string };
}

export function PageGuidePanel({
  department,
  english,
  icon: Icon,
  accent,
  what,
  how,
  value,
  philosophy,
  contrast,
}: PageGuidePanelProps) {
  return (
    <div className="space-y-5">
      {/* Hero · 这是什么 */}
      <GlassPanel tone="elevated" padding="lg" className="relative overflow-hidden">
        {/* 部门配色光晕背景 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(circle at 15% 0%, ${accent}22, transparent 55%), radial-gradient(circle at 85% 100%, ${accent}12, transparent 50%)`,
          }}
        />
        <div className="relative flex items-start gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${accent}33, ${accent}0a)`,
              border: `1px solid ${accent}55`,
              boxShadow: `0 4px 30px ${accent}22, inset 0 1px 0 ${accent}40`,
            }}
          >
            <Icon size={26} style={{ color: accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: `${accent}` }}
            >
              页面定位
            </div>
            <h2
              className="mt-2 text-[26px] font-semibold leading-tight"
              style={{ color: '#F5E9C9' }}
            >
              {department}一页说明
            </h2>
            <p className="mt-3 max-w-[70ch] text-[14px] leading-8 text-[#C8CDD8]">
              {what}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* 怎么用 · 3 步 */}
      <section>
        <SectionHeader
          icon={Compass}
          accent={accent}
          eyebrow="怎么用"
          title="三步走，不走回头路。"
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {how.map((step, i) => (
            <div
              key={step.title}
              className="relative overflow-hidden rounded-lg border bg-black/20 p-4"
              style={{ borderColor: `${accent}22` }}
            >
              <div
                aria-hidden
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40"
                style={{
                  background: `radial-gradient(circle, ${accent}33, transparent 70%)`,
                }}
              />
              <div
                className="relative flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[12px]"
                style={{
                  background: `${accent}1a`,
                  border: `1px solid ${accent}55`,
                  color: accent,
                }}
              >
                {i + 1}
              </div>
              <div
                className="relative mt-3 text-[14px] font-semibold"
                style={{ color: '#F5E9C9' }}
              >
                {step.title}
              </div>
              <div className="relative mt-2 text-[12px] leading-6 text-[#A7B0CC]">
                {step.body}
              </div>
              {i < how.length - 1 && (
                <ArrowRight
                  size={14}
                  className="absolute -right-2 top-1/2 hidden -translate-y-1/2 md:block"
                  style={{ color: `${accent}88` }}
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 价值 · 3 条 */}
      <section>
        <SectionHeader
          icon={Sparkles}
          accent={accent}
          eyebrow="核心价值"
          title="这页能替你赚回的时间。"
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {value.map((v) => (
            <div
              key={v.title}
              className="rounded-lg border border-white/8 bg-white/[0.025] p-4"
            >
              <div
                className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  background: `${accent}14`,
                  color: accent,
                  border: `1px solid ${accent}44`,
                }}
              >
                  价值点
              </div>
              <div
                className="mt-3 text-[14px] font-semibold"
                style={{ color: '#F5E9C9' }}
              >
                {v.title}
              </div>
              <div className="mt-2 text-[12px] leading-6 text-[#A7B0CC]">{v.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 设计理念 · Why + contrast */}
      <section>
        <SectionHeader
          icon={Lightbulb}
          accent={accent}
          eyebrow="为什么这样做"
          title="传统方案给你数据，这里给你判断。"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassPanel tone="deep" padding="md">
            <p
              className="text-[13px] leading-8"
              style={{ color: '#D6CCB0' }}
            >
              {philosophy}
            </p>
          </GlassPanel>
          {contrast && (
            <div className="space-y-3">
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6A7299]">
                  传统方案
                </div>
                <div className="mt-2 text-[12px] leading-6 text-[#9AA3C4]">
                  {contrast.traditional}
                </div>
              </div>
              <div
                className="rounded-lg border p-4"
                style={{
                  borderColor: `${accent}55`,
                  background: `linear-gradient(135deg, ${accent}14, ${accent}04)`,
                  boxShadow: `0 4px 20px ${accent}14`,
                }}
              >
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: accent }}
                >
                  本页做法
                </div>
                <div
                  className="mt-2 text-[12px] leading-6"
                  style={{ color: '#F5E9C9' }}
                >
                  {contrast.ours}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  accent,
  eyebrow,
  title,
}: {
  icon: LucideIcon;
  accent: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${accent}26, ${accent}08)`,
          border: `1px solid ${accent}55`,
        }}
      >
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div>
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: accent }}
        >
          {eyebrow}
        </div>
        <div
          className="mt-1 text-[16px] font-semibold"
          style={{ color: '#F5E9C9' }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
