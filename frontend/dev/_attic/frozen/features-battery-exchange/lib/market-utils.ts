import type { AssuranceTier, BatteryListing, TradeOrder } from '@/shared/battery-exchange';

export interface ListingFilters {
  search: string;
  chemistry: string;
  city: string;
  grade: string;
}

export function applyListingFilters(
  listings: BatteryListing[],
  filters: ListingFilters,
): BatteryListing[] {
  const search = filters.search.trim().toLowerCase();
  return listings.filter((listing) => {
    if (filters.chemistry && listing.chemistry !== filters.chemistry) return false;
    if (filters.city && listing.locationCity !== filters.city) return false;
    if (filters.grade && listing.grade !== filters.grade) return false;
    if (!search) return true;

    return [listing.title, listing.brand, listing.model, ...listing.tags].some((field) =>
      field.toLowerCase().includes(search),
    );
  });
}

export function summarizeEscrowQueue(tradeOrders: TradeOrder[]) {
  return tradeOrders.reduce(
    (acc, order) => {
      acc.totalAmountCny += order.totalAmountCny;
      if (order.status === 'awaiting_inspection') acc.inspectionCount += 1;
      if (order.status === 'awaiting_escrow') acc.escrowCount += 1;
      if (order.riskFlags.some((flag) => flag.severity === 'high')) acc.highRiskCount += 1;
      return acc;
    },
    { totalAmountCny: 0, inspectionCount: 0, escrowCount: 0, highRiskCount: 0 },
  );
}

export function validateTradeOrderInput(
  listing: BatteryListing | null,
  buyerCompany: string,
  orderQuantity: string,
) {
  if (!listing) return '请先选择货源';
  if (!buyerCompany.trim()) return '请先填写买方公司';

  const quantity = Number(orderQuantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return '下单数量必须是正整数';
  if (quantity % listing.lotSize !== 0) return `下单数量需按 ${listing.lotSize} ${listing.unit === 'cells' ? '颗' : '组'} 为一档`;
  if (quantity > listing.availableQuantity) return '下单数量已超过当前可售库存';

  return null;
}

export function formatAssuranceTier(tier: AssuranceTier) {
  switch (tier) {
    case 'escrow-plus':
      return '平台担保增强';
    case 'priority':
      return '优先履约';
    case 'verified':
      return '已核验';
    default:
      return tier;
  }
}

export function getSuggestedOrderQuantity(listing: BatteryListing | null) {
  if (!listing) return '';
  const preferredLots = listing.unit === 'cells' ? 5 : 2;
  const suggested = Math.min(listing.availableQuantity, listing.lotSize * preferredLots);

  if (suggested < listing.lotSize) {
    return String(listing.availableQuantity);
  }

  return String(suggested - (suggested % listing.lotSize || 0));
}
