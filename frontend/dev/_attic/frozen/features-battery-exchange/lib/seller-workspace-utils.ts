import type { BatteryListing, Inquiry, TradeOrder } from '@/shared/battery-exchange';

export type SellerListingFilter = 'all' | 'attention' | 'healthy';
export const DEFAULT_SELLER_ID = 'seller-1';

export function resolveSellerWorkspaceSellerId(
  sellerId?: string | string[] | null,
  fallback = DEFAULT_SELLER_ID,
) {
  const value = Array.isArray(sellerId) ? sellerId[0] : sellerId;
  return value?.trim() || fallback;
}

export function buildSellerWorkspaceHref(sellerId?: string) {
  if (!sellerId?.trim()) return '/battery-exchange/sell/listings';
  return `/battery-exchange/sell/listings?sellerId=${encodeURIComponent(sellerId)}`;
}

export function summarizeSellerWorkspace(
  listings: BatteryListing[],
  inquiries: Inquiry[],
  tradeOrders: TradeOrder[],
) {
  const listingIds = new Set(listings.map((listing) => listing.id));
  const relatedInquiries = inquiries.filter((inquiry) => listingIds.has(inquiry.listingId));
  const relatedOrders = tradeOrders.filter((order) => listingIds.has(order.listingId));

  const attentionListingCount = listings.filter(isAttentionListing).length;
  const healthyListingCount = listings.filter((listing) => !isAttentionListing(listing)).length;

  return {
    listingCount: listings.length,
    attentionListingCount,
    healthyListingCount,
    inquiryCount: relatedInquiries.length,
    openInquiryCount: relatedInquiries.filter((inquiry) => inquiry.status === 'open').length,
    tradeOrderCount: relatedOrders.length,
    activeTradeOrderCount: relatedOrders.filter(
      (order) => order.status === 'awaiting_escrow' || order.status === 'awaiting_inspection',
    ).length,
  };
}

export function filterSellerListings(listings: BatteryListing[], filter: SellerListingFilter) {
  switch (filter) {
    case 'attention':
      return listings.filter(isAttentionListing);
    case 'healthy':
      return listings.filter((listing) => !isAttentionListing(listing));
    default:
      return listings;
  }
}

export function isAttentionListing(listing: BatteryListing) {
  return (
    listing.availableQuantity <= listing.lotSize * 2 ||
    listing.grade !== 'a' ||
    listing.tags.some((tag) => /复检|项目余量|样机/.test(tag))
  );
}
