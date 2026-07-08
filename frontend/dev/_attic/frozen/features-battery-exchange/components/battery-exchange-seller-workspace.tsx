'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { BatteryListing, Inquiry, SellerProfile, TradeOrder } from '@/shared/battery-exchange';
import {
  DEFAULT_SELLER_ID,
  buildSellerWorkspaceHref,
  filterSellerListings,
  summarizeSellerWorkspace,
  type SellerListingFilter,
} from '../lib/seller-workspace-utils';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data;
}
export function BatteryExchangeSellerWorkspace({
  sellerId = DEFAULT_SELLER_ID,
}: {
  sellerId?: string;
}) {
  const [listings, setListings] = useState<BatteryListing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [tradeOrders, setTradeOrders] = useState<TradeOrder[]>([]);
  const [filter, setFilter] = useState<SellerListingFilter>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [sellerListings, inquiryData, sellerData, tradeOrderData] = await Promise.all([
          readJson<BatteryListing[]>(
            `/api/battery-exchange/listings?sellerId=${encodeURIComponent(sellerId)}`,
          ),
          readJson<Inquiry[]>('/api/battery-exchange/inquiries'),
          readJson<SellerProfile[]>('/api/battery-exchange/sellers'),
          readJson<TradeOrder[]>('/api/battery-exchange/trade-orders'),
        ]);
        if (!mounted) return;
        setListings(sellerListings);
        setInquiries(inquiryData);
        setSellers(sellerData);
        setSeller(sellerData.find((item) => item.id === sellerId) ?? null);
        setTradeOrders(tradeOrderData);
        setError('');
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '卖家工作台加载失败');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sellerId]);

  const summary = useMemo(
    () => summarizeSellerWorkspace(listings, inquiries, tradeOrders),
    [listings, inquiries, tradeOrders],
  );
  const visibleListings = useMemo(() => filterSellerListings(listings, filter), [listings, filter]);

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#111111] text-[#f3ead3]">
      <div
        className="absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 15% 12%, rgba(226,114,39,0.14), transparent 24%), radial-gradient(circle at 82% 10%, rgba(244,199,91,0.12), transparent 28%), linear-gradient(180deg, #171412 0%, #111111 46%, #0b0b0b 100%)',
        }}
      />
      <div className="relative mx-auto max-w-[1480px] px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <section className="rounded-[30px] border border-[#3c2c20] bg-[#171311]/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Seller Workspace</div>
              <h1
                className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {seller ? `${seller.companyName} 货盘台。` : '我的货盘。'}
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
                {seller
                  ? `集中看 ${seller.companyName} 当前在售货盘、买家询盘和正在推进的交易节点。`
                  : '卖家侧不能只有上传入口。这里集中看自己正在卖的货、可售数量和下一步该补的资料。'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/battery-exchange/sell"
                className="rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f]"
              >
                去上传库存
              </Link>
              <Link
                href="/battery-exchange/inquiries"
                className="rounded-full border border-[#3f2e22] px-5 py-3 text-sm font-semibold text-[#d9bb97]"
              >
                看买家询盘
              </Link>
              <Link
                href="/battery-exchange/market"
                className="rounded-full border border-[#6d4d31] px-5 py-3 text-sm font-semibold text-[#f3d0a1]"
              >
                看交易台
              </Link>
            </div>
          </div>
          {seller ? (
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#edc98f]">
              <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">
                履约分 {seller.fulfillmentScore}
              </span>
              <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">
                投诉率 {seller.complaintRate}%
              </span>
              <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">
                平均交期 {seller.leadTimeDays} 天
              </span>
              <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">{seller.city}</span>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="mt-6 rounded-[22px] border border-[#7a2f2f] bg-[#2c1111] px-4 py-5 text-sm text-[#f1b2b2]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">Seller Switcher</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">切换卖家视角</h2>
            </div>
            <div className="text-sm text-[#b99876]">{sellers.length} 个卖家</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {sellers.map((item) => {
              const active = item.id === sellerId;
              return (
                <Link
                  key={item.id}
                  href={buildSellerWorkspaceHref(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    active
                      ? 'border-[#c98a49] bg-[#22170f] font-semibold text-[#f0c27b]'
                      : 'border-[#3f2e22] bg-[#14110f] text-[#d9bb97] hover:bg-[#1a1612]'
                  }`}
                >
                  {item.companyName}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="在售货盘" value={String(summary.listingCount)} note="当前卖家侧可见货盘总数" />
          <MetricCard label="待关注货盘" value={String(summary.attentionListingCount)} note="低库存、非 A 级或需复检" />
          <MetricCard label="买家询盘" value={String(summary.inquiryCount)} note={`其中 ${summary.openInquiryCount} 条待回复`} />
          <MetricCard label="活跃交易" value={String(summary.activeTradeOrderCount)} note={`累计 ${summary.tradeOrderCount} 笔相关交易`} />
        </section>

        <section className="mt-6 rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">Live Listings</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">当前在售货盘</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#d9bb97]">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                全部
              </FilterChip>
              <FilterChip active={filter === 'attention'} onClick={() => setFilter('attention')}>
                待关注
              </FilterChip>
              <FilterChip active={filter === 'healthy'} onClick={() => setFilter('healthy')}>
                稳定
              </FilterChip>
            </div>
          </div>
          <div className="mt-5 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-3">
            {visibleListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/battery-exchange/listings/${listing.id}`}
                className="block rounded-[20px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 transition hover:border-[#7a5430]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#f6dfbc]">{listing.title}</div>
                    <div className="mt-1 text-xs text-[#b99876]">
                      {listing.locationCity} · {listing.chemistry.toUpperCase()} · Grade {listing.grade.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[#f0c27b]">
                    <div>¥{listing.priceCny}</div>
                    <div>{listing.availableQuantity} 可售</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d9bb97]">
                  <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">
                    起订 {listing.lotSize}
                  </span>
                  <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">
                    {listing.inspection.summary}
                  </span>
                </div>
              </Link>
            ))}
            {visibleListings.length === 0 ? (
              <div className="rounded-[18px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 text-sm leading-7 text-[#cfb08b]">
                当前筛选下没有匹配货盘，建议切回全部视图或补新库存。
              </div>
            ) : null}
            </div>
            <div className="rounded-[22px] border border-[#3d2e22] bg-[#120f0d] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#b47d44]">Next Step</div>
              <h3 className="mt-2 text-xl font-semibold text-[#f4ead1]">今天优先做什么</h3>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#cfb08b]">
                <ActionRow
                  title="先补待关注货盘资料"
                  body={`当前有 ${summary.attentionListingCount} 条货盘需要补批次照片、复检或库存说明。`}
                />
                <ActionRow
                  title="先回买家询盘"
                  body={`当前有 ${summary.openInquiryCount} 条询盘待回复，优先把能锁货的单推进到担保交易。`}
                />
                <ActionRow
                  title="盯活跃交易节点"
                  body={`当前有 ${summary.activeTradeOrderCount} 笔交易在托管或验货阶段，适合回运营台协同推进。`}
                />
                <Link
                  href={buildSellerWorkspaceHref(sellerId)}
                  className="inline-flex rounded-full border border-[#6d4d31] px-4 py-2 text-sm text-[#f3d0a1] transition hover:bg-[#201710]"
                >
                  固定查看这个卖家
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[22px] border border-[#32261d] bg-[#15110f] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#a97f52]">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-[#f2dfc3]">{value}</div>
      <div className="mt-2 text-xs leading-6 text-[#bb9d78]">{note}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 transition ${
        active
          ? 'border-[#c98a49] bg-[#22170f] text-[#f0c27b]'
          : 'border-[#3f2e22] bg-[#14110f] text-[#d9bb97]'
      }`}
    >
      {children}
    </button>
  );
}

function ActionRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-[#3d2e22] bg-[#17110f] px-4 py-4">
      <div className="text-sm font-semibold text-[#f6dfbc]">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[#cfb08b]">{body}</div>
    </div>
  );
}
