'use client';

/**
 * 部门左栏司编制 · 共享组件（2026-06-29）
 *
 * 刑部/礼部/吏部三个 staff-rail 的公共渲染逻辑收束于此。
 * 各部差异（accent、文案、颜色）通过 props 注入；行为完全保留：
 * 真引擎亮/骨架暗区分 + skill title + 选中态 + onSelect 回调。
 * ARIA / type=button / focus-visible / 静态 Tailwind 类均保留（铁律勿移除）。
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';

import type { DeptOfficeRole } from '@/features/departments/lib/dept-office';
import { deptEngineStats } from '@/features/departments/lib/dept-office';
import type { SixDepartmentContent } from '@/features/departments/lib/six-departments-content';

export interface DeptStaffRailProps {
  /** 司编制数据（各部 roster SSOT，不在此重定义）。 */
  roster: Record<string, DeptOfficeRole>;
  /** 展示顺序（各部 OFFICE_ORDER）。 */
  order: string[];
  /** 部门主题色（各部 ACCENT）。 */
  accent: string;
  /**
   * "N 真引擎" 计数文字颜色。
   * 默认使用 accent（各部可传自己的色调变体）。
   */
  statColor?: string;
  /**
   * 真引擎司的 duty 文字颜色。
   * 默认使用 accent（各部可传自己的色调变体）。
   */
  dutyColor?: string;
  /** 当前选中司 id。 */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 部门基础信息（来自六部内容 SoT）。 */
  department: SixDepartmentContent;
  /** 副标题文案（各部独立，如"您的法务风控 · 8 司 AI 法务专员"）。 */
  subtitle: string;
  /** 编制标签前缀（如"法务编制"/"增长编制"/"人事编制"）。 */
  label: string;
  /** 介绍折叠按钮文案（如"刑部是什么"）。 */
  introLabel: string;
  /** 底部免责/边界提示文案。 */
  disclaimer: string;
}

export function DeptStaffRail({
  roster,
  order,
  accent,
  statColor,
  dutyColor,
  selectedId,
  onSelect,
  department,
  subtitle,
  label,
  introLabel,
  disclaimer,
}: DeptStaffRailProps) {
  const [showIntro, setShowIntro] = useState(false);
  const stats = deptEngineStats(roster);

  const resolvedStatColor = statColor ?? accent;
  const resolvedDutyColor = dutyColor ?? accent;

  return (
    <aside
      className="flex flex-col rounded-[24px] border px-4 py-4 shadow-[0_18px_56px_rgba(0,0,0,0.34)] xl:h-full xl:overflow-y-auto"
      style={{
        borderColor: `${accent}24`,
        background: `linear-gradient(180deg, ${accent}14 0%, rgba(5, 7, 13, 0.92) 100%)`,
      }}
    >
      <Link
        href="/liubu"
        className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] text-[#C8CDD8] transition hover:text-[#F5E9C9]"
        style={{ borderColor: `${accent}30` }}
      >
        <ArrowLeft size={14} /> 返回六部
      </Link>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>
          {department.titleEn}
        </div>
        <h1 className="display-serif mt-1 text-[26px] font-semibold text-[#F5E9C9]">
          {department.name}
        </h1>
        <p className="mt-0.5 text-[12px] text-[#9aa0ad]">{subtitle}</p>
      </div>

      {/* 引擎诚实灯：N 真 / M 骨架 */}
      <div
        className="mt-4 rounded-[12px] border px-3 py-2.5"
        style={{ borderColor: `${accent}2a`, background: `${accent}0d` }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: `${accent}bb` }}>
          引擎状态
        </div>
        <div className="mt-1 text-[13px]" style={{ color: resolvedStatColor }}>
          {stats.real} 真引擎
          <span className="ml-1 text-[#6f7a8f]">/ {stats.total} 司（其余为骨架）</span>
        </div>
      </div>

      {/* 司编制列表标题 */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.2em] text-[#8f835f]">
          {label} · {stats.total} 司
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {order.map((id) => {
          const office = roster[id];
          if (!office) return null;
          const isReal = office.engine;
          const isSelected = selectedId === id;
          return (
            <li
              key={id}
              className="flex items-start rounded-[10px]"
              style={{
                background: isSelected
                  ? `${accent}22`
                  : isReal
                    ? `${accent}0a`
                    : 'rgba(255,255,255,0.02)',
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(id)}
                className="flex flex-1 flex-col gap-0.5 px-2.5 py-2 text-left transition hover:brightness-125 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                title={`${office.role} · ${office.skill}`}
              >
                <div className="flex items-center gap-2">
                  {/* 真/骨架点 */}
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: isReal ? accent : '#3a4050' }}
                    aria-label={isReal ? '真引擎' : '骨架'}
                  />
                  <span
                    className="text-[13px]"
                    style={{ color: isReal ? '#E9DDBE' : '#6a7080' }}
                  >
                    {office.name}
                  </span>
                  {isReal && (
                    <span
                      className="rounded-sm px-1 py-0.5 text-[9px] uppercase tracking-wider"
                      style={{ background: `${accent}22`, color: accent }}
                    >
                      真
                    </span>
                  )}
                </div>
                <span
                  className="text-[10.5px] leading-snug"
                  style={{ color: isReal ? resolvedDutyColor : '#484e5c' }}
                >
                  {office.duty}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 介绍折叠 */}
      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={() => setShowIntro((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-[#7a7560] transition hover:text-[#b6ab8c] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        >
          <ChevronDown
            size={13}
            className={showIntro ? 'rotate-180 transition' : 'transition'}
          />
          {introLabel}
        </button>
        {showIntro && (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#9aa0ad]">
            {department.positioning}
          </p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-[#5f5a48]">{disclaimer}</p>
      </div>
    </aside>
  );
}
