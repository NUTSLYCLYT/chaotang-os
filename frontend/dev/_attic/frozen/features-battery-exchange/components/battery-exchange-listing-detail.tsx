'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type {
  BatteryListingDetail,
  CreateInquiryInput,
  CreateTradeOrderInput,
  TradeOrder,
} from '@/shared/battery-exchange';
import { buildSellerWorkspaceHref } from '../lib/seller-workspace-utils';

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

export function BatteryExchangeListingDetail({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<BatteryListingDetail | null>(null);
  const [error, setError] = useState('');
  const [buyerCompany, setBuyerCompany] = useState('上海峰谷储能系统');
  const [message, setMessage] = useState('希望先锁货 48 小时，并按平台建议进入托管与验货流程。');
  const [quantity, setQuantity] = useState('');
  const [feedback, setFeedback] = useState('');
  const [pendingAction, setPendingAction] = useState<'inquiry' | 'trade' | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await readJson<BatteryListingDetail>(
          `/api/battery-exchange/listings/${encodeURIComponent(listingId)}/detail`,
        );
        if (!mounted) return;
        setDetail(payload);
        setQuantity(String(payload.listing.lotSize));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '详情加载失败');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [listingId]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-[22px] border border-[#7a2f2f] bg-[#2c1111] px-4 py-5 text-sm text-[#f1b2b2]">
          {error}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <div className="rounded-[22px] border border-[#342921] bg-[#171311] px-4 py-5 text-sm text-[#c6aa89]">
          货盘详情加载中...
        </div>
      </div>
    );
  }

  const { listing, sellerProfile, inspectionRecords, buyabilityReport, priceAssessment, riskFlags, recommendedTradeStructure, similarListings } = detail;
  const inspection = inspectionRecords[0] ?? null;
  const inquiryDisabled = !buyerCompany.trim() || !message.trim();
  const quantityValue = Number(quantity);
  const tradeDisabled =
    !buyerCompany.trim() ||
    !Number.isInteger(quantityValue) ||
    quantityValue <= 0 ||
    quantityValue % listing.lotSize !== 0 ||
    quantityValue > listing.availableQuantity;

  function handleInquiry() {
    if (inquiryDisabled) return;
    setPendingAction('inquiry');
    setFeedback('');
    startTransition(async () => {
      try {
        const payload: CreateInquiryInput = {
          listingId: listing.id,
          buyerCompany,
          message,
        };
        await readJson('/api/battery-exchange/inquiries', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('询盘已发送给卖家，平台将继续跟进锁货与验货节点。');
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : '询盘发送失败');
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleTradeOrder() {
    if (tradeDisabled) return;
    setPendingAction('trade');
    setFeedback('');
    startTransition(async () => {
      try {
        const payload: CreateTradeOrderInput = {
          listingId: listing.id,
          buyerCompany,
          quantity: quantityValue,
        };
        const order = await readJson<TradeOrder>('/api/battery-exchange/trade-orders', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(`交易单 ${order.id} 已创建，正在跳转到托管与验货详情。`);
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
            'radial-gradient(circle at 18% 14%, rgba(226,114,39,0.18), transparent 22%), radial-gradient(circle at 78% 8%, rgba(244,199,91,0.14), transparent 28%), linear-gradient(180deg, #171412 0%, #111111 46%, #0b0b0b 100%)',
        }}
      />
      <div className="relative mx-auto max-w-[1480px] px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-3 text-sm text-[#b69a77]">
          <Link href="/battery-exchange" className="hover:text-[#f0c27b]">电池现货台</Link>
          <span>/</span>
          <Link href="/battery-exchange/market" className="hover:text-[#f0c27b]">现货交易台</Link>
          <span>/</span>
          <span className="text-[#f0c27b]">{listing.brand} {listing.model}</span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-[#3c2c20] bg-[#171311]/90 p-6">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Listing Detail</div>
              <h1 className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]" style={{ fontFamily: 'var(--font-serif)' }}>
                {listing.title}
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
                先看结论，再看证据。这个页面把价格、风险、检测、卖家履约和建议成交结构放到一起，帮助买家更快进入成交。
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#edc98f]">
                <Badge>{listing.chemistry.toUpperCase()}</Badge>
                <Badge>Grade {listing.grade.toUpperCase()}</Badge>
                <Badge>{listing.locationCity}</Badge>
                <Badge>¥{listing.priceCny}/{listing.unit === 'cells' ? '颗' : '组'}</Badge>
                <Badge>{listing.availableQuantity} 可售</Badge>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Panel title="Agent 可买性报告" eyebrow="Buyability">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#6f4d2e] bg-[#21170f] text-3xl font-semibold text-[#f0c27b]">
                    {buyabilityReport.score}
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-[#f6e3c3]">{buyabilityReport.verdict}</div>
                    <div className="mt-2 text-sm leading-6 text-[#ceb190]">{buyabilityReport.reasons.join(' · ')}</div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <BulletList title="风险提示" items={buyabilityReport.risks} />
                  <BulletList title="建议动作" items={buyabilityReport.suggestedActions} />
                </div>
              </Panel>

              <Panel title="价格判断" eyebrow="Price Assessment">
                <div className="grid gap-3 md:grid-cols-3">
                  <Spec label="参考低位" value={`¥${priceAssessment.referenceMin}`} />
                  <Spec label="当前报价" value={`¥${priceAssessment.currentPrice}`} />
                  <Spec label="参考高位" value={`¥${priceAssessment.referenceMax}`} />
                </div>
                <div className="mt-4 rounded-[18px] border border-[#4e3724] bg-[#130f0d] px-4 py-3 text-sm leading-7 text-[#d2b796]">
                  {priceAssessment.comment}
                </div>
              </Panel>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
              <Panel title="规格与批次" eyebrow="Specs Grid">
                <div className="grid grid-cols-2 gap-3 text-sm text-[#ceb08d]">
                  <Spec label="标称容量" value={`${listing.nominalCapacityAh}Ah`} />
                  <Spec label="电压" value={`${listing.voltageV}V`} />
                  <Spec label="循环次数" value={String(listing.cycleCount)} />
                  <Spec label="起订步长" value={`${listing.lotSize} ${listing.unit === 'cells' ? '颗' : '组'}`} />
                  <Spec label="标签" value={listing.tags[0] ?? '标准包装'} />
                  <Spec label="风险状态" value={riskFlags[0]?.note ?? '低风险'} />
                </div>
              </Panel>

              <Panel title="检测与一致性" eyebrow="Inspection Summary">
                {inspection ? (
                  <>
                    <div className="text-sm leading-7 text-[#dbc4a6]">
                      {inspection.labName} · {inspection.summary}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Spec label="抽检样本" value={`${inspection.sampleSize} 件`} />
                      <Spec label="容量保持率" value={`${inspection.capacityRetention}%`} />
                      <Spec label="DCIR" value={`${inspection.dcirMilliohm}mΩ`} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-[18px] border border-[#4e3724] bg-[#130f0d] px-4 py-3 text-sm leading-7 text-[#d2b796]">
                    当前货盘暂无检测记录，建议先走平台复检流程再进入放款节点。
                  </div>
                )}
              </Panel>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <Panel title="卖家履约画像" eyebrow="Seller Profile">
                <div className="text-lg font-semibold text-[#f6dfbc]">{sellerProfile.companyName}</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-[#d4b693]">
                  <Spec label="履约分" value={`${sellerProfile.fulfillmentScore}`} />
                  <Spec label="投诉率" value={`${sellerProfile.complaintRate}%`} />
                  <Spec label="月供给能力" value={`${sellerProfile.monthlyCapacityKwh} kWh`} />
                  <Spec label="平均交期" value={`${sellerProfile.leadTimeDays} 天`} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#edc98f]">
                  {sellerProfile.specialties.map((specialty) => (
                    <Badge key={specialty}>{specialty}</Badge>
                  ))}
                </div>
                <div className="mt-4">
                  <Link
                    href={buildSellerWorkspaceHref(sellerProfile.id)}
                    className="inline-flex rounded-full border border-[#6d4d31] px-4 py-2 text-sm text-[#f3d0a1] transition hover:bg-[#201710]"
                  >
                    查看该卖家货盘
                  </Link>
                </div>
              </Panel>

              <Panel title="相似货盘" eyebrow="Similar Listings">
                <div className="space-y-3">
                  {similarListings.map((item) => (
                    <Link
                      key={item.id}
                      href={`/battery-exchange/listings/${item.id}`}
                      className="block rounded-[18px] border border-[#3c2c20] bg-[#110f0d] px-4 py-3 transition hover:border-[#7a5430]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#f6e1bf]">{item.title}</div>
                          <div className="text-xs text-[#b79975]">{item.locationCity} · {item.availableQuantity} 可售</div>
                        </div>
                        <div className="text-sm text-[#f0c27b]">¥{item.priceCny}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Panel>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Panel title="交易动作" eyebrow="Action Panel">
              <div className="space-y-4">
                <Field label="买方公司" value={buyerCompany} onChange={setBuyerCompany} />
                <Field label="沟通说明" value={message} onChange={setMessage} />
                <Field label="下单数量" value={quantity} onChange={setQuantity} />
                <div className="rounded-[18px] border border-[#4b3624] bg-[#120f0d] px-4 py-3 text-sm leading-7 text-[#d1b594]">
                  平台建议：{recommendedTradeStructure.paymentScheme}
                  {recommendedTradeStructure.requiresInspection ? ' · 建议先完成第三方复检' : ''}
                </div>
                <button
                  type="button"
                  onClick={handleInquiry}
                  disabled={inquiryDisabled || isPending}
                  className="w-full rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f] disabled:opacity-50"
                >
                  {pendingAction === 'inquiry' ? '提交询盘中...' : '立即询盘'}
                </button>
                <button
                  type="button"
                  onClick={handleTradeOrder}
                  disabled={tradeDisabled || isPending}
                  className="w-full rounded-full border border-[#6d4d31] px-5 py-3 text-sm font-semibold text-[#f3d0a1] disabled:opacity-50"
                >
                  {pendingAction === 'trade' ? '创建交易单中...' : '创建担保交易'}
                </button>
                <Link href="/battery-exchange/market" className="block text-center text-sm text-[#b89a79] hover:text-[#f0c27b]">
                  返回现货交易台
                </Link>
                <div className="min-h-6 text-sm text-[#d4b18a]">{feedback}</div>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
      <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#32261d] bg-black/15 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#9e7c5a]">{label}</div>
      <div className="mt-1 text-base font-medium text-[#f1dec2]">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">{children}</span>;
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[18px] border border-[#3f2e22] bg-[#120f0d] px-4 py-4">
      <div className="text-sm font-semibold text-[#f6dfbc]">{title}</div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-[#cfb08b]">
        {items.map((item) => (
          <div key={item}>• {item}</div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#d9bc99]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[18px] border border-[#3b312a] bg-[#0f0f0e] px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}
