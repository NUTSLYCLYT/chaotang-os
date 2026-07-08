'use client';

import type { ReactNode } from 'react';
import type { OperatorActionLabel, OperatorActionSummary } from '@/shared/battery-exchange';

type Props = {
  summary: OperatorActionSummary;
  actionEntityFilter: 'all' | 'listing' | 'trade_order';
  actionLabelFilter: 'all' | OperatorActionLabel;
  actionActorFilter: string;
  actionSellerFilter: string;
  actionDateFilter: string;
  onToggleEntityFilter: (entityType: 'listing' | 'trade_order') => void;
  onToggleActionLabel: (actionLabel: OperatorActionLabel) => void;
  onToggleActionActor: (actorName: string) => void;
  onToggleActionSeller: (sellerName: string) => void;
  onApplyActionDate: (date: string) => void;
  onApplySellerTimeFacet: (sellerName: string, date: string) => void;
  onApplySellerActionFacet: (sellerName: string, actionLabel: OperatorActionLabel) => void;
};

export function BatteryExchangeOperatorHistorySummary({
  summary,
  actionEntityFilter,
  actionLabelFilter,
  actionActorFilter,
  actionSellerFilter,
  actionDateFilter,
  onToggleEntityFilter,
  onToggleActionLabel,
  onToggleActionActor,
  onToggleActionSeller,
  onApplyActionDate,
  onApplySellerTimeFacet,
  onApplySellerActionFacet,
}: Props) {
  return (
    <>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <SummaryMetricCard
          label="货盘动作"
          value={String(summary.listingCount)}
          note="当前筛选下命中的货盘处置"
        />
        <SummaryMetricCard
          label="交易动作"
          value={String(summary.tradeOrderCount)}
          note="当前筛选下命中的交易处置"
        />
        <SummaryPanel title="高频动作">
          {summary.actionCounts.length > 0 ? (
            summary.actionCounts.slice(0, 3).map((item) => (
              <button
                type="button"
                key={item.actionLabel}
                onClick={() => onToggleActionLabel(item.actionLabel)}
                className={buildChipClass(actionLabelFilter === item.actionLabel)}
              >
                {item.actionLabel} · {item.count}
              </button>
            ))
          ) : (
            <EmptyHint text="当前筛选下暂无动作聚合" />
          )}
        </SummaryPanel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <SummaryPanel title="处理人分布">
          {summary.actorCounts.length > 0 ? (
            summary.actorCounts.slice(0, 3).map((item) => (
              <button
                type="button"
                key={item.actorName}
                onClick={() => onToggleActionActor(item.actorName)}
                className={buildChipClass(actionActorFilter === item.actorName)}
              >
                {item.actorName} · {item.count}
              </button>
            ))
          ) : (
            <EmptyHint text="当前筛选下暂无处理人分布" />
          )}
        </SummaryPanel>

        <SummaryPanel title="卖家热区">
          {summary.sellerCounts.length > 0 ? (
            summary.sellerCounts.slice(0, 3).map((item) => (
              <button
                type="button"
                key={item.sellerName}
                onClick={() => onToggleActionSeller(item.sellerName)}
                className={buildChipClass(actionSellerFilter === item.sellerName)}
              >
                {item.sellerName} · {item.count}
              </button>
            ))
          ) : (
            <EmptyHint text="当前筛选下暂无卖家热区" />
          )}
        </SummaryPanel>

        <TrendPanel title="处置趋势">
          {summary.timeBuckets.length > 0 ? (
            summary.timeBuckets.slice(-4).map((item) => {
              const maxCount = Math.max(...summary.timeBuckets.map((bucket) => bucket.count), 1);
              const width = `${Math.max(22, Math.round((item.count / maxCount) * 100))}%`;
              return (
                <button
                  type="button"
                  key={item.date}
                  onClick={() => onApplyActionDate(item.date)}
                  className={buildTrendCardClass(actionDateFilter === item.date)}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] text-[#b89f80]">
                    <span>{item.date.slice(5)}</span>
                    <span>{item.count} 次</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#201913]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#8a5a2b] via-[#c98a49] to-[#f0c27b]"
                      style={{ width }}
                    />
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyHint text="当前筛选下暂无趋势数据" />
          )}
        </TrendPanel>

        <TrendPanel title="动作走势">
          {summary.actionTimeBuckets.length > 0 ? (
            summary.actionTimeBuckets.slice(-4).map((item) => (
              <button
                type="button"
                key={`${item.date}-${item.actionLabel}`}
                onClick={() => onToggleActionLabel(item.actionLabel)}
                className={buildTrendCardClass(actionLabelFilter === item.actionLabel)}
              >
                <div className="text-[11px] text-[#b89f80]">{item.date.slice(5)}</div>
                <div className="mt-1 text-xs text-[#f4ead1]">{item.actionLabel}</div>
                <div className="mt-1 text-[11px] text-[#d9bb97]">{item.count} 次</div>
              </button>
            ))
          ) : (
            <EmptyHint text="当前筛选下暂无动作走势" />
          )}
        </TrendPanel>

        <TrendPanel title="卖家走势">
          {summary.sellerTimeBuckets.length > 0 ? (
            summary.sellerTimeBuckets.slice(-4).map((item) => (
              <button
                type="button"
                key={`${item.date}-${item.sellerName}`}
                onClick={() => onApplySellerTimeFacet(item.sellerName, item.date)}
                className={buildTrendCardClass(
                  actionSellerFilter === item.sellerName && actionDateFilter === item.date,
                )}
              >
                <div className="text-[11px] text-[#b89f80]">{item.date.slice(5)}</div>
                <div className="mt-1 text-xs text-[#f4ead1]">{item.sellerName}</div>
                <div className="mt-1 text-[11px] text-[#d9bb97]">{item.count} 次</div>
              </button>
            ))
          ) : (
            <EmptyHint text="当前筛选下暂无卖家走势" />
          )}
        </TrendPanel>

        <SummaryPanel title="卖家动作热区">
          {summary.sellerActionCounts.length > 0 ? (
            summary.sellerActionCounts.slice(0, 3).map((item) => (
              <button
                type="button"
                key={`${item.sellerName}-${item.actionLabel}`}
                onClick={() => onApplySellerActionFacet(item.sellerName, item.actionLabel)}
                className={buildChipClass(
                  actionSellerFilter === item.sellerName && actionLabelFilter === item.actionLabel,
                  true,
                )}
              >
                {item.sellerName} · {item.actionLabel} · {item.count}
              </button>
            ))
          ) : (
            <EmptyHint text="当前筛选下暂无卖家动作热区" />
          )}
        </SummaryPanel>

        <SummaryPanel title="实体占比" compact>
          <button
            type="button"
            onClick={() => onToggleEntityFilter('listing')}
            className={buildTrendCardClass(actionEntityFilter === 'listing')}
          >
            货盘 {summary.listingCount}
          </button>
          <button
            type="button"
            onClick={() => onToggleEntityFilter('trade_order')}
            className={buildTrendCardClass(actionEntityFilter === 'trade_order')}
          >
            交易 {summary.tradeOrderCount}
          </button>
        </SummaryPanel>
      </div>
    </>
  );
}

function SummaryMetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[18px] border border-[#2f2823] bg-[#14110f] px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#a97f52]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#f4ead1]">{value}</div>
      <div className="mt-1 text-xs text-[#8f7557]">{note}</div>
    </div>
  );
}

function SummaryPanel({
  title,
  compact = false,
  children,
}: {
  title: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-[#2f2823] bg-[#14110f] px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#a97f52]">{title}</div>
      <div className={`mt-2 ${compact ? 'grid grid-cols-2 gap-2 text-xs text-[#d9bb97]' : 'flex flex-wrap gap-2 text-xs text-[#d9bb97]'}`}>
        {children}
      </div>
    </div>
  );
}

function TrendPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[#2f2823] bg-[#14110f] px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#a97f52]">{title}</div>
      <div className="mt-2 grid gap-2 text-xs text-[#d9bb97]">{children}</div>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <span className="text-[#8f7557]">{text}</span>;
}

function buildChipClass(active: boolean, leftAligned = false) {
  return `rounded-full border px-3 py-1 transition ${
    leftAligned ? 'text-left ' : ''
  }${
    active
      ? 'border-[#c98a49] bg-[#22170f] text-[#f0c27b]'
      : 'border-[#3f2e22] bg-[#18130f] text-[#d9bb97]'
  }`;
}

function buildTrendCardClass(active: boolean) {
  return `rounded-2xl border px-3 py-2 text-left transition ${
    active
      ? 'border-[#c98a49] bg-[#22170f] text-[#f0c27b]'
      : 'border-[#3f2e22] bg-[#18130f] text-[#d9bb97]'
  }`;
}
