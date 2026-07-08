import Link from 'next/link';
import type { OperatorActionLabel, OperatorActionPage } from '@/shared/battery-exchange';
import type {
  ActiveActionFilter,
  OperatorActionItem,
  OperatorHistoryLogItem,
} from '../lib/operator-console-utils';
import { BatteryExchangeOperatorHistoryLog } from './battery-exchange-operator-history-log';
import { BatteryExchangeOperatorHistorySummary } from './battery-exchange-operator-history-summary';
import {
  OperatorEmptyNotice,
  OperatorFilterChip,
  OperatorFilterSelect,
  OperatorPanel,
} from './battery-exchange-operator-ui';

export function BatteryExchangeOperatorActionQueueSection({
  visibleActionQueue,
  actionNotes,
  onActionNoteChange,
  onResolveAction,
  pendingActionId,
  actionEntityFilter,
  onActionEntityChange,
  actionLabelFilter,
  onActionLabelChange,
  actionRangeFilter,
  onActionRangeChange,
  actionDateFilter,
  actionSort,
  onActionSortChange,
  actionActorFilter,
  onActionActorChange,
  actionSellerFilter,
  onActionSellerChange,
  actionHistory,
  actionQuery,
  onActionQueryChange,
  activeActionFilters,
  onClearAllActionFilters,
  onRemoveActionFilter,
  onToggleEntityFilter,
  onToggleActionLabel,
  onToggleActionActor,
  onToggleActionSeller,
  onApplyActionDate,
  onApplySellerTimeFacet,
  onApplySellerActionFacet,
  actionLog,
  actionWindowLabel,
  onApplyActionQuery,
  onPrevPage,
  onNextPage,
  formatActionTimestamp,
}: {
  visibleActionQueue: OperatorActionItem[];
  actionNotes: Record<string, string>;
  onActionNoteChange: (id: string, note: string) => void;
  onResolveAction: (item: OperatorActionItem) => void;
  pendingActionId: string | null;
  actionEntityFilter: 'all' | 'listing' | 'trade_order';
  onActionEntityChange: (value: 'all' | 'listing' | 'trade_order') => void;
  actionLabelFilter: 'all' | OperatorActionLabel;
  onActionLabelChange: (value: 'all' | OperatorActionLabel) => void;
  actionRangeFilter: 'all' | 'today' | 'recent_24h';
  onActionRangeChange: (value: 'all' | 'today' | 'recent_24h') => void;
  actionDateFilter: string;
  actionSort: 'recent' | 'action_frequency' | 'actor_frequency' | 'seller_frequency';
  onActionSortChange: (value: 'recent' | 'action_frequency' | 'actor_frequency' | 'seller_frequency') => void;
  actionActorFilter: string;
  onActionActorChange: (value: string) => void;
  actionSellerFilter: string;
  onActionSellerChange: (value: string) => void;
  actionHistory: OperatorActionPage;
  actionQuery: string;
  onActionQueryChange: (value: string) => void;
  activeActionFilters: ActiveActionFilter[];
  onClearAllActionFilters: () => void;
  onRemoveActionFilter: (key: ActiveActionFilter['key']) => void;
  onToggleEntityFilter: (entityType: 'listing' | 'trade_order') => void;
  onToggleActionLabel: (value: 'all' | OperatorActionLabel) => void;
  onToggleActionActor: (value: string) => void;
  onToggleActionSeller: (value: string) => void;
  onApplyActionDate: (value: string) => void;
  onApplySellerTimeFacet: (sellerName: string, date: string) => void;
  onApplySellerActionFacet: (sellerName: string, actionLabel: OperatorActionLabel) => void;
  actionLog: OperatorHistoryLogItem[];
  actionWindowLabel: string;
  onApplyActionQuery: (query: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  formatActionTimestamp: (value: string) => string;
}) {
  return (
    <OperatorPanel eyebrow="Action Queue" title="今天最值得推进的处置">
      <div className="space-y-3">
        {visibleActionQueue.length > 0 ? (
          visibleActionQueue.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-[20px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#f6dfbc]">{item.title}</div>
                  <div className="mt-1 text-xs text-[#b99876]">
                    {item.entityType === 'listing' ? '货盘处置' : '交易处置'} · {item.context}
                  </div>
                </div>
                <div className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f0c27b]">
                  P{item.priority}
                </div>
              </div>
              <div className="mt-3 text-xs leading-6 text-[#d9bb97]">{item.recommendation}</div>
              <label className="mt-3 block text-xs text-[#bb9d78]">
                <span className="uppercase tracking-[0.18em] text-[#a97f52]">处理备注</span>
                <textarea
                  value={actionNotes[item.id] ?? ''}
                  onChange={(event) => onActionNoteChange(item.id, event.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-2xl border border-[#3f2e22] bg-[#14110f] px-3 py-2 text-sm text-[#f4ead1] outline-none transition focus:border-[#c98a49]"
                  placeholder="补一句交班备注，例如先冻结外放，待实验室复核。"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onResolveAction(item)}
                  disabled={pendingActionId === item.id}
                  className="rounded-full bg-[#f0b76b] px-4 py-2 text-sm font-semibold text-[#20160f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingActionId === item.id ? '提交中...' : item.primaryActionLabel}
                </button>
                <Link
                  href={item.href}
                  className="rounded-full border border-[#6d4d31] px-4 py-2 text-sm font-semibold text-[#f3d0a1]"
                >
                  查看详情
                </Link>
              </div>
            </div>
          ))
        ) : (
          <OperatorEmptyNotice text="当前筛选下没有待处置动作，说明重点队列已经被清空。" />
        )}
      </div>
      <div className="mt-5 rounded-[18px] border border-[#2f2823] bg-[#110f0d] px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#a97f52]">Recent Actions</div>
          <div className="flex flex-wrap gap-2 text-xs text-[#d9bb97]">
            <OperatorFilterChip active={actionEntityFilter === 'all'} onClick={() => onActionEntityChange('all')}>
              全部
            </OperatorFilterChip>
            <OperatorFilterChip active={actionEntityFilter === 'listing'} onClick={() => onActionEntityChange('listing')}>
              货盘
            </OperatorFilterChip>
            <OperatorFilterChip active={actionEntityFilter === 'trade_order'} onClick={() => onActionEntityChange('trade_order')}>
              交易
            </OperatorFilterChip>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <OperatorFilterSelect
            label="动作类型"
            value={actionLabelFilter}
            onChange={(value) => onActionLabelChange(value as 'all' | OperatorActionLabel)}
            options={[
              { value: 'all', label: '全部动作' },
              { value: '转人工审核', label: '转人工审核' },
              { value: '联系卖家补件', label: '联系卖家补件' },
              { value: '标记待补资料', label: '标记待补资料' },
              { value: '升级争议处理', label: '升级争议处理' },
              { value: '催验货结果', label: '催验货结果' },
            ]}
          />
          <OperatorFilterSelect
            label="时间范围"
            value={actionRangeFilter}
            onChange={(value) => onActionRangeChange(value as 'all' | 'today' | 'recent_24h')}
            options={[
              { value: 'all', label: '全部时间' },
              { value: 'today', label: '今天' },
              { value: 'recent_24h', label: '近 24 小时' },
            ]}
          />
        </div>
        <div className="mt-3">
          <OperatorFilterSelect
            label="排序方式"
            value={actionSort}
            onChange={(value) =>
              onActionSortChange(value as 'recent' | 'action_frequency' | 'actor_frequency' | 'seller_frequency')
            }
            options={[
              { value: 'recent', label: '最新优先' },
              { value: 'action_frequency', label: '高频动作优先' },
              { value: 'actor_frequency', label: '高频处理人优先' },
              { value: 'seller_frequency', label: '高频卖家优先' },
            ]}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <OperatorFilterSelect
            label="处理人"
            value={actionActorFilter}
            onChange={onActionActorChange}
            options={[
              { value: 'all', label: '全部处理人' },
              { value: '风控台值班', label: '风控台值班' },
            ]}
          />
          <OperatorFilterSelect
            label="卖家主体"
            value={actionSellerFilter}
            onChange={onActionSellerChange}
            options={[
              { value: 'all', label: '全部卖家' },
              ...actionHistory.summary.sellerCounts.map((item) => ({
                value: item.sellerName,
                label: `${item.sellerName} · ${item.count}`,
              })),
            ]}
          />
          <label className="grid gap-2 text-xs text-[#d9bb97]">
            <span className="uppercase tracking-[0.18em] text-[#a97f52]">关键词</span>
            <input
              value={actionQuery}
              onChange={(event) => onActionQueryChange(event.target.value)}
              className="rounded-2xl border border-[#3f2e22] bg-[#14110f] px-3 py-2.5 text-sm text-[#f4ead1] outline-none transition focus:border-[#c98a49]"
              placeholder="搜备注、来源原因、动作名称或实体编号"
            />
          </label>
        </div>
        {activeActionFilters.length > 0 ? (
          <div className="mt-3 rounded-[18px] border border-[#2f2823] bg-[#14110f] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#a97f52]">当前筛选</div>
              <button
                type="button"
                onClick={onClearAllActionFilters}
                className="rounded-full border border-[#5f442b] px-3 py-1 text-xs text-[#f0c27b] transition hover:border-[#c98a49]"
              >
                一键清空
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#d9bb97]">
              {activeActionFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => onRemoveActionFilter(filter.key)}
                  className="rounded-full border border-[#3f2e22] bg-[#18130f] px-3 py-1 transition hover:border-[#c98a49] hover:text-[#f0c27b]"
                >
                  {filter.label} x
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <BatteryExchangeOperatorHistorySummary
          summary={actionHistory.summary}
          actionEntityFilter={actionEntityFilter}
          actionLabelFilter={actionLabelFilter}
          actionActorFilter={actionActorFilter}
          actionSellerFilter={actionSellerFilter}
          actionDateFilter={actionDateFilter}
          onToggleEntityFilter={onToggleEntityFilter}
          onToggleActionLabel={onToggleActionLabel}
          onToggleActionActor={onToggleActionActor}
          onToggleActionSeller={onToggleActionSeller}
          onApplyActionDate={onApplyActionDate}
          onApplySellerTimeFacet={onApplySellerTimeFacet}
          onApplySellerActionFacet={onApplySellerActionFacet}
        />
        <BatteryExchangeOperatorHistoryLog
          items={actionLog}
          activeActionFilters={activeActionFilters}
          actionWindowLabel={actionWindowLabel}
          actionHistory={actionHistory}
          actionEntityFilter={actionEntityFilter}
          actionActorFilter={actionActorFilter}
          actionSellerFilter={actionSellerFilter}
          actionLabelFilter={actionLabelFilter}
          actionQuery={actionQuery}
          onToggleEntityFilter={onToggleEntityFilter}
          onToggleActionActor={onToggleActionActor}
          onToggleActionSeller={onToggleActionSeller}
          onToggleActionLabel={onToggleActionLabel}
          onApplyActionQuery={onApplyActionQuery}
          onClearAllActionFilters={onClearAllActionFilters}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
          formatActionTimestamp={formatActionTimestamp}
        />
      </div>
    </OperatorPanel>
  );
}
