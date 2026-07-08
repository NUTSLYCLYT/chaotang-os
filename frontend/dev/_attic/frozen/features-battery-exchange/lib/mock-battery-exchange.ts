import type {
  BatteryListing,
  BatteryListingDetail,
  CreateInquiryInput,
  CreateOperatorActionInput,
  CreateTradeOrderInput,
  Inquiry,
  MarketOverview,
  OperatorActionLabel,
  OperatorActionLog,
  OperatorActionPage,
  RecommendedTradeStructure,
  SellerProfile,
  TradeOrder,
  TradeOrderDetail,
  TradeTimelineStep,
} from '@/shared/battery-exchange';
import { createEmptyOperatorActionSummary } from './operator-console-utils';

class MockBatteryExchangeError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SELLERS: SellerProfile[] = [
  {
    id: 'seller-1',
    companyName: '苏州衡启储能贸易',
    city: '苏州',
    verified: true,
    assuranceTier: 'escrow-plus',
    fulfillmentScore: 96,
    monthlyCapacityKwh: 4200,
    complaintRate: 0.7,
    leadTimeDays: 2,
    specialties: ['宁德时代库存模组', '项目尾货', '现货整托'],
  },
  {
    id: 'seller-2',
    companyName: '深圳拓源动力仓',
    city: '深圳',
    verified: true,
    assuranceTier: 'priority',
    fulfillmentScore: 92,
    monthlyCapacityKwh: 3100,
    complaintRate: 1.1,
    leadTimeDays: 3,
    specialties: ['比亚迪刀片电芯', '储能兼容模组'],
  },
  {
    id: 'seller-3',
    companyName: '合肥澄能电芯中心',
    city: '合肥',
    verified: true,
    assuranceTier: 'verified',
    fulfillmentScore: 88,
    monthlyCapacityKwh: 1800,
    complaintRate: 1.6,
    leadTimeDays: 4,
    specialties: ['A-级电芯', '批次混仓整理'],
  },
];

const LISTINGS: BatteryListing[] = [
  {
    id: 'listing-1',
    title: '宁德时代 280Ah 磷酸铁锂整托现货',
    brand: 'CATL',
    model: 'LF280K',
    chemistry: 'lfp',
    grade: 'a',
    nominalCapacityAh: 280,
    voltageV: 3.2,
    availableQuantity: 1280,
    unit: 'cells',
    lotSize: 64,
    priceCny: 355,
    locationCity: '苏州',
    sellerId: 'seller-1',
    status: 'live',
    tags: ['带原箱', '支持第三方复检', '可锁价48小时'],
    cycleCount: 18,
    createdAt: '2026-04-20T09:00:00.000Z',
    inspection: {
      id: 'inspect-1',
      labName: '华测储能实验室',
      inspectedAt: '2026-04-19T08:00:00.000Z',
      summary: '抽检 32 颗，容量保持率高，DCIR 离散度低。',
      capacityRetention: 99.1,
      dcirMilliohm: 0.24,
      sampleSize: 32,
      attachments: ['capacity-sheet.pdf', 'barcode-pack.zip'],
    },
  },
  {
    id: 'listing-2',
    title: '比亚迪 2025Q1 314Ah 刀片电芯',
    brand: 'BYD',
    model: 'Blade-314',
    chemistry: 'lfp',
    grade: 'a-',
    nominalCapacityAh: 314,
    voltageV: 3.2,
    availableQuantity: 860,
    unit: 'cells',
    lotSize: 40,
    priceCny: 372,
    locationCity: '深圳',
    sellerId: 'seller-2',
    status: 'live',
    tags: ['项目余量', '支持验货后放款', '附批次记录'],
    cycleCount: 23,
    createdAt: '2026-04-21T06:30:00.000Z',
    inspection: {
      id: 'inspect-2',
      labName: '赛宝电池检测',
      inspectedAt: '2026-04-20T11:00:00.000Z',
      summary: '抽检一致性良好，适合储能 pack 二次集成。',
      capacityRetention: 98.4,
      dcirMilliohm: 0.27,
      sampleSize: 24,
      attachments: ['inspection-summary.pdf'],
    },
  },
  {
    id: 'listing-3',
    title: '亿纬 50Ah NCM 模组库存',
    brand: 'EVE',
    model: 'NCM-50M',
    chemistry: 'ncm',
    grade: 'b+',
    nominalCapacityAh: 50,
    voltageV: 51.2,
    availableQuantity: 140,
    unit: 'modules',
    lotSize: 10,
    priceCny: 2880,
    locationCity: '合肥',
    sellerId: 'seller-3',
    status: 'live',
    tags: ['模组级出货', '适合样机验证', '账期需审批'],
    cycleCount: 41,
    createdAt: '2026-04-18T14:20:00.000Z',
    inspection: {
      id: 'inspect-3',
      labName: '合肥工研院新能源测试中心',
      inspectedAt: '2026-04-18T09:00:00.000Z',
      summary: '适合作为二级货源，容量波动可控。',
      capacityRetention: 95.8,
      dcirMilliohm: 1.14,
      sampleSize: 12,
      attachments: ['module-aging.pdf'],
    },
  },
];

