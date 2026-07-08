'use client';

import { X } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import type { TaskStatus } from '@/types/task';
import type { ManorDomain } from '@/types/manor';
import type { ScribeFilters, DateRangePreset } from '../hooks/use-scribe-filters';

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'submitted',    label: '已提交',   color: '#9AA3C4' },
  { value: 'running',      label: '审议中',   color: '#60A5FA' },
  { value: 'report_ready', label: '已批复',   color: '#F0C66A' },
  { value: 'failed',       label: '失败',     color: '#F43F5E' },
  { value: 'archived',     label: '已归档',   color: '#6A7299' },
];

const MANOR_OPTIONS: { value: ManorDomain; label: string; emoji: string }[] = [
  { value: 'legal',         label: '法务',   emoji: '⚖️' },
  { value: 'hr',            label: '人事',   emoji: '👥' },
  { value: 'finance',       label: '财务',   emoji: '💰' },
  { value: 'ecommerce',     label: '电商',   emoji: '🛍️' },
  { value: 'ops',           label: '运营',   emoji: '⚙️' },
  { value: 'compliance',    label: '合规',   emoji: '📋' },
  { value: 'sales',         label: '销售',   emoji: '📈' },
  { value: 'marketing',     label: '营销',   emoji: '📣' },
  { value: 'battery_pack',  label: '电池',   emoji: '🔋' },
  { value: 'supply-chain',  label: '供应链', emoji: '🔗' },
  { value: 'investment',    label: '投资',   emoji: '💎' },
];

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'week',  label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自定义' },
];

interface ExpFilterBarProps {
  filters: ScribeFilters;
  onFiltersChange: (next: Partial<ScribeFilters>) => void;
  onClear: () => void;
  hitCount: number;
  totalCount: number;
}

export function ExpFilterBar({ filters, onFiltersChange, onClear, hitCount, totalCount }: ExpFilterBarProps) {
  function toggleStatus(s: TaskStatus) {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    onFiltersChange({ statuses: next });
  }

  function toggleManor(m: ManorDomain) {
    const next = filters.manors.includes(m)
      ? filters.manors.filter((x) => x !== m)
      : [...filters.manors, m];
    onFiltersChange({ manors: next });
  }

  return (
    <GlassPanel tone="elevated" padding="md" className="space-y-3">
      {/* Row 1: status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="section-eyebrow shrink-0">状态</span>
        {STATUS_OPTIONS.map((opt) => {
          const active = filters.statuses.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatus(opt.value)}
              className="rounded-full px-2.5 py-0.5 text-[11px] transition-all"
              style={{
                border: `1px solid ${active ? opt.color + '80' : 'rgba(26,33,66,0.9)'}`,
                background: active ? opt.color + '15' : 'rgba(10,14,30,0.5)',
                color: active ? opt.color : '#9AA3C4',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Row 2: manor */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="section-eyebrow shrink-0">庄园</span>
        {MANOR_OPTIONS.map((opt) => {
          const active = filters.manors.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleManor(opt.value)}
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] transition-all"
              style={{
                border: `1px solid ${active ? 'rgba(240,198,106,0.55)' : 'rgba(26,33,66,0.9)'}`,
                background: active ? 'rgba(240,198,106,0.1)' : 'rgba(10,14,30,0.5)',
                color: active ? '#F0C66A' : '#9AA3C4',
              }}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Row 3: date range */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="section-eyebrow shrink-0">时间</span>
        {DATE_PRESETS.map((p) => {
          const active = filters.dateRange === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onFiltersChange({ dateRange: p.value })}
              className="rounded-full px-2.5 py-0.5 text-[11px] transition-all"
              style={{
                border: `1px solid ${active ? 'rgba(240,198,106,0.55)' : 'rgba(26,33,66,0.9)'}`,
                background: active ? 'rgba(240,198,106,0.1)' : 'rgba(10,14,30,0.5)',
                color: active ? '#F0C66A' : '#9AA3C4',
              }}
            >
              {p.label}
            </button>
          );
        })}

        {filters.dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.customFrom}
              onChange={(e) => onFiltersChange({ customFrom: e.target.value })}
              className="rounded border border-[#1A2142] bg-[#070B17] px-2 py-0.5 text-[11px] text-[#EAEEFB] focus:border-[#F0C66A]/40 focus:outline-none"
            />
            <span className="text-[11px] text-[#6A7299]">至</span>
            <input
              type="date"
              value={filters.customTo}
              onChange={(e) => onFiltersChange({ customTo: e.target.value })}
              className="rounded border border-[#1A2142] bg-[#070B17] px-2 py-0.5 text-[11px] text-[#EAEEFB] focus:border-[#F0C66A]/40 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Footer: hit count + clear */}
      <div className="flex items-center justify-between border-t border-white/5 pt-2">
        <div className="font-mono text-[11px] text-[#6A7299]">
          <span className="text-[#F0C66A]">{hitCount}</span>
          {' / '}
          {totalCount} 条任务
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-[11px] text-[#6A7299] transition hover:text-[#F0C66A]"
        >
          <X size={11} />
          清除筛选
        </button>
      </div>
    </GlassPanel>
  );
}
