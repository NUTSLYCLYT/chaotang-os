'use client';

import type { ReactNode } from 'react';

/**
 * ManorEntityCard — 可选中实体行
 *
 * 从户部 hubu-client.tsx 的 LedgerRow 泛化。
 * 每一张卡显示 rank、标题、优先级徽章、多列字段、状态徽章、可选快捷操作。
 * 选中时高亮发光。
 */

export interface ManorEntityField {
  label: string;
  value: string;
  color?: string;
}

export interface ManorEntityBadge {
  label: string;
  color: string;
}

export interface ManorEntityAction {
  label: string;
  tone: 'green' | 'red';
  loading?: boolean;
  onClick: () => void;
}

export interface ManorEntityCardProps {
  title: string;
  rank: number;
  active: boolean;
  accent: string;
  tone?: 'green' | 'red' | 'amber';
  priority?: string;
  fields: ManorEntityField[];
  badges: ManorEntityBadge[];
  actions?: ManorEntityAction[];
  onClick: () => void;
  footerLeft?: ReactNode;
}

const TONE_COLORS = {
  green: '#3DD68C',
  red: '#F43F5E',
  amber: '#FB923C',
} as const;

export function ManorEntityCard({
  title,
  rank,
  active,
  accent,
  tone,
  priority,
  fields,
  badges,
  actions,
  onClick,
  footerLeft,
}: ManorEntityCardProps) {
  const rowAccent = tone ? TONE_COLORS[tone] : accent;

  return (
    <div
      className="rounded-md border px-3 py-2.5 transition cursor-pointer"
      style={{
        borderColor: active ? `${rowAccent}88` : `${rowAccent}1a`,
        background: active
          ? `linear-gradient(180deg, ${rowAccent}14, ${rowAccent}06)`
          : 'rgba(0,0,0,0.14)',
        boxShadow: active ? `0 0 16px ${rowAccent}22` : undefined,
      }}
      onClick={onClick}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-1.5">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded border font-mono text-[10px]"
          style={{
            borderColor: active ? `${rowAccent}55` : `${rowAccent}22`,
            color: active ? '#F0C66A' : rowAccent,
            background: active ? `${rowAccent}18` : `${rowAccent}06`,
          }}
        >
          {rank}
        </span>
        <span className="truncate font-serif text-[12px] font-semibold text-[#F5E9C9]">
          {title}
        </span>
        {priority ? (
          <span
            className="ml-auto shrink-0 rounded border px-1 py-[1px] text-[10px]"
            style={{
              borderColor: `${accent}30`,
              color: accent,
              background: `${accent}08`,
            }}
          >
            {priority}
          </span>
        ) : null}
      </div>

      {/* 字段行 */}
      {fields.length > 0 && (
        <div
          className="mt-1.5 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(fields.length, 3)}, minmax(0, 1fr))` }}
        >
          {fields.map((f) => (
            <div key={f.label}>
              <div className="text-[10px] text-[#6A7299]">{f.label}</div>
              <div
                className="truncate font-mono text-[11px]"
                style={{ color: f.color ?? accent }}
              >
                {f.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 徽章行 */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {badges.slice(0, 2).map((b) => (
            <span
              key={b.label}
              className="rounded border px-1.5 py-[1px] text-[10px]"
              style={{
                borderColor: `${b.color}44`,
                color: b.color,
                background: `${b.color}0d`,
              }}
            >
              {b.label}
            </span>
          ))}
          {footerLeft}
        </div>
        {badges.length > 2 && (
          <span
            className="rounded border px-1.5 py-[1px] text-[10px]"
            style={{
              borderColor: `${badges[2].color}44`,
              color: badges[2].color,
              background: `${badges[2].color}0d`,
            }}
          >
            {badges[2].label}
          </span>
        )}
      </div>

      {/* 快捷操作 */}
      {actions && actions.length > 0 && (
        <div
          className="mt-2 flex gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.loading}
              onClick={action.onClick}
              className="rounded border px-2 py-0.5 text-[10px] transition hover:brightness-110 disabled:opacity-50"
              style={{
                borderColor: `${TONE_COLORS[action.tone]}44`,
                color: TONE_COLORS[action.tone],
                background: `${TONE_COLORS[action.tone]}0d`,
              }}
            >
              {action.loading ? '处理中…' : action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
