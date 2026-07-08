import type {
  BatteryListing,
  OperatorActionLog,
  OperatorActionPage,
  OperatorActionSummary,
  OperatorActionLabel,
  SellerProfile,
  TradeOrder,
} from '@/shared/battery-exchange';

export type OperatorListingFilter = 'all' | 'attention' | 'high_risk';
export type OperatorOrderSort = 'amount_desc' | 'risk_desc';
export type OperatorOrderSeverityFilter = 'all' | 'high' | 'medium';
export type OperatorOrderStatusFilter = 'all' | 'awaiting_inspection' | 'in_dispute';
export type OperatorActionItem = {
  id: string;
  entityType: 'listing' | 'trade_order';
  entityId: string;
  title: string;
  context: string;
  recommendation: string;
  primaryActionLabel: OperatorActionLabel;
  href: string;
  priority: number;
};

export type OperatorHistoryLogItem = OperatorActionLog & {
  title: string;
  sellerName: string;
  href: string;
};

export type ActiveActionFilter = {
  key: 'entity' | 'label' | 'range' | 'date' | 'actor' | 'seller' | 'query' | 'sort';
  label: string;
};

export type OperatorScopePill = {
  key: string;
  label: string;
};

export type OperatorActionHistoryFilters = {
  actionEntityFilter: 'all' | 'listing' | 'trade_order';
  actionLabelFilter: 'all' | OperatorActionLabel;
  actionRangeFilter: 'all' | 'today' | 'recent_24h';
  actionDateFilter: string;
  actionActorFilter: string;
  actionSellerFilter: string;
  actionQuery: string;
  actionSort: 'recent' | 'action_frequency' | 'actor_frequency' | 'seller_frequency';
  actionPage: number;
};

type ReviewListingOptions = {
  sellerId?: string;
  city?: string;
};

type RiskyOrderOptions = {
  sellerId?: string;
  severity?: OperatorOrderSeverityFilter;
  status?: OperatorOrderStatusFilter;
};

function isHighRiskListing(listing: BatteryListing) {
  return listing.grade === 'b+' || listing.tags.some((tag) => /样机/.test(tag));
}

function isAttentionListing(listing: BatteryListing) {
  return listing.grade !== 'a' || listing.tags.some((tag) => /复检|项目余量/.test(tag));
}

function matchesReviewListingOptions(listing: BatteryListing, options: ReviewListingOptions) {
  if (options.sellerId && options.sellerId !== 'all' && listing.sellerId !== options.sellerId) {
    return false;
  }

  if (options.city && options.city !== 'all' && listing.locationCity !== options.city) {
    return false;
  }

  return true;
}

function getOrderMaxSeverity(order: TradeOrder) {
  const weight = { high: 3, medium: 2, low: 1 } as const;
  return Math.max(...order.riskFlags.map((risk) => weight[risk.severity]), 0);
}

function matchesRiskyOrderOptions(order: TradeOrder, options: RiskyOrderOptions) {
  if (options.sellerId && options.sellerId !== 'all' && order.sellerId !== options.sellerId) {
    return false;
  }

  if (options.status && options.status !== 'all' && order.status !== options.status) {
    return false;
  }

  if (options.severity && options.severity !== 'all') {
    const maxSeverity = getOrderMaxSeverity(order);
    if (options.severity === 'high' && maxSeverity < 3) return false;
    if (options.severity === 'medium' && maxSeverity < 2) return false;
  }

  return true;
}

export function buildReviewListings(listings: BatteryListing[], sellerMap: Map<string, SellerProfile>) {
  return listings
    .filter((listing) => {
      const seller = sellerMap.get(listing.sellerId);
      return (
        listing.grade === 'b+' ||
        listing.tags.some((tag) => /样机|复检|项目余量/.test(tag)) ||
        (seller?.complaintRate ?? 0) >= 1
      );
    })
    .sort((left, right) => right.priceCny - left.priceCny);
}

