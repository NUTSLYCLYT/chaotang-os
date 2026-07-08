'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TradeOrder } from '@/shared/battery-exchange';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };

  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload.data;
}

export function BatteryExchangeTradeOrderList() {
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const tradeOrders = await readJson<TradeOrder[]>('/api/battery-exchange/trade-orders');
        if (!mounted) return;
        setOrders(tradeOrders);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '交易单列表加载失败');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

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
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Trade Order List</div>
              <h1
                className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                我的交易单。
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
                把已经创建的托管交易集中到一起，优先看金额大、风险高、还卡在关键节点的单。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/battery-exchange/inquiries"
                className="rounded-full border border-[#6d4d31] px-5 py-3 text-sm font-semibold text-[#f3d0a1]"
              >
                去询盘中心
              </Link>
              <Link
                href="/battery-exchange/market"
                className="rounded-full bg-[#f0b76b] px-5 py-3 text-sm font-semibold text-[#20160f]"
              >
                回交易台
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
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#b47d44]">Escrow Queue</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#f4ead1]">最近交易单</h2>
            </div>
            <div className="text-sm text-[#b99876]">{orders.length} 笔交易</div>
          </div>
          <div className="mt-5 space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/battery-exchange/trade-orders/${order.id}`}
                className="block rounded-[20px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 transition hover:border-[#7a5430]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-[#f6dfbc]">{order.buyerCompany}</div>
                    <div className="mt-1 text-xs text-[#b99876]">
                      {order.id} · {formatTradeStatus(order.status)} · {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[#f0c27b]">
                    <div>¥{formatAmount(order.totalAmountCny)}</div>
                    <div>{Math.round(order.escrowRatio * 100)}% 托管</div>
                  </div>
                </div>
                {order.riskFlags.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs leading-6 text-[#d9bb97]">
                    {order.riskFlags.map((risk) => (
                      <div key={risk.id}>• {risk.note}</div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs leading-6 text-[#d9bb97]">当前无新增风险标记，可继续推进下一节点。</div>
                )}
              </Link>
            ))}
            {orders.length === 0 ? (
              <div className="rounded-[18px] border border-[#3d2e22] bg-[#120f0d] px-4 py-4 text-sm leading-7 text-[#cfb08b]">
                当前还没有创建新的交易单，建议先回交易台锁定第一批现货。
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
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

function formatAmount(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
