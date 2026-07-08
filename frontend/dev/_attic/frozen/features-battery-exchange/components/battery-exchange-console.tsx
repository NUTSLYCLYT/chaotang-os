'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react';
import type {
  BatteryListing,
  CreateInquiryInput,
  CreateTradeOrderInput,
  MarketOverview,
  SellerProfile,
  TradeOrder,
} from '@/shared/battery-exchange';
import {
  applyListingFilters,
  formatAssuranceTier,
  getSuggestedOrderQuantity,
  summarizeEscrowQueue,
  validateTradeOrderInput,
} from '../lib/market-utils';

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload.data;
}

export function BatteryExchangeConsole() {
  const router = useRouter();
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [listings, setListings] = useState<BatteryListing[]>([]);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [tradeOrders, setTradeOrders] = useState<TradeOrder[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState('');
  const [chemistry, setChemistry] = useState('');
  const [city, setCity] = useState('');
  const [grade, setGrade] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('上海峰谷储能系统');
  const [inquiryMessage, setInquiryMessage] = useState('询 320 颗现货，要求同批次并支持担保交易。');
  const [orderQuantity, setOrderQuantity] = useState('320');
  const [feedback, setFeedback] = useState('');
  const [pendingAction, setPendingAction] = useState<'inquiry' | 'trade' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
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
        setSelectedListingId((current) => current || listingData[0]?.id || '');
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const deferredSearch = useDeferredValue(search);
  const filteredListings = useMemo(
    () => applyListingFilters(listings, { search: deferredSearch, chemistry, city, grade }),
    [listings, deferredSearch, chemistry, city, grade],
  );
  const selectedListing =
    filteredListings.find((listing) => listing.id === selectedListingId) ?? filteredListings[0] ?? null;
  const sellerMap = useMemo(
    () => new Map(sellers.map((seller) => [seller.id, seller])),
    [sellers],
  );
  const queueSummary = useMemo(() => summarizeEscrowQueue(tradeOrders), [tradeOrders]);
  const cities = useMemo(
    () => Array.from(new Set(listings.map((listing) => listing.locationCity))),
    [listings],
  );
  const inquiryDisabledReason = !selectedListing
    ? '请先选择货源'
    : !buyerCompany.trim()
      ? '请先填写买方公司'
      : !inquiryMessage.trim()
        ? '请先填写询盘说明'
        : null;
  const tradeDisabledReason = useMemo(
    () => validateTradeOrderInput(selectedListing, buyerCompany, orderQuantity),
    [selectedListing, buyerCompany, orderQuantity],
  );

  useEffect(() => {
    if (selectedListing || filteredListings.length === 0) return;
    setSelectedListingId(filteredListings[0]?.id ?? '');
  }, [filteredListings, selectedListing]);

  useEffect(() => {
    if (!selectedListing) return;
    setOrderQuantity((current) => {
      const nextSuggested = getSuggestedOrderQuantity(selectedListing);
      if (!current) return nextSuggested;
      return validateTradeOrderInput(selectedListing, buyerCompany, current) ? nextSuggested : current;
    });
  }, [selectedListing, buyerCompany]);

  function submitInquiry() {
    if (inquiryDisabledReason) {
      setFeedback(inquiryDisabledReason);
      return;
    }
    const activeListing = selectedListing;
    if (!activeListing) return;
    setFeedback('');
    setPendingAction('inquiry');
    startTransition(async () => {
      try {
        const payload: CreateInquiryInput = {
          listingId: activeListing.id,
          buyerCompany,
          message: inquiryMessage,
        };
        await readJson('/api/battery-exchange/inquiries', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setOverview((current) =>
          current
            ? {
                ...current,
                openInquiries: current.openInquiries + 1,
              }
            : current,
        );
        setFeedback(`询盘已发给 ${sellerMap.get(activeListing.sellerId)?.companyName ?? '卖家'}。`);
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : '询盘提交失败');
      } finally {
        setPendingAction(null);
      }
    });
  }

  function submitTradeOrder() {
    if (tradeDisabledReason) {
      setFeedback(tradeDisabledReason);
      return;
    }
    const activeListing = selectedListing;
    if (!activeListing) return;
    setFeedback('');
    setPendingAction('trade');
    startTransition(async () => {
      try {
        const payload: CreateTradeOrderInput = {
          listingId: activeListing.id,
          buyerCompany,
          quantity: Number(orderQuantity),
        };
        const order = await readJson<TradeOrder>('/api/battery-exchange/trade-orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setTradeOrders((current) => [order, ...current]);
        setListings((current) =>
          current
            .map((listing) => {
              if (listing.id !== activeListing.id) return listing;
              const nextAvailable = Math.max(0, listing.availableQuantity - order.quantity);
              const nextStatus: BatteryListing['status'] =
                nextAvailable === 0 ? 'sold' : nextAvailable < listing.lotSize ? 'reserved' : 'live';
              return {
                ...listing,
                availableQuantity: nextAvailable,
                status: nextStatus,
              };
            })
            .filter((listing) => listing.status === 'live'),
        );
        setOverview((current) =>
          current
            ? {
                ...current,
                liveListings: current.liveListings - (order.quantity === activeListing.availableQuantity ? 1 : 0),
              }
            : current,
        );
        setFeedback(`担保交易单 ${order.id} 已创建，正在进入托管与验货详情。`);
        router.push(`/battery-exchange/trade-orders/${order.id}`);
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : '交易单创建失败');
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#111111] text-[#f3ead3]">
      <div
        className="absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 12% 18%, rgba(226,114,39,0.22), transparent 24%), radial-gradient(circle at 82% 12%, rgba(244,199,91,0.16), transparent 28%), linear-gradient(180deg, #171412 0%, #111111 48%, #0c0c0c 100%)',
        }}
      />
      <div className="relative mx-auto flex max-w-[1480px] flex-col gap-8 px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-[#4a3825] bg-[#181412]/90 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.95fr]">
            <div className="border-b border-[#3d2c1f] px-6 py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-[#c1894f]">
                <span>Battery Exchange</span>
                <span className="rounded-full border border-[#6d4a2c] px-3 py-1 text-[#f4cf9d]">
                  Domestic Spot + Escrow
                </span>
              </div>
              <h1
                className="mt-5 max-w-4xl text-[42px] font-semibold leading-[0.92] sm:text-[56px]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                先把真货筛出来，再把交易托住。
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#d0b89a]">
                面向国内动力电池电芯与模组现货。第一版不做黄页，不做重仓配，只做三件事：结构化挂货、可信筛选、担保交易。
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <Link
                  href="/battery-exchange/sell"
                  className="inline-flex rounded-full border border-[#6d4d31] px-4 py-2 text-sm text-[#f3d0a1] transition hover:bg-[#201710]"
                >
                  我是卖家，去挂货
                </Link>
                <Link
                  href="/battery-exchange/inquiries"
                  className="inline-flex rounded-full border border-[#3f2e22] px-4 py-2 text-[#d9bb97] transition hover:bg-[#1a1612]"
                >
                  去询盘中心
                </Link>
                <Link
                  href="/battery-exchange/trade-orders"
                  className="inline-flex rounded-full border border-[#3f2e22] px-4 py-2 text-[#d9bb97] transition hover:bg-[#1a1612]"
                >
                  去交易单列表
                </Link>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="在线货盘"
                  value={overview ? String(overview.liveListings) : '...'}
                  note="精选可验货库存"
                />
                <StatCard
                  label="认证卖家"
                  value={overview ? String(overview.verifiedSellers) : '...'}
                  note="带履约分与投诉率"
                />
                <StatCard
                  label="担保覆盖率"
                  value={overview ? `${Math.round((overview.escrowCoverageRate ?? 0) * 100)}%` : '...'}
                  note="托管节点默认开启"
                />
              </div>
            </div>

            <div className="px-6 py-8 lg:px-8 lg:py-10">
              <div className="rounded-[28px] border border-[#5b432f] bg-[linear-gradient(180deg,rgba(56,39,26,0.96),rgba(31,22,16,0.98))] p-5">
                <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.28em] text-[#c7955d]">
                  <span>Escrow Control Tower</span>
                  <span>{tradeOrders.length} orders</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniMetric label="托管金额" value={`¥${formatAmount(queueSummary.totalAmountCny)}`} />
                  <MiniMetric label="待验货" value={String(queueSummary.inspectionCount)} />
                  <MiniMetric label="高风险" value={String(queueSummary.highRiskCount)} />
                </div>
                <div className="mt-5 space-y-3">
                  {tradeOrders.slice(0, 3).map((order) => (
                    <Link
                      key={order.id}
                      href={`/battery-exchange/trade-orders/${order.id}`}
                      className="block rounded-[20px] border border-[#6b4b2b] bg-black/20 px-4 py-3 transition hover:border-[#c98a49]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#f7e4c7]">{order.buyerCompany}</div>
                          <div className="text-xs text-[#bb9b79]">
                            {order.id} · {order.quantity} 件 · {formatTradeStatus(order.status)}
                          </div>
                        </div>
                        <div className="text-right text-sm text-[#f0c27b]">
                          ¥{formatAmount(order.totalAmountCny)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-[#2f2823] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">筛货台</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">现货筛选与横向比价</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="品牌 / 型号 / 标签"
                  className="rounded-full border border-[#3b312a] bg-[#0f0f0e] px-4 py-2 text-sm outline-none placeholder:text-[#7f6b57]"
                />
                <Select value={chemistry} onChange={setChemistry} options={['lfp', 'ncm', 'lto']} label="体系" />
                <Select value={city} onChange={setCity} options={cities} label="城市" />
                <Select value={grade} onChange={setGrade} options={['a', 'a-', 'b+']} label="等级" />
              </div>
            </div>

            {loading ? <EmptyState text="加载货盘中..." /> : null}
            {error ? <EmptyState text={error} tone="danger" /> : null}
            {!loading && !error ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  {filteredListings.map((listing) => {
                    const seller = sellerMap.get(listing.sellerId);
                    const active = selectedListing?.id === listing.id;
                    return (
                      <article
                        key={listing.id}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          active
                            ? 'border-[#d18a47] bg-[#251a12]'
                            : 'border-[#322922] bg-[#141210] hover:border-[#7a5430]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedListingId(listing.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-lg font-semibold text-[#f6e7cb]">{listing.title}</div>
                              <div className="mt-1 text-sm text-[#c8ad8d]">
                                {listing.brand} · {listing.model} · {listing.locationCity}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-semibold text-[#f0c27b]">¥{listing.priceCny}</div>
                              <div className="text-xs text-[#a98866]">/{listing.unit === 'cells' ? '颗' : '组'}</div>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#e1c09c]">
                            <Badge>{listing.chemistry.toUpperCase()}</Badge>
                            <Badge>Grade {listing.grade.toUpperCase()}</Badge>
                            <Badge>{listing.availableQuantity} 可售</Badge>
                            <Badge>起订 {listing.lotSize}</Badge>
                            {seller ? <Badge>{formatAssuranceTier(seller.assuranceTier)}</Badge> : null}
                          </div>
                        </button>
                        <div className="mt-4">
                          <Link
                            href={`/battery-exchange/listings/${listing.id}`}
                            className="inline-flex rounded-full border border-[#6d4d31] px-3 py-1.5 text-xs text-[#f3d0a1] transition hover:bg-[#201710]"
                          >
                            查看详情
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                  {filteredListings.length === 0 ? <EmptyState text="没有符合条件的货源。" /> : null}
                </div>

                <div className="rounded-[26px] border border-[#3a2b20] bg-[linear-gradient(180deg,#171412,#100f0e)] p-5">
                  {selectedListing ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.28em] text-[#b98249]">
                            货源详情
                          </div>
                          <h3 className="mt-2 text-2xl font-semibold text-[#f5e6ca]">
                            {selectedListing.brand} {selectedListing.model}
                          </h3>
                        </div>
                        <div className="rounded-full border border-[#684a2c] px-3 py-1 text-xs text-[#f3c98a]">
                          {selectedListing.locationCity}
                        </div>
                      </div>

                      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-[#ceb08d]">
                        <Spec label="标称容量" value={`${selectedListing.nominalCapacityAh}Ah`} />
                        <Spec label="电压" value={`${selectedListing.voltageV}V`} />
                        <Spec label="循环次数" value={String(selectedListing.cycleCount)} />
                        <Spec label="抽检样本" value={`${selectedListing.inspection.sampleSize} 件`} />
                        <Spec label="容量保持率" value={`${selectedListing.inspection.capacityRetention}%`} />
                        <Spec label="DCIR" value={`${selectedListing.inspection.dcirMilliohm}mΩ`} />
                      </dl>

                      <div className="mt-5 rounded-[22px] border border-[#433121] bg-[#191512] p-4">
                        <div className="text-[11px] uppercase tracking-[0.28em] text-[#be8c58]">
                          检测与信任
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#dbc4a6]">
                          {selectedListing.inspection.labName} · {selectedListing.inspection.summary}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#f0cf9c]">
                          {selectedListing.tags.map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                          ))}
                        </div>
                      </div>

                      {sellerMap.get(selectedListing.sellerId) ? (
                        <SellerPanel seller={sellerMap.get(selectedListing.sellerId)!} />
                      ) : null}

                      <div className="mt-5">
                        <Link
                          href={`/battery-exchange/listings/${selectedListing.id}`}
                          className="inline-flex rounded-full border border-[#6d4d31] px-4 py-2 text-sm text-[#f3d0a1] transition hover:bg-[#201710]"
                        >
                          进入完整货源详情
                        </Link>
                      </div>
                    </>
                  ) : (
                    <EmptyState text="选择一个货源查看细节。" />
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">交易动作</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">询盘与担保交易</h2>
              <div className="mt-5 space-y-4">
                <Field
                  label="买方公司"
                  value={buyerCompany}
                  onChange={setBuyerCompany}
                  placeholder="填写采购主体"
                />
                <Field
                  label="询盘说明"
                  value={inquiryMessage}
                  onChange={setInquiryMessage}
                  placeholder="例如：要求同批次、支持复检、到仓价"
                />
                <Field
                  label="下单数量"
                  value={orderQuantity}
                  onChange={setOrderQuantity}
                  placeholder="320"
                />
                {selectedListing ? (
                  <div className="text-xs leading-6 text-[#aa8a68]">
                    当前货源剩余 {selectedListing.availableQuantity} {selectedListing.unit === 'cells' ? '颗' : '组'}
                    ，按 {selectedListing.lotSize} {selectedListing.unit === 'cells' ? '颗' : '组'} 为一档起订。
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={submitInquiry}
                  disabled={Boolean(inquiryDisabledReason) || isPending}
                  className="rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f] disabled:opacity-50"
                >
                  {pendingAction === 'inquiry' ? '提交询盘中...' : '发起询盘'}
                </button>
                <button
                  type="button"
                  onClick={submitTradeOrder}
                  disabled={Boolean(tradeDisabledReason) || isPending}
                  className="rounded-full border border-[#6d4d31] bg-transparent px-5 py-3 text-sm font-semibold text-[#f3d0a1] disabled:opacity-50"
                >
                  {pendingAction === 'trade' ? '创建交易单中...' : '创建担保交易单'}
                </button>
              </div>
              {inquiryDisabledReason ? (
                <div className="mt-3 text-xs leading-6 text-[#b9956e]">{inquiryDisabledReason}</div>
              ) : null}
              {tradeDisabledReason ? (
                <div className="mt-3 text-xs leading-6 text-[#b9956e]">{tradeDisabledReason}</div>
              ) : null}
              <div className="mt-4 min-h-6 text-sm text-[#d4b18a]">{feedback}</div>
            </section>

            <section className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">MVP 边界</div>
              <div className="mt-4 grid gap-3">
                <BoundaryCard
                  title="平台做"
                  points={['卖家认证与履约分', '标准化挂货与检测摘要', '托管定金与验货节点']}
                />
                <BoundaryCard
                  title="平台暂不做"
                  points={['自营囤货', '跨境出口', '复杂授信金融']}
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[24px] border border-[#473322] bg-[#130f0d] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[#a57645]">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-[#f4e2c2]">{value}</div>
      <div className="mt-1 text-sm text-[#af8f70]">{note}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#735233] bg-black/25 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#ba8a58]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[#f7dfbb]">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">
      {children}
    </span>
  );
}

function SellerPanel({ seller }: { seller: SellerProfile }) {
  return (
    <div className="mt-5 rounded-[22px] border border-[#433121] bg-[#191512] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#be8c58]">卖家画像</div>
          <div className="mt-2 text-lg font-semibold text-[#f6e1bf]">{seller.companyName}</div>
        </div>
        <Badge>{formatAssuranceTier(seller.assuranceTier)}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#d4b693]">
        <Spec label="履约分" value={`${seller.fulfillmentScore}`} />
        <Spec label="投诉率" value={`${seller.complaintRate}%`} />
        <Spec label="月供给能力" value={`${seller.monthlyCapacityKwh} kWh`} />
        <Spec label="平均交期" value={`${seller.leadTimeDays} 天`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#edc98f]">
        {seller.specialties.map((specialty) => (
          <Badge key={specialty}>{specialty}</Badge>
        ))}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#32261d] bg-black/15 px-3 py-3">
      <dt className="text-[11px] uppercase tracking-[0.22em] text-[#9e7c5a]">{label}</dt>
      <dd className="mt-1 text-base font-medium text-[#f1dec2]">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#d9bc99]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[18px] border border-[#3b312a] bg-[#0f0f0e] px-4 py-3 text-sm outline-none placeholder:text-[#7f6b57]"
      />
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-[#9f7d5c]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-full border border-[#3b312a] bg-[#0f0f0e] px-4 py-2 text-sm outline-none"
      >
        <option value="">全部</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) {
  return (
    <div
      className={`mt-5 rounded-[22px] border px-4 py-5 text-sm ${
        tone === 'danger'
          ? 'border-[#7a2f2f] bg-[#2c1111] text-[#f1b2b2]'
          : 'border-[#342921] bg-[#171311] text-[#c6aa89]'
      }`}
    >
      {text}
    </div>
  );
}

function BoundaryCard({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="rounded-[22px] border border-[#3b2c21] bg-[#100f0d] p-4">
      <div className="text-lg font-semibold text-[#f6dfbc]">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-[#cfb08b]">
        {points.map((point) => (
          <div key={point}>{point}</div>
        ))}
      </div>
    </div>
  );
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatTradeStatus(status: TradeOrder['status']) {
  switch (status) {
    case 'awaiting_escrow':
      return '待托管';
    case 'awaiting_inspection':
      return '待验货';
    case 'ready_to_release':
      return '待放款';
    case 'in_dispute':
      return '争议中';
    default:
      return status;
  }
}
