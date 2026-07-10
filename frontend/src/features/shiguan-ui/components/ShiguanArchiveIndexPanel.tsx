'use client';

import { useMemo, useState } from 'react';
import GlassPanel from './GlassPanel';
import { ShiguanEmptyState } from './ShiguanEmptyState';
import { ShiguanSourceBadge } from './ShiguanSourceBadge';
import type { ShiguanArchiveListItem, ShiguanArchiveType, ShiguanStatsView } from '../lib/shiguan-view-model';

const TYPE_LABEL: Record<ShiguanArchiveType, string> = {
  memorial: '奏折',
  decision: '决策',
  task: '任务',
  knowledge: '知识',
  promo: '宣传',
  release_gate: '门禁',
};

const TYPE_FILTERS: Array<'all' | ShiguanArchiveType> = ['all', 'memorial', 'decision', 'task', 'knowledge', 'promo', 'release_gate'];

export function ShiguanArchiveIndexPanel({
  stats,
  items,
  selectedId,
  onSelect,
}: {
  stats: ShiguanStatsView;
  items: ShiguanArchiveListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [type, setType] = useState<'all' | ShiguanArchiveType>('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (!needle) return true;
      return `${item.title} ${item.department ?? ''} ${item.status}`.toLowerCase().includes(needle);
    });
  }, [items, query, type]);

  return (
    <GlassPanel
      title="案卷索引"
      eyebrow="Archive Index"
      className="flex h-full min-h-0 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="grid grid-cols-2 gap-2">
        <Metric label="案卷" value={stats.totalArchives} />
        <Metric label="决策" value={stats.decisions} />
        <Metric label="知识" value={stats.knowledge} />
        <Metric label="待复盘" value={stats.pendingReview} />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-gold-300/12 bg-black/20 px-3 py-2">
        <div>
          <div className="text-[10px] text-slatey-400">综合成功率</div>
          <div className="mt-0.5 font-serif text-[18px] leading-none text-gold-gradient">{stats.successRate}%</div>
        </div>
        <ShiguanSourceBadge sourceLabel={stats.sourceLabel} />
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-3 h-9 rounded-lg border border-gold-300/16 bg-black/20 px-3 text-[12px] text-jade-100 placeholder:text-slatey-400 focus:outline-none"
        placeholder="搜索案卷、部门、状态"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            className={
              option === type
                ? 'rounded border border-gold-300/40 bg-gold-300/12 px-2 py-1 text-[10px] text-gold-100'
                : 'rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slatey-300 hover:text-gold-100'
            }
          >
            {option === 'all' ? '全部' : TYPE_LABEL[option]}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {shown.length === 0 ? (
          <ShiguanEmptyState
            title="暂无可索引案卷"
            body="完成上书房裁决、军机处会审或任务归档后，史馆会在这里生成可检索案卷。"
          />
        ) : (
          <div className="space-y-2">
            {shown.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  selectedId === item.id
                    ? 'border-gold-300/45 bg-gold-300/[0.08]'
                    : 'border-gold-300/12 bg-white/[0.025] hover:border-gold-300/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-jade-100">{item.title}</div>
                    <div className="mt-1 text-[9.5px] text-slatey-400">
                      {TYPE_LABEL[item.type]}{item.department ? ` / ${item.department}` : ''} / {item.status}
                    </div>
                  </div>
                  <ShiguanSourceBadge sourceLabel={item.sourceLabel} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gold-300/12 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] text-slatey-400">{label}</div>
      <div className="mt-1 font-serif text-[19px] leading-none text-gold-gradient">{value}</div>
    </div>
  );
}
