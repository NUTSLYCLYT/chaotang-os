'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BatteryListing, MarketOverview, SellerProfile, TradeOrder } from '@/shared/battery-exchange';
import {
  buildOperatorActionQueue,
  buildReviewListings,
  buildRiskyOrders,
  filterReviewListings,
  sortRiskyOrders,
  type OperatorListingFilter,
  type OperatorOrderSeverityFilter,
  type OperatorOrderSort,
  type OperatorOrderStatusFilter,
} from './operator-console-utils';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data;
}

type UseOperatorConsoleDataOptions = {
  listingFilter: OperatorListingFilter;
  reviewSellerId: string;
  reviewCity: string;
  orderSort: OperatorOrderSort;
  orderSellerId: string;
  orderSeverity: OperatorOrderSeverityFilter;
  orderStatus: OperatorOrderStatusFilter;
  resolvedActions: Record<string, string>;
  onError: (message: string) => void;
};

export function useOperatorConsoleData({
  listingFilter,
  reviewSellerId,
  reviewCity,
  orderSort,
  orderSellerId,
  orderSeverity,
  orderStatus,
  resolvedActions,
  onError,
}: UseOperatorConsoleDataOptions) {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [listings, setListings] = useState<BatteryListing[]>([]);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [tradeOrders, setTradeOrders] = useState<TradeOrder[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [overviewData, listingData, sellerData, tradeOrderData] = await Promise.all([
          readJson<MarketOverview>('/api/battery-exchange/overview'),
          readJson<BatteryListing[]>('/api/battery-exchange/listings'),
          readJson<SellerProfile[]>('/api/battery-exchange/sellers'),
          readJson<TradeOrder[]>('/api/battery-exchange/trade-orders'),
        ]);

        if (!mounted) return;
        setOverview(overviewData);
        setListings(listingData);
        setSellers(sellerData);
        setTradeOrders(tradeOrderData);
      } catch (err) {
        if (!mounted) return;
        onError(err instanceof Error ? err.message : '风控台加载失败');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [onError]);

  const sellerMap = useMemo(() => new Map(sellers.map((seller) => [seller.id, seller])), [sellers]);
  const reviewListings = useMemo(() => buildReviewListings(listings, sellerMap), [listings, sellerMap]);
  const reviewCities = useMemo(
    () => Array.from(new Set(reviewListings.map((listing) => listing.locationCity))).sort(),
    [reviewListings],
  );
  const visibleReviewListings = useMemo(
    () =>
      filterReviewListings(reviewListings, listingFilter, {
        sellerId: reviewSellerId,
        city: reviewCity,
      }),
    [listingFilter, reviewCity, reviewListings, reviewSellerId],
  );
  const riskyOrders = useMemo(() => buildRiskyOrders(tradeOrders), [tradeOrders]);
  const visibleRiskyOrders = useMemo(
    () =>
      sortRiskyOrders(riskyOrders, orderSort, {
        sellerId: orderSellerId,
        severity: orderSeverity,
        status: orderStatus,
      }),
    [orderSellerId, orderSeverity, orderSort, orderStatus, riskyOrders],
  );
  const sellerWatchlist = useMemo(
    () =>
      sellers
        .filter((seller) => seller.complaintRate >= 1 || seller.fulfillmentScore < 90)
        .sort((left, right) => right.complaintRate - left.complaintRate),
    [sellers],
  );
  const fastMovingOrders = useMemo(
    () =>
      tradeOrders
        .filter((order) => order.status === 'awaiting_escrow' || order.status === 'awaiting_inspection')
        .sort((left, right) => right.totalAmountCny - left.totalAmountCny),
    [tradeOrders],
  );
  const actionQueue = useMemo(
    () => buildOperatorActionQueue(visibleReviewListings, visibleRiskyOrders, sellerMap),
    [sellerMap, visibleReviewListings, visibleRiskyOrders],
  );
  const visibleActionQueue = useMemo(
    () => actionQueue.filter((item) => !resolvedActions[item.id]),
    [actionQueue, resolvedActions],
  );

  return {
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
  };
}
