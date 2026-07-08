'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BatteryListing, MarketOverview } from '@/shared/battery-exchange';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload.data;
}

export function BatteryExchangeLanding() {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [featuredListings, setFeaturedListings] = useState<BatteryListing[]>([]);
  const featuredDetailHref = featuredListings[0]
    ? `/battery-exchange/listings/${featuredListings[0].id}`
    : '/battery-exchange/market';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [overviewData, listings] = await Promise.all([
          readJson<MarketOverview>('/api/battery-exchange/overview'),
          readJson<BatteryListing[]>('/api/battery-exchange/listings'),
        ]);
        if (!mounted) return;
        setOverview(overviewData);
        setFeaturedListings(listings.slice(0, 4));
      } catch {
        if (!mounted) return;
        setFeaturedListings([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#111111] text-[#f3ead3]">
      <div
        className="absolute inset-0 opacity-80"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, rgba(214,126,52,0.18), transparent 24%), radial-gradient(circle at 80% 14%, rgba(244,199,91,0.12), transparent 30%), linear-gradient(180deg, #161210 0%, #111111 48%, #0a0a0a 100%)',
        }}
      />
      <div className="relative mx-auto flex max-w-[1480px] flex-col gap-8 px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[34px] border border-[#4c3928] bg-[#181311]/90 shadow-[0_30px_120px_rgba(0,0,0,0.42)]">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.95fr]">
            <div className="border-b border-[#37281e] px-6 py-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
              <div className="text-[11px] uppercase tracking-[0.35em] text-[#c18b53]">
                Trusted Battery Trading
              </div>
              <h1
                className="mt-5 max-w-4xl text-[44px] font-semibold leading-[0.9] sm:text-[64px]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                先筛真货，再谈成交。
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-8 text-[#d0b89a]">
                Battery Trade OS 把库存、检测、价格、风险和担保交易放进同一个决策界面，让电芯与模组现货交易更快、更稳、更可信。
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#edc98f]">
                {['标准化挂货', '可买性评分', '担保交易', 'Passport-ready'].map((tag) => (
                  <span key={tag} className="rounded-full border border-[#63472c] bg-[#241a13] px-3 py-1">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/battery-exchange/market"
                  className="rounded-full bg-[#f0b76b] px-6 py-3 text-sm font-semibold text-[#20160f]"
                >
                  进入现货交易台
                </Link>
                <Link
                  href="/battery-exchange/sell"
                  className="rounded-full border border-[#6d4d31] px-6 py-3 text-sm font-semibold text-[#f3d0a1]"
                >
                  我要上传库存
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#b99876]">
                <Link href={featuredDetailHref} className="hover:text-[#f0c27b]">
                  查看精选货盘
                </Link>
                <Link href="/battery-exchange/operators" className="hover:text-[#f0c27b]">
                  进入风控与处置台
                </Link>
              </div>
            </div>

            <div className="px-6 py-8 lg:px-8 lg:py-10">
              <div className="rounded-[30px] border border-[#5b432f] bg-[linear-gradient(180deg,rgba(56,39,26,0.96),rgba(31,22,16,0.98))] p-5">
                <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.28em] text-[#c7955d]">
                  <span>Deal Control Tower</span>
                  <span>Live</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MetricCard label="在线货盘" value={overview ? String(overview.liveListings) : '...'} note="实时可售库存" />
                  <MetricCard
                    label="担保覆盖率"
                    value={overview ? `${Math.round(overview.escrowCoverageRate * 100)}%` : '...'}
                    note="托管节点默认开启"
                  />
                  <MetricCard label="认证卖家" value={overview ? String(overview.verifiedSellers) : '...'} note="带履约分与投诉率" />
                  <MetricCard
                    label="平均交期"
                    value={overview ? `${overview.averageLeadTimeDays} 天` : '...'}
                    note="适合现货快速锁单"
                  />
                </div>
                <div className="mt-5 rounded-[22px] border border-[#684a2c] bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#c18b53]">
                    平台不是展示货，而是推进成交
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-[#e4cfb4]">
                    <WorkflowStep title="上传库存" body="Excel、PDF、图片和聊天记录自动解析。" />
                    <WorkflowStep title="标准化货盘" body="参数统一、缺失补齐、风险标注。" />
                    <WorkflowStep title="买家决策" body="价格、检测、履约、风险一次看清。" />
                    <WorkflowStep title="担保成交" body="托管、验货、放款、争议全链路管理。" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">世界级交易，不靠感觉</div>
            <div className="mt-4 grid gap-3">
              <CapabilityCard title="3 分钟生成标准货盘" body="把碎片化库存变成真正能交易的资产，而不是继续散在聊天记录和附件里。" />
              <CapabilityCard title="一眼看懂可买性" body="风险不只打标签，还解释为什么，让采购能更快做决定。" />
              <CapabilityCard title="平台建议成交结构" body="自动建议托管比例、验货节点和付款方式，减少扯皮和跑单。" />
            </div>
            <Link
              href="/battery-exchange/sell"
              className="mt-5 inline-flex rounded-full border border-[#6d4d31] px-4 py-2 text-sm text-[#f3d0a1] transition hover:bg-[#201710]"
            >
              去卖家挂货台
            </Link>
          </div>

          <div className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">今天最值得看的现货</div>
                <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">精选货盘</h2>
              </div>
              <Link href="/battery-exchange/market" className="text-sm text-[#f0c27b]">
                进入交易台
              </Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {featuredListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/battery-exchange/listings/${listing.id}`}
                  className="rounded-[24px] border border-[#322922] bg-[#141210] p-4 transition hover:border-[#7a5430]"
                >
                  <div className="flex items-start justify-between gap-3">
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
                    <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">{listing.chemistry.toUpperCase()}</span>
                    <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">起订 {listing.lotSize}</span>
                    <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">{listing.inspection.summary}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[20px] border border-[#735233] bg-black/20 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#ba8a58]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#f7dfbb]">{value}</div>
      <div className="mt-1 text-xs text-[#b79877]">{note}</div>
    </div>
  );
}

function WorkflowStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[18px] border border-[#5e442d] bg-[#16100d] px-4 py-3">
      <div className="text-sm font-semibold text-[#f2ddbc]">{title}</div>
      <div className="mt-1 text-sm leading-6 text-[#c9ae8d]">{body}</div>
    </div>
  );
}

function CapabilityCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-[#3b2c21] bg-[#100f0d] p-4">
      <div className="text-lg font-semibold text-[#f6dfbc]">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[#cfb08b]">{body}</div>
    </div>
  );
}
