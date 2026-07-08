'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { BatteryListing, Inquiry } from '@/shared/battery-exchange';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data;
}

export function BatteryExchangeInquiryCenter() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [listings, setListings] = useState<BatteryListing[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [inquiryData, listingData] = await Promise.all([
          readJson<Inquiry[]>('/api/battery-exchange/inquiries'),
          readJson<BatteryListing[]>('/api/battery-exchange/listings'),
        ]);

        if (!mounted) return;
        setInquiries(inquiryData);
        setListings(listingData);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '询盘中心加载失败');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const listingMap = useMemo(() => new Map(listings.map((listing) => [listing.id, listing])), [listings]);

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
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Inquiry Center</div>
              <h1
                className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                询盘中心。
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
                先看哪些买家已经开口，再决定哪些货盘值得马上跟进、锁货和拉进担保交易。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/battery-exchange/market"
                className="rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f]"
              >
                回交易台
              </Link>
              <Link
                href="/battery-exchange/trade-orders"
                className="rounded-full border border-[#6d4d31] px-5 py-3 text-sm font-semibold text-[#f3d0a1]"
              >
                看交易单列表
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[22px] border border-[#7a2f2f] bg-[#2c1111] px-4 py-5 text-sm text-[#f1b2b2]">
            {error}
          </div>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-[#2f2823] bg-[#151311]/88 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">Open Threads</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">最近询盘</h2>
            </div>
            <div className="text-sm text-[#b99876]">{inquiries.length} 条询盘</div>
          </div>
          <div className="mt-5 space-y-3">
            {inquiries.map((inquiry) => {
              const listing = listingMap.get(inquiry.listingId);
              return (
                <div
                  key={inquiry.id}
                  className="rounded-[20px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-[#f6dfbc]">{inquiry.buyerCompany}</div>
                      <div className="mt-1 text-xs text-[#b99876]">
                        {formatInquiryStatus(inquiry.status)} · {formatDate(inquiry.createdAt)}
                      </div>
                    </div>
                    {listing ? (
                      <Link
                        href={`/battery-exchange/listings/${listing.id}`}
                        className="text-sm text-[#f0c27b] hover:text-[#ffd79a]"
                      >
                        {listing.brand} {listing.model}
                      </Link>
                    ) : (
                      <div className="text-xs text-[#b99876]">关联货盘已下线</div>
                    )}
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[#d2b796]">{inquiry.message}</div>
                </div>
              );
            })}
            {inquiries.length === 0 ? (
              <div className="rounded-[18px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 text-sm leading-7 text-[#cfb08b]">
                当前还没有新询盘，建议先回交易台筛出更容易成交的货盘。
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatInquiryStatus(status: Inquiry['status']) {
  switch (status) {
    case 'open':
      return '待回复';
    case 'quoted':
      return '已报价';
    case 'closed':
      return '已关闭';
    default:
      return status;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
