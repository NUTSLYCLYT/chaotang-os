'use client';

import { useMemo, useState } from 'react';
import type { OperatorActionLabel } from '@/shared/battery-exchange';
import { BatteryExchangeOperatorActionQueueSection } from './battery-exchange-operator-action-queue-section';
import { BatteryExchangeOperatorHeader } from './battery-exchange-operator-header';
import { BatteryExchangeOperatorMetrics } from './battery-exchange-operator-metrics';
import { BatteryExchangeOperatorReviewSection } from './battery-exchange-operator-review-section';
import { BatteryExchangeOperatorSellerWatchlistSection } from './battery-exchange-operator-seller-watchlist-section';
import { BatteryExchangeOperatorTradeRisksSection } from './battery-exchange-operator-trade-risks-section';
import { useOperatorActionFilters } from '../lib/use-operator-action-filters';
import { useOperatorActionHistory } from '../lib/use-operator-action-history';
import { useOperatorConsoleData } from '../lib/use-operator-console-data';
import { useOperatorConsoleFilters } from '../lib/use-operator-console-filters';
import { useOperatorConsoleShare } from '../lib/use-operator-console-share';
import {
  buildOperatorScopePills,
  buildOperatorHistoryLogItems,
  formatActionTimestamp,
  type OperatorHistoryLogItem,
  type OperatorActionItem,
} from '../lib/operator-console-utils';