const INQUIRIES: Inquiry[] = [
  {
    id: 'inq-1',
    listingId: 'listing-1',
    buyerCompany: '杭州峰值储能',
    message: '需要 640 颗，要求同批次并支持 24 小时内看货。',
    status: 'quoted',
    createdAt: '2026-04-21T09:30:00.000Z',
  },
  {
    id: 'inq-2',
    listingId: 'listing-2',
    buyerCompany: '常州工商业储能集成商',
    message: '询 400 颗含税到仓价，可否锁单 3 天。',
    status: 'open',
    createdAt: '2026-04-22T01:10:00.000Z',
  },
];

const TRADE_ORDERS: TradeOrder[] = [
  {
    id: 'trade-1',
    listingId: 'listing-1',
    buyerCompany: '无锡源网侧系统厂',
    sellerId: 'seller-1',
    quantity: 320,
    totalAmountCny: 113600,
    escrowRatio: 0.3,
    status: 'awaiting_inspection',
    createdAt: '2026-04-21T12:00:00.000Z',
    riskFlags: [
      {
        id: 'risk-1',
        type: 'inspection_pending',
        severity: 'medium',
        note: '买家已打托管定金，待第三方复检后释放尾款。',
      },
    ],
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const state = {
  sellers: clone(SELLERS),
  listings: clone(LISTINGS),
  inquiries: clone(INQUIRIES),
  tradeOrders: clone(TRADE_ORDERS),
  operatorActions: [] as OperatorActionLog[],
};

function findSeller(id: string) {
  const seller = state.sellers.find((entry) => entry.id === id);
  if (!seller) throw new MockBatteryExchangeError(404, `seller ${id} not found`);
  return seller;
}

function findListing(id: string) {
  const listing = state.listings.find((entry) => entry.id === id);
  if (!listing) throw new MockBatteryExchangeError(404, `listing ${id} not found`);
  return listing;
}

function buildPriceAssessment(listing: BatteryListing) {
  const band = Math.max(8, Math.round(listing.priceCny * 0.03));
  return {
    referenceMin: listing.priceCny - band,
    referenceMax: listing.priceCny + band,
    currentPrice: listing.priceCny,
    premiumRate: 0,
    comment: '价格处于当前参考区间内。',
  };
}

function buildTradeStructure(listing: BatteryListing, seller: SellerProfile): RecommendedTradeStructure {
  return {
    escrowRatio: seller.assuranceTier === 'escrow-plus' ? 0.3 : 0.4,
    paymentScheme:
      seller.assuranceTier === 'escrow-plus'
        ? '30% 托管定金 + 验货后放款'
        : '40% 托管定金 + 到仓复检后放款',
    requiresInspection: listing.grade !== 'a' || seller.assuranceTier !== 'escrow-plus',
    splitDeliverySuggested: listing.availableQuantity >= 1000,
  };
}

function buildListingRiskFlags(listing: BatteryListing, seller: SellerProfile) {
  const flags = [];
  if (listing.grade !== 'a') {
    flags.push({
      id: `listing-${listing.id}-grade`,
      type: 'grade_variance',
      severity: listing.grade === 'a-' ? ('low' as const) : ('high' as const),
      note: '非 A 级标准货源，建议验货后放款。',
    });
  }
  if (seller.assuranceTier !== 'escrow-plus') {
    flags.push({
      id: `listing-${listing.id}-seller`,
      type: 'seller_review',
      severity: 'medium' as const,
      note: '卖家不在最高担保层级，建议平台复核履约节点。',
    });
  }
  if (flags.length === 0) {
    flags.push({
      id: `listing-${listing.id}-batch`,
      type: 'batch_verification',
      severity: 'low' as const,
      note: '建议补齐整托批次照片以降低争议概率。',
    });
  }
  return flags;
}

function scoreListing(listing: BatteryListing, seller: SellerProfile) {
  let score = 78;
  if (listing.grade === 'a') score += 8;
  if (listing.inspection.capacityRetention >= 98) score += 6;
  if (seller.assuranceTier === 'escrow-plus') score += 5;
  if (seller.fulfillmentScore >= 90) score += 3;
  return Math.min(score, 96);
}

function buildTradeTimeline(order: TradeOrder): TradeTimelineStep[] {
  const escrowDone = order.status !== 'awaiting_escrow';
  const inspectionDone = order.status === 'ready_to_release';

  return [
    { key: 'created', label: '已发起', done: true, at: order.createdAt },
    { key: 'escrow', label: '已托管', done: escrowDone, at: escrowDone ? order.createdAt : undefined },
    { key: 'inspection', label: '待验货', done: inspectionDone, at: inspectionDone ? order.createdAt : undefined },
    { key: 'release', label: '待放款', done: false },
  ];
}

function resolveOperatorActionSellerName(action: OperatorActionLog) {
  if (action.entityType === 'listing') {
    const listing = state.listings.find((entry) => entry.id === action.entityId);
    return listing ? findSeller(listing.sellerId).companyName : '未知卖家';
  }

  const order = state.tradeOrders.find((entry) => entry.id === action.entityId);
  return order ? findSeller(order.sellerId).companyName : '未知卖家';
}

function getOverview(): MarketOverview {
  const liveListings = state.listings.filter((listing) => listing.status === 'live').length;
  const verifiedSellers = state.sellers.filter((seller) => seller.verified).length;
  const averageLeadTimeDays =
    state.sellers.reduce((sum, seller) => sum + seller.leadTimeDays, 0) / state.sellers.length;

  return {
    liveListings,
    verifiedSellers,
    openInquiries: state.inquiries.filter((inquiry) => inquiry.status !== 'closed').length,
    escrowCoverageRate: 0.86,
    hotBrands: ['CATL', 'BYD', 'EVE'],
    averageLeadTimeDays: Number(averageLeadTimeDays.toFixed(1)),
  };
}

function getListings(params: URLSearchParams) {
  const brand = params.get('brand')?.trim().toLowerCase();
  const city = params.get('city')?.trim().toLowerCase();
  const chemistry = params.get('chemistry')?.trim().toLowerCase();
  const grade = params.get('grade')?.trim().toLowerCase();
  const sellerId = params.get('sellerId')?.trim();

  return clone(
    state.listings.filter((listing) => {
      if (brand && listing.brand.toLowerCase() !== brand) return false;
      if (city && listing.locationCity.toLowerCase() !== city) return false;
      if (chemistry && listing.chemistry.toLowerCase() !== chemistry) return false;
      if (grade && listing.grade.toLowerCase() !== grade) return false;
      if (sellerId && listing.sellerId !== sellerId) return false;
      return listing.status === 'live';
    }),
  );
}

function getListingDetail(id: string): BatteryListingDetail {
  const listing = findListing(id);
  const sellerProfile = findSeller(listing.sellerId);
  const priceAssessment = buildPriceAssessment(listing);
  const recommendedTradeStructure = buildTradeStructure(listing, sellerProfile);
  const riskFlags = buildListingRiskFlags(listing, sellerProfile);

  return clone({
    listing,
    sellerProfile,
    inspectionRecords: [listing.inspection],
    buyabilityReport: {
      score: scoreListing(listing, sellerProfile),
      verdict: listing.grade === 'a' ? '值得优先沟通' : '可谈，但需调整交易结构',
      reasons: [
        `${listing.inspection.labName} 已提供抽检结果`,
        `卖家履约分 ${sellerProfile.fulfillmentScore}`,
        priceAssessment.comment,
      ],
      risks: riskFlags.map((flag) => flag.note),
      suggestedActions: [
        `建议按 ${recommendedTradeStructure.paymentScheme} 推进`,
        recommendedTradeStructure.requiresInspection ? '建议锁货后先完成第三方复检' : '可直接推进托管流程',
      ],
    },
    priceAssessment,
    riskFlags,
    recommendedTradeStructure,
    similarListings: state.listings
      .filter((entry) => entry.id !== listing.id && entry.chemistry === listing.chemistry)
      .slice(0, 2),
  });
}

function getTradeOrders() {
  return clone(state.tradeOrders).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getTradeOrderDetail(id: string): TradeOrderDetail {
  const order = state.tradeOrders.find((entry) => entry.id === id);
  if (!order) throw new MockBatteryExchangeError(404, `trade order ${id} not found`);

  const listing = findListing(order.listingId);
  const seller = findSeller(order.sellerId);

  return clone({
    id: order.id,
    status: order.status,
    listingTitle: listing.title,
    buyerCompanyName: order.buyerCompany,
    sellerCompanyName: seller.companyName,
    quantity: order.quantity,
    unitPriceCny: Number((order.totalAmountCny / order.quantity).toFixed(2)),
    totalAmountCny: order.totalAmountCny,
    escrowRatio: order.escrowRatio,
    paymentScheme:
      order.escrowRatio === 0.3 ? '30% 托管定金 + 验货后放款' : '40% 托管定金 + 到仓复检后放款',
    timeline: buildTradeTimeline(order),
    riskFlags: order.riskFlags,
  });
}

function getInquiries() {
  return clone(state.inquiries).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function createInquiry(input: CreateInquiryInput) {
  const listing = findListing(input.listingId);
  const buyerCompany = input.buyerCompany.trim();
  const message = input.message.trim();

  if (!buyerCompany || !message) {
    throw new MockBatteryExchangeError(400, 'buyerCompany and message are required');
  }

  const inquiry: Inquiry = {
    id: `inq-${state.inquiries.length + 1}`,
    listingId: listing.id,
    buyerCompany,
    message,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  state.inquiries.unshift(inquiry);
  return clone(inquiry);
}

function createTradeOrder(input: CreateTradeOrderInput) {
  const listing = findListing(input.listingId);
  const buyerCompany = input.buyerCompany.trim();
  const quantity = Number(input.quantity);

  if (!buyerCompany) throw new MockBatteryExchangeError(400, 'buyerCompany is required');
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new MockBatteryExchangeError(400, 'quantity must be a positive integer');
  }
  if (quantity % listing.lotSize !== 0) {
    throw new MockBatteryExchangeError(400, `quantity must follow lot size ${listing.lotSize}`);
  }
  if (quantity > listing.availableQuantity) {
    throw new MockBatteryExchangeError(400, 'quantity exceeds available stock');
  }

  const seller = findSeller(listing.sellerId);
  const riskFlags = [];
  if (seller.assuranceTier !== 'escrow-plus') {
    riskFlags.push({
      id: `risk-${Date.now()}-assurance`,
      type: 'manual_review',
      severity: 'medium' as const,
      note: '非 Escrow Plus 卖家，平台需人工复核验货节点。',
    });
  }
  if (listing.grade !== 'a') {
    riskFlags.push({
      id: `risk-${Date.now()}-grade`,
      type: 'grade_variance',
      severity: listing.grade === 'a-' ? ('low' as const) : ('high' as const),
      note: '非 A 级标准货源，建议复核批次与一致性。',
    });
  }

  const tradeOrder: TradeOrder = {
    id: `trade-${state.tradeOrders.length + 1}`,
    listingId: listing.id,
    buyerCompany,
    sellerId: listing.sellerId,
    quantity,
    totalAmountCny: quantity * listing.priceCny,
    escrowRatio: seller.assuranceTier === 'escrow-plus' ? 0.3 : 0.4,
    status: riskFlags.length > 0 ? 'awaiting_inspection' : 'awaiting_escrow',
    createdAt: new Date().toISOString(),
    riskFlags,
  };

  listing.availableQuantity -= quantity;
  if (listing.availableQuantity === 0) {
    listing.status = 'sold';
  } else if (listing.availableQuantity < listing.lotSize) {
    listing.status = 'reserved';
  }

  state.tradeOrders.unshift(tradeOrder);
  return clone(tradeOrder);
}

function createOperatorAction(input: CreateOperatorActionInput) {
  const entityId = input.entityId.trim();
  const actionLabel = input.actionLabel.trim() as OperatorActionLabel;
  const actorName = input.actorName.trim();
  const note = input.note?.trim() ?? '';
  const sourceReason = input.sourceReason.trim();

  if (!entityId || !actionLabel || !actorName || !sourceReason) {
    throw new MockBatteryExchangeError(400, 'entityId, actionLabel, actorName, and sourceReason are required');
  }

  if (input.entityType === 'listing') {
    findListing(entityId);
  } else if (!state.tradeOrders.find((entry) => entry.id === entityId)) {
    throw new MockBatteryExchangeError(404, `trade order ${entityId} not found`);
  }

  const result =
    input.entityType === 'listing'
      ? actionLabel === '转人工审核'
        ? '已转入人工审核队列'
        : actionLabel === '联系卖家补件'
          ? '已通知卖家补齐资料'
          : '已标记待补资料'
      : actionLabel === '升级争议处理'
        ? '已升级到争议仲裁'
        : '已通知跟进人催办';

  const action: OperatorActionLog = {
    id: `op-${state.operatorActions.length + 1}`,
    entityType: input.entityType,
    entityId,
    actionLabel,
    actorName,
    note,
    sourceReason,
    result,
    createdAt: new Date().toISOString(),
  };

  state.operatorActions.unshift(action);
  return clone(action);
}

function getOperatorActions(params: URLSearchParams): OperatorActionPage {
  const entityType = params.get('entityType')?.trim();
  const actionLabel = params.get('actionLabel')?.trim();
  const actorName = params.get('actorName')?.trim();
  const sellerName = params.get('sellerName')?.trim();
  const createdOn = params.get('createdOn')?.trim();
  const createdAfter = params.get('createdAfter')?.trim();
  const query = params.get('query')?.trim().toLowerCase();
  const sort = params.get('sort')?.trim() ?? 'recent';
  const createdAfterTime = createdAfter ? Date.parse(createdAfter) : Number.NaN;
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const pageSize = Math.max(1, Math.min(20, Number(params.get('pageSize') ?? 6)));

  const filtered = clone(state.operatorActions).filter((item) => {
    if (entityType && entityType !== 'listing' && entityType !== 'trade_order') return false;
    if (entityType && item.entityType !== entityType) return false;
    if (actionLabel && item.actionLabel !== actionLabel) return false;
    if (actorName && item.actorName !== actorName) return false;
    if (sellerName && resolveOperatorActionSellerName(item) !== sellerName) return false;
    if (createdOn && item.createdAt.slice(0, 10) !== createdOn) return false;
    if (!Number.isNaN(createdAfterTime) && Date.parse(item.createdAt) < createdAfterTime) return false;
    if (
      query &&
      !`${item.entityId} ${item.note} ${item.sourceReason} ${item.actionLabel} ${item.actorName}`
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    return true;
  });

  const summary = createEmptyOperatorActionSummary();
  summary.listingCount = filtered.filter((item) => item.entityType === 'listing').length;
  summary.tradeOrderCount = filtered.filter((item) => item.entityType === 'trade_order').length;
  summary.timeBuckets = Array.from(
    filtered.reduce((map, item) => {
      const date = item.createdAt.slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([date, count]) => ({ date, count }))
    .sort((left, right) => left.date.localeCompare(right.date));
  summary.actionTimeBuckets = Array.from(
    filtered.reduce((map, item) => {
      const date = item.createdAt.slice(0, 10);
      const key = `${date}__${item.actionLabel}`;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([key, count]) => {
      const [date, actionLabelValue] = key.split('__') as [string, OperatorActionLabel];
      return { date, actionLabel: actionLabelValue, count };
    })
    .sort((left, right) => {
      const dateDiff = left.date.localeCompare(right.date);
      if (dateDiff !== 0) return dateDiff;
      return right.count - left.count;
    });
  summary.sellerTimeBuckets = Array.from(
    filtered.reduce((map, item) => {
      const date = item.createdAt.slice(0, 10);
      const resolvedSellerName = resolveOperatorActionSellerName(item);
      const key = `${date}__${resolvedSellerName}`;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([key, count]) => {
      const [date, resolvedSellerName] = key.split('__') as [string, string];
      return { date, sellerName: resolvedSellerName, count };
    })
    .sort((left, right) => {
      const dateDiff = left.date.localeCompare(right.date);
      if (dateDiff !== 0) return dateDiff;
      return right.count - left.count;
    });
  summary.actionCounts = Array.from(
    filtered.reduce((map, item) => {
      map.set(item.actionLabel, (map.get(item.actionLabel) ?? 0) + 1);
      return map;
    }, new Map<OperatorActionLabel, number>()),
  )
    .map(([actionLabelValue, count]) => ({ actionLabel: actionLabelValue, count }))
    .sort((left, right) => right.count - left.count);
  summary.actorCounts = Array.from(
    filtered.reduce((map, item) => {
      map.set(item.actorName, (map.get(item.actorName) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([resolvedActorName, count]) => ({ actorName: resolvedActorName, count }))
    .sort((left, right) => right.count - left.count);
  summary.sellerCounts = Array.from(
    filtered.reduce((map, item) => {
      const resolvedSellerName = resolveOperatorActionSellerName(item);
      map.set(resolvedSellerName, (map.get(resolvedSellerName) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([resolvedSellerName, count]) => ({ sellerName: resolvedSellerName, count }))
    .sort((left, right) => right.count - left.count);
  summary.sellerActionCounts = Array.from(
    filtered.reduce((map, item) => {
      const resolvedSellerName = resolveOperatorActionSellerName(item);
      const key = `${resolvedSellerName}__${item.actionLabel}`;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .map(([key, count]) => {
      const [resolvedSellerName, actionLabelValue] = key.split('__') as [string, OperatorActionLabel];
      return { sellerName: resolvedSellerName, actionLabel: actionLabelValue, count };
    })
    .sort((left, right) => right.count - left.count);

  const actionCountMap = new Map(summary.actionCounts.map((item) => [item.actionLabel, item.count]));
  const actorCountMap = new Map(summary.actorCounts.map((item) => [item.actorName, item.count]));
  const sellerCountMap = new Map(summary.sellerCounts.map((item) => [item.sellerName, item.count]));

  const sorted = filtered.sort((left, right) => {
    if (sort === 'action_frequency') {
      const countDiff =
        (actionCountMap.get(right.actionLabel) ?? 0) - (actionCountMap.get(left.actionLabel) ?? 0);
      if (countDiff !== 0) return countDiff;
    } else if (sort === 'actor_frequency') {
      const countDiff = (actorCountMap.get(right.actorName) ?? 0) - (actorCountMap.get(left.actorName) ?? 0);
      if (countDiff !== 0) return countDiff;
    } else if (sort === 'seller_frequency') {
      const leftSeller = resolveOperatorActionSellerName(left);
      const rightSeller = resolveOperatorActionSellerName(right);
      const countDiff = (sellerCountMap.get(rightSeller) ?? 0) - (sellerCountMap.get(leftSeller) ?? 0);
      if (countDiff !== 0) return countDiff;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    summary,
  };
}

export async function handleMockBatteryExchange(
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; status: number }> {
  const url = new URL(`http://mock.local${path}`);
  const method = (init?.method ?? 'GET').toUpperCase();

  try {
    if (method === 'GET' && url.pathname === '/overview') {
      return { data: getOverview(), status: 200 };
    }
    if (method === 'GET' && url.pathname === '/sellers') {
      return { data: clone(state.sellers), status: 200 };
    }
    if (method === 'GET' && url.pathname === '/listings') {
      return { data: getListings(url.searchParams), status: 200 };
    }
    if (method === 'GET' && url.pathname.match(/^\/listings\/[^/]+\/detail$/)) {
      const listingId = decodeURIComponent(url.pathname.split('/')[2] ?? '');
      return { data: getListingDetail(listingId), status: 200 };
    }
    if (method === 'GET' && url.pathname === '/inquiries') {
      return { data: getInquiries(), status: 200 };
    }
    if (method === 'POST' && url.pathname === '/inquiries') {
      const body = JSON.parse(init?.body?.toString() ?? '{}') as CreateInquiryInput;
      return { data: createInquiry(body), status: 201 };
    }
    if (method === 'GET' && url.pathname === '/trade-orders') {
      return { data: getTradeOrders(), status: 200 };
    }
    if (method === 'POST' && url.pathname === '/trade-orders') {
      const body = JSON.parse(init?.body?.toString() ?? '{}') as CreateTradeOrderInput;
      return { data: createTradeOrder(body), status: 201 };
    }
    if (method === 'GET' && url.pathname.match(/^\/trade-orders\/[^/]+$/)) {
      const orderId = decodeURIComponent(url.pathname.split('/')[2] ?? '');
      return { data: getTradeOrderDetail(orderId), status: 200 };
    }
    if (method === 'GET' && url.pathname === '/operator-actions') {
      return { data: getOperatorActions(url.searchParams), status: 200 };
    }
    if (method === 'POST' && url.pathname === '/operator-actions') {
      const body = JSON.parse(init?.body?.toString() ?? '{}') as CreateOperatorActionInput;
      return { data: createOperatorAction(body), status: 200 };
    }
  } catch (error) {
    if (error instanceof MockBatteryExchangeError) {
      throw error;
    }
    throw new MockBatteryExchangeError(500, 'mock_handler_error');
  }

  throw new MockBatteryExchangeError(404, `Cannot ${method} /api/battery-exchange${path}`);
}

export { MockBatteryExchangeError };
