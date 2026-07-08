import Link from 'next/link';
import type { BatteryListing, SellerProfile } from '@/shared/battery-exchange';
import {
  OperatorBadge,
  OperatorEmptyNotice,
  OperatorFilterChip,
  OperatorFilterSelect,
  OperatorPanel,
} from './battery-exchange-operator-ui';

export function BatteryExchangeOperatorReviewSection({
  listingFilter,
  onListingFilterChange,
  reviewSellerId,
  onReviewSellerChange,
  reviewCity,
  onReviewCityChange,
  sellers,
  reviewCities,
  visibleReviewListings,
  sellerMap,
}: {
  listingFilter: 'all' | 'attention' | 'high_risk';
  onListingFilterChange: (value: 'all' | 'attention' | 'high_risk') => void;
  reviewSellerId: string;
  onReviewSellerChange: (value: string) => void;
  reviewCity: string;
  onReviewCityChange: (value: string) => void;
  sellers: SellerProfile[];
  reviewCities: string[];
  visibleReviewListings: BatteryListing[];
  sellerMap: Map<string, SellerProfile>;
}) {
  return (
    <OperatorPanel eyebrow="Listing Review" title="待审核货盘">
      <div className="mb-4 flex flex-wrap gap-2 text-xs text-[#d9bb97]">
        <OperatorFilterChip active={listingFilter === 'all'} onClick={() => onListingFilterChange('all')}>
          全部
        </OperatorFilterChip>
        <OperatorFilterChip active={listingFilter === 'attention'} onClick={() => onListingFilterChange('attention')}>
          待关注
        </OperatorFilterChip>
        <OperatorFilterChip active={listingFilter === 'high_risk'} onClick={() => onListingFilterChange('high_risk')}>
          高风险
        </OperatorFilterChip>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <OperatorFilterSelect
          label="卖家主体"
          value={reviewSellerId}
          onChange={onReviewSellerChange}
          options={[
            { value: 'all', label: '全部卖家' },
            ...sellers.map((seller) => ({ value: seller.id, label: seller.companyName })),
          ]}
        />
        <OperatorFilterSelect
          label="库存城市"
          value={reviewCity}
          onChange={onReviewCityChange}
          options={[
            { value: 'all', label: '全部城市' },
            ...reviewCities.map((city) => ({ value: city, label: city })),
          ]}
        />
      </div>
      <div className="space-y-3">
        {visibleReviewListings.length > 0 ? (
          visibleReviewListings.slice(0, 4).map((listing) => {
            const seller = sellerMap.get(listing.sellerId);
            return (
              <Link
                key={listing.id}
                href={`/battery-exchange/listings/${listing.id}`}
                className="block rounded-[20px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 transition hover:border-[#7a5430]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#f6dfbc]">{listing.title}</div>
                    <div className="mt-1 text-xs text-[#b99876]">
                      {listing.locationCity} · {listing.grade.toUpperCase()} · {listing.availableQuantity} 可售
                    </div>
                  </div>
                  <div className="text-right text-xs text-[#f0c27b]">
                    <div>¥{listing.priceCny}</div>
                    <div>{seller?.companyName ?? '未知卖家'}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d9bb97]">
                  {listing.tags.slice(0, 3).map((tag) => (
                    <OperatorBadge key={tag}>{tag}</OperatorBadge>
                  ))}
                </div>
              </Link>
            );
          })
        ) : (
          <OperatorEmptyNotice text="当前没有新增待审核货盘。" />
        )}
      </div>
    </OperatorPanel>
  );
}