export function filterReviewListings(
  listings: BatteryListing[],
  filter: OperatorListingFilter,
  options: ReviewListingOptions = {},
) {
  const modeFiltered = listings.filter((listing) => {
    switch (filter) {
      case 'high_risk':
        return isHighRiskListing(listing);
      case 'attention':
        return !isHighRiskListing(listing);
      default:
        return true;
    }
  });

  return modeFiltered.filter((listing) => matchesReviewListingOptions(listing, options));
}

export function buildRiskyOrders(tradeOrders: TradeOrder[]) {
  return tradeOrders.filter(
    (order) => order.status === 'in_dispute' || order.riskFlags.some((risk) => risk.severity === 'high'),
  );
}

export function sortRiskyOrders(
  tradeOrders: TradeOrder[],
  sort: OperatorOrderSort,
  options: RiskyOrderOptions = {},
) {
  const copy = tradeOrders.filter((order) => matchesRiskyOrderOptions(order, options));
  if (sort === 'risk_desc') {
    return copy.sort((left, right) => {
      const leftRisk = getOrderMaxSeverity(left);
      const rightRisk = getOrderMaxSeverity(right);
      if (rightRisk !== leftRisk) return rightRisk - leftRisk;
      return right.totalAmountCny - left.totalAmountCny;
    });
  }

  return copy.sort((left, right) => right.totalAmountCny - left.totalAmountCny);
}

export function buildOperatorActionQueue(
  reviewListings: BatteryListing[],
  riskyOrders: TradeOrder[],
  sellerMap: Map<string, SellerProfile>,
) {
  const listingActions: OperatorActionItem[] = reviewListings.map((listing) => {
    const seller = sellerMap.get(listing.sellerId);
    const highRisk = isHighRiskListing(listing);
    const sellerPressure = (seller?.complaintRate ?? 0) >= 1;

    return {
      id: `listing:${listing.id}`,
      entityType: 'listing',
      entityId: listing.id,
      title: listing.title,
      context: `${listing.locationCity} · ${seller?.companyName ?? '未知卖家'}`,
      recommendation: highRisk
        ? 'B+ 或样机货盘，先转人工审核并确认用途边界。'
        : sellerPressure
          ? '卖家投诉率偏高，先联系补齐批次与交付说明。'
          : '先补检测或项目余量说明，再决定是否继续外放。',
      primaryActionLabel: highRisk ? '转人工审核' : sellerPressure ? '联系卖家补件' : '标记待补资料',
      href: `/battery-exchange/listings/${listing.id}`,
      priority: highRisk ? 90 : sellerPressure ? 78 : 68,
    };
  });

  const orderActions: OperatorActionItem[] = riskyOrders.map((order) => ({
    id: `trade:${order.id}`,
    entityType: 'trade_order',
    entityId: order.id,
    title: order.buyerCompany,
    context: `${order.id} · ${order.quantity} 件 · ¥${order.totalAmountCny}`,
    recommendation:
      order.status === 'in_dispute'
        ? '争议单优先升级到人工仲裁，并整理双方证据链。'
        : '先催第三方验货结果，再决定是否进入放款准备。',
    primaryActionLabel: order.status === 'in_dispute' ? '升级争议处理' : '催验货结果',
    href: `/battery-exchange/trade-orders/${order.id}`,
    priority: order.status === 'in_dispute' ? 100 : 84,
  }));

  return [...orderActions, ...listingActions].sort((left, right) => right.priority - left.priority);
}

export function buildOperatorHistoryLogItems(
  items: OperatorActionLog[],
  listings: BatteryListing[],
  tradeOrders: TradeOrder[],
  sellerMap: Map<string, SellerProfile>,
): OperatorHistoryLogItem[] {
  return items.map((item) => ({
    ...item,
    title: resolveOperatorActionTitle(item, listings, tradeOrders),
    sellerName: resolveOperatorActionSellerName(item, listings, tradeOrders, sellerMap),
    href: resolveOperatorActionHref(item),
  }));
}

