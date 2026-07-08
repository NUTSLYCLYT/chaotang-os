'use client';

/**
 * PageMission — 每页顶部的使命说明条
 *
 * 紧凑型：一行定位（我在哪）+ 一行用途（这里干什么）+ 数字指标 + CTA
 * 不抢主内容的视觉权重，但让用户 3 秒内建立上下文。
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface PageMissionStat {
  label: string;
  value: string | number;
  /** 用于高亮告警数字，默认 false */
  urgent?: boolean;
}

export interface PageMissionProps {
  /** 中文页面名 */
  nameCn: string;
  /** 英文副标（小字） */
  nameEn: string;
  /** 一句话：这里做什么，带动词 */
  mission: string;
  /** 最多 3 个实时数字 */
  stats?: PageMissionStat[];
  /** 主动作按钮 */
  cta?: { label: string; href: string };
  /** 主题色，默认金色 */
  accentColor?: string;
}

export function PageMission({
  nameCn,
  nameEn,
  mission,
  stats,
  cta,
  accentColor = '#F0C66A',
}: PageMissionProps) {
  return (
    <div
      className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-5 py-4"
      style={{
        borderColor: `${accentColor}1E`,
        background: `linear-gradient(105deg, ${accentColor}07 0%, rgba(255,255,255,0) 55%)`,
      }}
    >
      {/* Left accent */}
      <div
        className="hidden h-8 w-0.5 shrink-0 rounded-full md:block"
        style={{ background: `linear-gradient(180deg, ${accentColor}55, transparent)` }}
      />

      {/* Identity + mission */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[14px] font-semibold text-[#EDE5CC]" style={{ fontFamily: 'var(--font-serif)' }}>{nameCn}</span>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: `${accentColor}66` }}
          >
            {nameEn}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-5 text-[#5A6280]">{mission}</p>
      </div>

      {/* Stats */}
      {stats && stats.length > 0 && (
        <div className="flex items-center gap-2">
          {stats.map((s) => {
            const color = s.urgent ? '#EF4444' : accentColor;
            return (
              <div
                key={s.label}
                className="flex items-baseline gap-1.5 rounded-lg px-3 py-1.5"
                style={{
                  background: `${color}0E`,
                  border: `1px solid ${color}28`,
                }}
              >
                <span className="text-[17px] font-bold leading-none" style={{ color }}>
                  {s.value}
                </span>
                <span className="text-[9px] uppercase tracking-wide" style={{ color: `${color}77` }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      {cta && (
        <Link
          href={cta.href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-4 py-2 text-[11px] font-medium transition hover:-translate-y-0.5"
          style={{
            borderColor: `${accentColor}3A`,
            background: `${accentColor}0E`,
            color: accentColor,
          }}
        >
          {cta.label}
          <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
