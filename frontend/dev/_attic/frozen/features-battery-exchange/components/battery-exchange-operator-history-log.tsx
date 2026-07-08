'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { OperatorActionLabel, OperatorActionPage } from '@/shared/battery-exchange';

type ActionLogItem = {
  id: string;
  entityType: 'listing' | 'trade_order';
  entityId: string;
  actionLabel: OperatorActionLabel;
  actorName: string;
  note: string;
  sourceReason: string;
  result: string;
  createdAt: string;
  title: string;
  sellerName: string;
  href: string;
};

type ActiveActionFilter = {
  key: 'entity' | 'label' | 'range' | 'date' | 'actor' | 'seller' | 'query' | 'sort';
  label: string;
};

type Props = {
  items: ActionLogItem[];
  activeActionFilters: ActiveActionFilter[];
  actionWindowLabel: string;
  actionHistory: Pick<OperatorActionPage, 'page' | 'totalPages'>;
  actionEntityFilter: 'all' | 'listing' | 'trade_order';
  actionActorFilter: string;
  actionSellerFilter: string;
  actionLabelFilter: 'all' | OperatorActionLabel;
  actionQuery: string;
  onToggleEntityFilter: (entityType: 'listing' | 'trade_order') => void;
  onToggleActionActor: (actorName: string) => void;
  onToggleActionSeller: (sellerName: string) => void;
  onToggleActionLabel: (actionLabel: OperatorActionLabel) => void;
  onApplyActionQuery: (value: string) => void;
  onClearAllActionFilters: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  formatActionTimestamp: (value: string) => string;
};

export function BatteryExchangeOperatorHistoryLog({
  items,
  activeActionFilters,
  actionWindowLabel,
  actionHistory,
  actionEntityFilter,
  actionActorFilter,
  actionSellerFilter,
  actionLabelFilter,
  actionQuery,
  onToggleEntityFilter,
  onToggleActionActor,
  onToggleActionSeller,
  onToggleActionLabel,
  onApplyActionQuery,
  onClearAllActionFilters,
  onPrevPage,
  onNextPage,
  formatActionTimestamp,
}: Props) {
  return (
    <>
      <div className="mt-3 space-y-2 text-sm text-[#d9bb97]">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={`${item.id}:${item.actionLabel}`} className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{item.title}</span>
                  <button
                    type="button"
                    onClick={() => onToggleEntityFilter(item.entityType)}
                    className={buildTagClass(actionEntityFilter === item.entityType)}
                  >
                    {item.entityType === 'listing' ? '货盘' : '交易'}
                  </button>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#8f7557]">{item.entityId}</span>
                  {item.sellerName ? (
                    <button
                      type="button"
                      onClick={() => onToggleActionSeller(item.sellerName)}
                      className={buildTagClass(actionSellerFilter === item.sellerName, true)}
                    >
                      {item.sellerName}
                    </button>
                  ) : null}
                </div>
                <div className="text-xs text-[#bb9d78]">{item.result}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#8f7557]">
                  <button
                    type="button"
                    onClick={() => onToggleActionActor(item.actorName)}
                    className={buildTagClass(actionActorFilter === item.actorName, true)}
                  >
                    {item.actorName}
                  </button>
                  <span>{formatActionTimestamp(item.createdAt)}</span>
                  {item.note ? (
                    <button
                      type="button"
                      onClick={() => onApplyActionQuery(item.note)}
                      className={buildTagClass(actionQuery.trim() === item.note.trim(), true)}
                    >
                      备注: {item.note}
                    </button>
                  ) : (
                    <span>无备注</span>
                  )}
                </div>
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => onApplyActionQuery(item.sourceReason)}
                    className={`text-left text-xs transition ${
                      actionQuery.trim() === item.sourceReason.trim()
                        ? 'text-[#f0c27b]'
                        : 'text-[#8f7557] hover:text-[#d9bb97]'
                    }`}
                  >
                    {item.sourceReason}
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => onToggleActionLabel(item.actionLabel)}
                  className={`rounded-full border px-3 py-1 text-[11px] transition ${
                    actionLabelFilter === item.actionLabel
                      ? 'border-[#c98a49] bg-[#22170f] text-[#f0c27b]'
                      : 'border-[#3f2e22] bg-[#18130f] text-[#d9bb97]'
                  }`}
                >
                  {item.actionLabel}
                </button>
                <Link
                  href={item.href}
                  className="rounded-full border border-[#3f2e22] px-3 py-1 text-[11px] text-[#d9bb97] transition hover:border-[#c98a49] hover:text-[#f0c27b]"
                >
                  查看详情
                </Link>
              </div>
            </div>
          ))
        ) : (
          <EmptyHistoryState activeActionFilters={activeActionFilters} onClearAllActionFilters={onClearAllActionFilters} />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[#bb9d78]">
        <div>
          {activeActionFilters.length > 0 ? '筛选后' : '当前'}显示 {actionWindowLabel} · 第 {actionHistory.page} /{' '}
          {actionHistory.totalPages} 页
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={actionHistory.page <= 1}
            onClick={onPrevPage}
            className="rounded-full border border-[#3f2e22] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <button
            type="button"
            disabled={actionHistory.page >= actionHistory.totalPages}
            onClick={onNextPage}
            className="rounded-full border border-[#3f2e22] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </>
  );
}

function EmptyHistoryState({
  activeActionFilters,
  onClearAllActionFilters,
}: {
  activeActionFilters: ActiveActionFilter[];
  onClearAllActionFilters: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-[#2f2823] bg-[#14110f] px-4 py-4">
      <div className="text-sm leading-7 text-[#bb9d78]">
        {activeActionFilters.length > 0
          ? `当前筛选没有命中处置记录。可尝试移除 ${activeActionFilters[0]?.label ?? '当前条件'}，或直接清空筛选后回看全量历史。`
          : '处置动作会在这里留下最近 6 条记录，方便交班和回看。'}
      </div>
      {activeActionFilters.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClearAllActionFilters}
            className="rounded-full border border-[#5f442b] px-3 py-1.5 text-xs text-[#f0c27b] transition hover:border-[#c98a49]"
          >
            清空筛选并回看全部
          </button>
        </div>
      ) : null}
    </div>
  );
}

function buildTagClass(active: boolean, muted = false) {
  return `rounded-full border px-2 py-0.5 text-[11px] transition ${
    active
      ? 'border-[#c98a49] bg-[#22170f] text-[#f0c27b]'
      : `border-[#3f2e22] bg-[#18130f] ${muted ? 'text-[#bb9d78]' : 'text-[#d9bb97]'}`
  }`;
}