export function buildActionWindowLabel(page: Pick<OperatorActionPage, 'page' | 'pageSize' | 'total'>) {
  if (page.total === 0) {
    return '0 / 0 条';
  }

  const start = (page.page - 1) * page.pageSize + 1;
  const end = Math.min(page.page * page.pageSize, page.total);
  return `${start}-${end} / ${page.total} 条`;
}

export function buildActiveActionFilters(filters: {
  entityFilter: 'all' | 'listing' | 'trade_order';
  labelFilter: 'all' | OperatorActionLabel;
  rangeFilter: 'all' | 'today' | 'recent_24h';
  dateFilter: string;
  actorFilter: string;
  sellerFilter: string;
  query: string;
  sort: 'recent' | 'action_frequency' | 'actor_frequency' | 'seller_frequency';
}): ActiveActionFilter[] {
  const items: ActiveActionFilter[] = [];

  if (filters.entityFilter === 'listing') {
    items.push({ key: 'entity', label: '实体: 货盘' });
  } else if (filters.entityFilter === 'trade_order') {
    items.push({ key: 'entity', label: '实体: 交易' });
  }

  if (filters.labelFilter !== 'all') {
    items.push({ key: 'label', label: `动作: ${filters.labelFilter}` });
  }

  if (filters.rangeFilter === 'today') {
    items.push({ key: 'range', label: '时间: 今天' });
  } else if (filters.rangeFilter === 'recent_24h') {
    items.push({ key: 'range', label: '时间: 近 24 小时' });
  }

  if (filters.dateFilter) {
    items.push({ key: 'date', label: `日期: ${filters.dateFilter}` });
  }

  if (filters.actorFilter !== 'all') {
    items.push({ key: 'actor', label: `处理人: ${filters.actorFilter}` });
  }

  if (filters.sellerFilter !== 'all') {
    items.push({ key: 'seller', label: `卖家: ${filters.sellerFilter}` });
  }

  if (filters.query.trim()) {
    items.push({ key: 'query', label: `关键词: ${filters.query.trim()}` });
  }

  if (filters.sort === 'action_frequency') {
    items.push({ key: 'sort', label: '排序: 高频动作优先' });
  } else if (filters.sort === 'actor_frequency') {
    items.push({ key: 'sort', label: '排序: 高频处理人优先' });
  } else if (filters.sort === 'seller_frequency') {
    items.push({ key: 'sort', label: '排序: 高频卖家优先' });
  }

  return items;
}

export function buildOperatorScopePills({
  listingFilter,
  reviewSellerId,
  reviewCity,
  orderSort,
  orderSellerId,
  orderSeverity,
  orderStatus,
  activeActionFilters,
  sellerNameById,
}: {
  listingFilter: OperatorListingFilter;
  reviewSellerId: string;
  reviewCity: string;
  orderSort: OperatorOrderSort;
  orderSellerId: string;
  orderSeverity: OperatorOrderSeverityFilter;
  orderStatus: OperatorOrderStatusFilter;
  activeActionFilters: ActiveActionFilter[];
  sellerNameById: Map<string, string>;
}): OperatorScopePill[] {
  const items: OperatorScopePill[] = [];

  if (listingFilter === 'attention') {
    items.push({ key: 'listingFilter', label: '货盘: 待关注' });
  } else if (listingFilter === 'high_risk') {
    items.push({ key: 'listingFilter', label: '货盘: 高风险' });
  }

  if (reviewSellerId !== 'all') {
    items.push({
      key: 'reviewSeller',
      label: `审核卖家: ${sellerNameById.get(reviewSellerId) ?? reviewSellerId}`,
    });
  }

  if (reviewCity !== 'all') {
    items.push({ key: 'reviewCity', label: `审核城市: ${reviewCity}` });
  }

  if (orderSort === 'risk_desc') {
    items.push({ key: 'orderSort', label: '交易: 风险优先' });
  }

  if (orderSellerId !== 'all') {
    items.push({
      key: 'orderSeller',
      label: `交易卖家: ${sellerNameById.get(orderSellerId) ?? orderSellerId}`,
    });
  }

  if (orderSeverity !== 'all') {
    items.push({ key: 'orderSeverity', label: `风险级别: ${orderSeverity === 'high' ? '高' : '中及以上'}` });
  }

  if (orderStatus !== 'all') {
    items.push({
      key: 'orderStatus',
      label: `交易状态: ${orderStatus === 'in_dispute' ? '争议中' : '待验货'}`,
    });
  }

  return [...items, ...activeActionFilters.map((item) => ({ key: `action-${item.key}`, label: item.label }))];
}

