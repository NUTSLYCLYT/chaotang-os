import Link from 'next/link';
import type { SellerProfile } from '@/shared/battery-exchange';
import { buildSellerWorkspaceHref } from '../lib/seller-workspace-utils';
import { OperatorEmptyNotice, OperatorPanel } from './battery-exchange-operator-ui';

export function BatteryExchangeOperatorSellerWatchlistSection({
  sellerWatchlist,
}: {
  sellerWatchlist: SellerProfile[];
}) {
  return (
    <OperatorPanel eyebrow="Seller Watchlist" title="异常卖家观察">
      <div className="space-y-3">
        {sellerWatchlist.length > 0 ? (
          sellerWatchlist.slice(0, 4).map((seller) => (
            <Link
              key={seller.id}
              href={buildSellerWorkspaceHref(seller.id)}
              className="block rounded-[20px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 transition hover:border-[#7a5430]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#f6dfbc]">{seller.companyName}</div>
                  <div className="mt-1 text-xs text-[#b99876]">
                    {seller.city} · 履约分 {seller.fulfillmentScore}
                  </div>
                </div>
                <div className="text-right text-xs text-[#f0c27b]">
                  <div>投诉率 {seller.complaintRate}%</div>
                  <div>交期 {seller.leadTimeDays} 天</div>
                </div>
              </div>
              <div className="mt-3 text-xs leading-6 text-[#d9bb97]">查看该卖家的在售货盘与后续补件优先级。</div>
            </Link>
          ))
        ) : (
          <OperatorEmptyNotice text="当前卖家履约表现稳定。" />
        )}
      </div>
    </OperatorPanel>
  );
}
