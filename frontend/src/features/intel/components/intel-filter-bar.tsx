/**
 * 情报中心 · 过滤器栏
 *
 * 区域 / 等级 / 类别 的快速筛选，状态直接写入 app-store 的 intelFilter slice
 */

'use client';

import { Filter, X } from 'lucide-react';
import { useAppStore } from '@/lib/store/app-store';
import type { IntelCategory, IntelLevel } from '@/types/intel';

const LEVELS: { value: IntelLevel; label: string; color: string }[] = [
  { value: 'critical', label: '危急', color: '#F43F5E' },
  { value: 'warning', label: '警报', color: '#F5A524' },
  { value: 'watch', label: '关注', color: '#F0C66A' },
  { value: 'info', label: '情报', color: '#60A5FA' },
];

const CATEGORIES: { value: IntelCategory; label: string; color: string }[] = [
  { value: 'risk', label: '风险', color: '#F43F5E' },
  { value: 'opportunity', label: '机会', color: '#3DD68C' },
  { value: 'neutral', label: '中性', color: '#9AA3C4' },
];

export interface IntelFilterBarProps {
  availableRegions: Array<{ code: string; label: string }>;
  totalCount: number;
  filteredCount: number;
}

export function IntelFilterBar({
  availableRegions,
  totalCount,
  filteredCount,
}: IntelFilterBarProps) {
  const filter = useAppStore((s) => s.intelFilter);
  const updateFilter = useAppStore((s) => s.updateIntelFilter);

  const toggleRegion = (code: string) => {
    const next = filter.regions.includes(code)
      ? filter.regions.filter((r) => r !== code)
      : [...filter.regions, code];
    updateFilter({ regions: next });
  };

  const toggleLevel = (lv: IntelLevel) => {
    const next = filter.levels.includes(lv)
      ? filter.levels.filter((l) => l !== lv)
      : [...filter.levels, lv];
    updateFilter({ levels: next });
  };

  const toggleCategory = (c: IntelCategory) => {
    const next = filter.categories.includes(c)
      ? filter.categories.filter((x) => x !== c)
      : [...filter.categories, c];
    updateFilter({ categories: next });
  };

  const resetFilters = () => {
    updateFilter({
      regions: [],
      levels: ['info', 'watch', 'warning', 'critical'],
      categories: ['risk', 'opportunity', 'neutral'],
    });
  };

  const hasActiveFilter =
    filter.regions.length > 0 ||
    filter.levels.length !== 4 ||
    filter.categories.length !== 3;

  return (
    <div
      className="flex items-center gap-4 rounded-lg border px-4 py-2.5"
      style={{
        borderColor: 'rgba(26, 33, 66, 0.8)',
        backgroundColor: 'rgba(10, 14, 30, 0.6)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Filter size={13} className="flex-shrink-0 text-[#F0C66A]" />

      {/* 类别 */}
      <FilterGroup label="类别">
        {CATEGORIES.map(({ value, label, color }) => {
          const active = filter.categories.includes(value);
          return (
            <FilterChip
              key={value}
              active={active}
              color={color}
              onClick={() => toggleCategory(value)}
            >
              {label}
            </FilterChip>
          );
        })}
      </FilterGroup>

      <Divider />

      {/* 等级 */}
      <FilterGroup label="等级">
        {LEVELS.map(({ value, label, color }) => {
          const active = filter.levels.includes(value);
          return (
            <FilterChip
              key={value}
              active={active}
              color={color}
              onClick={() => toggleLevel(value)}
            >
              {label}
            </FilterChip>
          );
        })}
      </FilterGroup>

      <Divider />

      {/* 区域 */}
      <FilterGroup label="区域">
        {availableRegions.map(({ code, label }) => {
          const active = filter.regions.includes(code);
          return (
            <FilterChip
              key={code}
              active={active}
              color="#6BA0FF"
              onClick={() => toggleRegion(code)}
            >
              {label}
            </FilterChip>
          );
        })}
      </FilterGroup>

      {/* 统计 + 重置 */}
      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[10px] text-[#6A7299]">
          <span className="text-[#F0C66A]">{filteredCount}</span> / {totalCount}
        </span>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-[#9AA3C4] hover:bg-white/5 hover:text-[#EAEEFB]"
          >
            <X size={10} />
            重置
          </button>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-[#484F72]">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 py-0.5 text-[10px] font-medium transition-all"
      style={{
        backgroundColor: active ? `${color}18` : 'transparent',
        border: `1px solid ${active ? color + '66' : 'rgba(26, 33, 66, 0.8)'}`,
        color: active ? color : '#6A7299',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="h-4 w-px"
      style={{ backgroundColor: 'rgba(26, 33, 66, 0.8)' }}
    />
  );
}
