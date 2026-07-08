/**
 * 朝堂 OS V2 · 史馆 · 过滤条（紧凑 chip 多选）
 *
 * Q2=B 方案：列表上方的紧凑过滤器，不占用大面积空间。
 * - 关键词输入
 * - 任务类型多选 chip
 * - 部门多选 chip（6 部 + 锦衣卫/钦天监等）
 * - "只看有复盘" toggle
 */

'use client';

import { Search, X } from 'lucide-react';
import type { AgentCode } from '@/types/agent';
import { AGENT_META } from '@/types/agent';
import type { TaskType } from '@/types/task';
import type { ScribeSearchFilter } from '../lib/search';
import { isFilterActive } from '../lib/search';

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  strategy: '战略',
  analysis: '分析',
  execution: '执行',
  creative: '创意',
  compliance: '合规',
  forecast: '预测',
  intel: '情报',
  health: '健康',
  general: '通用',
};

/** 史馆可选的部门（不含 prime_minister / scribe 这两个中枢角色） */
const FILTERABLE_AGENTS: AgentCode[] = [
  'li_bu',
  'hu_bu',
  'li_bu_rites',
  'bing_bu',
  'xing_bu',
  'gong_bu',
  'qin_tian_jian',
  'jin_yi_wei',
  'tai_yi_yuan',
];

export interface ScribeFilterBarProps {
  filter: ScribeSearchFilter;
  onChange: (next: ScribeSearchFilter) => void;
  /** 命中数量（显示在右侧） */
  hitCount: number;
  totalCount: number;
}

export function ScribeFilterBar({ filter, onChange, hitCount, totalCount }: ScribeFilterBarProps) {
  const active = isFilterActive(filter);

  const toggleInArray = <T,>(list: T[] | undefined, value: T): T[] => {
    const arr = list ?? [];
    return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
  };

  const clear = () => onChange({});

  return (
    <div className="space-y-2.5">
      {/* 关键词 + 清除 + 命中数 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6A7299]"
          />
          <input
            type="text"
            value={filter.keyword ?? ''}
            onChange={(e) => onChange({ ...filter, keyword: e.target.value })}
            placeholder="搜索任务标题、指令、复盘经验…"
            className="w-full rounded-md border border-[#1A2142] bg-[rgba(10,14,30,0.6)] py-1.5 pl-7 pr-2 text-[11px] text-[#EAEEFB] placeholder:text-[#484F72] focus:border-[#F0C66A]/50 focus:outline-none"
          />
        </div>
        <div className="font-mono text-[10px] text-[#6A7299]">
          <span className="text-[#F0C66A]">{hitCount}</span>
          <span className="mx-0.5">/</span>
          <span>{totalCount}</span>
        </div>
        {active && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-[#6A7299] transition-colors hover:text-[#F0C66A]"
            title="清除全部筛选"
          >
            <X size={11} />
            清除
          </button>
        )}
      </div>

      {/* 任务类型 chips */}
      <ChipRow label="类型">
        {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
          <Chip
            key={t}
            active={filter.taskTypes?.includes(t) ?? false}
            onClick={() =>
              onChange({ ...filter, taskTypes: toggleInArray(filter.taskTypes, t) })
            }
          >
            {TASK_TYPE_LABELS[t]}
          </Chip>
        ))}
      </ChipRow>

      {/* 部门 chips */}
      <ChipRow label="部门">
        {FILTERABLE_AGENTS.map((code) => {
          const meta = AGENT_META[code];
          return (
            <Chip
              key={code}
              active={filter.agents?.includes(code) ?? false}
              onClick={() => onChange({ ...filter, agents: toggleInArray(filter.agents, code) })}
              title={meta?.nameCn}
            >
              <span>{meta?.emoji ?? '◆'}</span>
              <span>{meta?.nameCn ?? code}</span>
            </Chip>
          );
        })}
      </ChipRow>

      {/* 只看有复盘 */}
      <div className="flex items-center gap-2 pt-0.5">
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-[#9AA3C4]">
          <input
            type="checkbox"
            checked={filter.hasRetrospective ?? false}
            onChange={(e) => onChange({ ...filter, hasRetrospective: e.target.checked })}
            className="h-3 w-3 accent-[#F0C66A]"
          />
          仅显示已完成复盘
        </label>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="section-eyebrow mr-1">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors"
      style={{
        border: `1px solid ${active ? 'rgba(240, 198, 106, 0.55)' : 'rgba(26, 33, 66, 0.9)'}`,
        background: active ? 'rgba(240, 198, 106, 0.1)' : 'rgba(10, 14, 30, 0.5)',
        color: active ? '#F0C66A' : '#9AA3C4',
      }}
    >
      {children}
    </button>
  );
}