export function BatteryExchangeOperatorConsole() {
  const operatorActorName = '风控台值班';
  const {
    listingFilter,
    setListingFilter,
    orderSort,
    setOrderSort,
    reviewSellerId,
    setReviewSellerId,
    reviewCity,
    setReviewCity,
    orderSellerId,
    setOrderSellerId,
    orderSeverity,
    setOrderSeverity,
    orderStatus,
    setOrderStatus,
    applyConsoleFilters,
  } = useOperatorConsoleFilters();
  const {
    actionEntityFilter,
    actionLabelFilter,
    actionRangeFilter,
    actionDateFilter,
    actionActorFilter,
    actionSellerFilter,
    actionQuery,
    actionSort,
    actionPage,
    setActionPage,
    setActionEntityFilter,
    setActionLabelFilter,
    setActionRangeFilter,
    setActionActorFilter,
    setActionSellerFilter,
    setActionSort,
    setActionQuery,
    toggleActionEntityFilter,
    toggleActionLabelFilter,
    toggleActionActorFilter,
    toggleActionSellerFilter,
    applySellerActionFacet,
    applyActionDateFilter,
    applySellerTimeFacet,
    clearAllActionFilters,
    applyActionQuery,
    removeActionFilter,
    applyActionFilters,
  } = useOperatorActionFilters();
  const [error, setError] = useState('');
  const {
    actionHistory,
    actionNotes,
    resolvedActions,
    pendingActionId,
    activeActionFilters,
    actionWindowLabel,
    updateActionNote,
    handleResolveAction,
  } = useOperatorActionHistory({
    actorName: operatorActorName,
    filters: {
      actionEntityFilter,
      actionLabelFilter,
      actionRangeFilter,
      actionDateFilter,
      actionActorFilter,
      actionSellerFilter,
      actionQuery,
      actionSort,
      actionPage,
    },
    onError: setError,
    onSuccess: () => {
      setError('');
      setActionPage(1);
      setActionEntityFilter('all');
    },
  });
  const {
    overview,
    listings,
    sellers,
    tradeOrders,
    sellerMap,
    reviewListings,
    reviewCities,
    visibleReviewListings,
    riskyOrders,
    visibleRiskyOrders,
    sellerWatchlist,
    fastMovingOrders,
    visibleActionQueue,
  } = useOperatorConsoleData({
    listingFilter,
    reviewSellerId,
    reviewCity,
    orderSort,
    orderSellerId,
    orderSeverity,
    orderStatus,
    resolvedActions,
    onError: setError,
  });
  const actionLog = useMemo<OperatorHistoryLogItem[]>(
    () => buildOperatorHistoryLogItems(actionHistory.items, listings, tradeOrders, sellerMap),
    [actionHistory.items, listings, sellerMap, tradeOrders],
  );
  const scopePills = useMemo(
    () =>
      buildOperatorScopePills({
        listingFilter,
        reviewSellerId,
        reviewCity,
        orderSort,
        orderSellerId,
        orderSeverity,
        orderStatus,
        activeActionFilters,
        sellerNameById: new Map(sellers.map((seller) => [seller.id, seller.companyName])),
      }),
    [
      activeActionFilters,
      listingFilter,
      orderSellerId,
      orderSeverity,
      orderSort,
      orderStatus,
      reviewCity,
      reviewSellerId,
      sellers,
    ],
  );
  const { copyCurrentView, copyState } = useOperatorConsoleShare({
    state: {
      listingFilter,
      orderSort,
      reviewSellerId,
      reviewCity,
      orderSellerId,
      orderSeverity,
      orderStatus,
      actionEntityFilter,
      actionLabelFilter,
      actionRangeFilter,
      actionDateFilter,
      actionActorFilter,
      actionSellerFilter,
      actionQuery,
      actionSort,
      actionPage,
    },
    applyConsoleFilters,
    applyActionFilters,
  });

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#111111] text-[#f3ead3]">
      <div
        className="absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 15% 12%, rgba(226,114,39,0.16), transparent 24%), radial-gradient(circle at 82% 10%, rgba(244,199,91,0.14), transparent 28%), linear-gradient(180deg, #171412 0%, #111111 46%, #0b0b0b 100%)',
        }}
      />
      <div className="relative mx-auto max-w-[1480px] px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <BatteryExchangeOperatorHeader
          onCopyView={copyCurrentView}
          copyState={copyState}
          scopePills={scopePills}
        />

        {error ? (
          <div className="mt-6 rounded-[22px] border border-[#7a2f2f] bg-[#2c1111] px-4 py-5 text-sm text-[#f1b2b2]">
            {error}
          </div>
        ) : null}

        <BatteryExchangeOperatorMetrics
          reviewListingCount={reviewListings.length}
          riskyOrderCount={riskyOrders.length}
          fastMovingOrderCount={fastMovingOrders.length}
          verifiedSellerCount={overview ? overview.verifiedSellers : sellers.length}
        />

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <BatteryExchangeOperatorReviewSection
            listingFilter={listingFilter}
            onListingFilterChange={setListingFilter}
            reviewSellerId={reviewSellerId}
            onReviewSellerChange={setReviewSellerId}
            reviewCity={reviewCity}
            onReviewCityChange={setReviewCity}
            sellers={sellers}
            reviewCities={reviewCities}
            visibleReviewListings={visibleReviewListings}
            sellerMap={sellerMap}
          />
          <BatteryExchangeOperatorTradeRisksSection
            orderSort={orderSort}
            onOrderSortChange={setOrderSort}
            orderSellerId={orderSellerId}
            onOrderSellerChange={setOrderSellerId}
            orderSeverity={orderSeverity}
            onOrderSeverityChange={setOrderSeverity}
            orderStatus={orderStatus}
            onOrderStatusChange={setOrderStatus}
            sellers={sellers}
            visibleRiskyOrders={visibleRiskyOrders}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <BatteryExchangeOperatorSellerWatchlistSection sellerWatchlist={sellerWatchlist} />
          <BatteryExchangeOperatorActionQueueSection
            visibleActionQueue={visibleActionQueue}
            actionNotes={actionNotes}
            onActionNoteChange={updateActionNote}
            onResolveAction={(item: OperatorActionItem) =>
              handleResolveAction({
                id: item.id,
                entityType: item.entityType,
                entityId: item.entityId,
                actionLabel: item.primaryActionLabel,
                sourceReason: item.recommendation,
              })
            }
            pendingActionId={pendingActionId}
            actionEntityFilter={actionEntityFilter}
            onActionEntityChange={setActionEntityFilter}
            actionLabelFilter={actionLabelFilter}
            onActionLabelChange={setActionLabelFilter}
            actionRangeFilter={actionRangeFilter}
            onActionRangeChange={setActionRangeFilter}
            actionDateFilter={actionDateFilter}
            actionSort={actionSort}
            onActionSortChange={setActionSort}
            actionActorFilter={actionActorFilter}
            onActionActorChange={setActionActorFilter}
            actionSellerFilter={actionSellerFilter}
            onActionSellerChange={setActionSellerFilter}
            actionHistory={actionHistory}
            actionQuery={actionQuery}
            onActionQueryChange={setActionQuery}
            activeActionFilters={activeActionFilters}
            onClearAllActionFilters={clearAllActionFilters}
            onRemoveActionFilter={removeActionFilter}
            onToggleEntityFilter={toggleActionEntityFilter}
            onToggleActionLabel={toggleActionLabelFilter}
            onToggleActionActor={toggleActionActorFilter}
            onToggleActionSeller={toggleActionSellerFilter}
            onApplyActionDate={applyActionDateFilter}
            onApplySellerTimeFacet={applySellerTimeFacet}
            onApplySellerActionFacet={applySellerActionFacet}
            actionLog={actionLog}
            actionWindowLabel={actionWindowLabel}
            onApplyActionQuery={applyActionQuery}
            onPrevPage={() => setActionPage((current) => Math.max(1, current - 1))}
            onNextPage={() => setActionPage((current) => Math.min(actionHistory.totalPages, current + 1))}
            formatActionTimestamp={formatActionTimestamp}
          />
        </section>
      </div>
    </div>
  );
}