export function formatActionTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function createEmptyOperatorActionSummary(): OperatorActionSummary {
  return {
    listingCount: 0,
    tradeOrderCount: 0,
    timeBuckets: [],
    actionTimeBuckets: [],
    sellerTimeBuckets: [],
    actionCounts: [],
    actorCounts: [],
    sellerCounts: [],
    sellerActionCounts: [],
  };
}

export function createEmptyOperatorActionPage(pageSize = 6): OperatorActionPage {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 1,
    summary: createEmptyOperatorActionSummary(),
  };
}

export function buildOperatorActionsQuery(filters: OperatorActionHistoryFilters) {
  const params = new URLSearchParams({
    page: String(filters.actionPage),
    pageSize: '6',
  });

  if (filters.actionEntityFilter !== 'all') {
    params.set('entityType', filters.actionEntityFilter);
  }
  if (filters.actionLabelFilter !== 'all') {
    params.set('actionLabel', filters.actionLabelFilter);
  }
  if (filters.actionActorFilter !== 'all') {
    params.set('actorName', filters.actionActorFilter);
  }
  if (filters.actionSellerFilter !== 'all') {
    params.set('sellerName', filters.actionSellerFilter);
  }
  if (filters.actionDateFilter) {
    params.set('createdOn', filters.actionDateFilter);
  }

  const createdAfter = buildActionCreatedAfter(filters.actionRangeFilter);
  if (createdAfter) {
    params.set('createdAfter', createdAfter);
  }
  if (filters.actionQuery.trim()) {
    params.set('query', filters.actionQuery.trim());
  }
  if (filters.actionSort !== 'recent') {
    params.set('sort', filters.actionSort);
  }

  return params.toString();
}

function resolveOperatorActionTitle(
  action: OperatorActionLog,
  listings: BatteryListing[],
  tradeOrders: TradeOrder[],
) {
  if (action.entityType === 'listing') {
    return listings.find((listing) => listing.id === action.entityId)?.title ?? action.entityId;
  }

  return tradeOrders.find((order) => order.id === action.entityId)?.buyerCompany ?? action.entityId;
}

function resolveOperatorActionSellerName(
  action: OperatorActionLog,
  listings: BatteryListing[],
  tradeOrders: TradeOrder[],
  sellerMap: Map<string, SellerProfile>,
) {
  const sellerId =
    action.entityType === 'listing'
      ? listings.find((listing) => listing.id === action.entityId)?.sellerId
      : tradeOrders.find((order) => order.id === action.entityId)?.sellerId;

  if (!sellerId) {
    return '';
  }

  return sellerMap.get(sellerId)?.companyName ?? '';
}

function resolveOperatorActionHref(action: OperatorActionLog) {
  if (action.entityType === 'listing') {
    return `/battery-exchange/listings/${action.entityId}`;
  }

  return `/battery-exchange/trade-orders/${action.entityId}`;
}

function buildActionCreatedAfter(range: 'all' | 'today' | 'recent_24h') {
  if (range === 'all') return '';

  const now = new Date();
  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
}
