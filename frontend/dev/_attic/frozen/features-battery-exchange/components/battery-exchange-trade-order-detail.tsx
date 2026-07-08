'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TradeOrderDetail, TradeTimelineStep } from '@/shared/battery-exchange';

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const payload = (await response.json()) as { success: boolean; data?: T; error?: string };
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload.data;
}

export function BatteryExchangeTradeOrderDetail({ orderId }: { orderId: string }) {
  const [detail, setDetail] = useState<TradeOrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const payload = await readJson<TradeOrderDetail>(
          `/api/battery-exchange/trade-orders/${encodeURIComponent(orderId)}`,
        );
        if (!mounted) return;
        setDetail(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '交易单加载失败');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

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
          交易单加载中...
        </div>
      </div>
    );
  }

  const currentStep = detail.timeline.find((step) => !step.done) ?? detail.timeline.at(-1) ?? null;

  return (
    <div className="relative min-h-full overflow-y-auto bg-[#111111] text-[#f3ead3]">
      <div
        className="absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 20% 16%, rgba(226,114,39,0.18), transparent 24%), radial-gradient(circle at 82% 10%, rgba(244,199,91,0.14), transparent 28%), linear-gradient(180deg, #171412 0%, #111111 48%, #0b0b0b 100%)',
        }}
      />
      <div className="relative mx-auto max-w-[1480px] px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center gap-3 text-sm text-[#b69a77]">
          <Link href="/battery-exchange" className="hover:text-[#f0c27b]">
            电池现货台
          </Link>
          <span>/</span>
          <Link href="/battery-exchange/market" className="hover:text-[#f0c27b]">
            现货交易台
          </Link>
          <span>/</span>
          <span className="text-[#f0c27b]">{detail.id}</span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-[#3c2c20] bg-[#171311]/90 p-6">
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#bd8751]">Trade Order</div>
              <h1
                className="mt-3 text-[38px] font-semibold leading-tight text-[#f7ead1]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {detail.listingTitle}
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#cfb493]">
                这页只回答三件事：现在卡在哪一步、平台建议怎么推进、还有哪些风险需要提前处理。
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#edc98f]">
                <Badge>{detail.id}</Badge>
                <Badge>{formatTradeStatus(detail.status)}</Badge>
                <Badge>{detail.buyerCompanyName}</Badge>
                <Badge>{detail.sellerCompanyName}</Badge>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
              <Panel eyebrow="Deal Snapshot" title="成交结构与金额">
                <div className="grid gap-3 md:grid-cols-2">
                  <Spec label="成交数量" value={`${detail.quantity} 件`} />
                  <Spec label="单价" value={`¥${formatAmount(detail.unitPriceCny)}`} />
                  <Spec label="总金额" value={`¥${formatAmount(detail.totalAmountCny)}`} />
                  <Spec label="托管比例" value={`${Math.round(detail.escrowRatio * 100)}%`} />
                </div>
                <div className="mt-4 rounded-[18px] border border-[#4e3724] bg-[#130f0d] px-4 py-3 text-sm leading-7 text-[#d2b796]">
                  平台建议按「{detail.paymentScheme}」推进，当前下一步是
                  {currentStep ? ` ${currentStep.label}` : ' 完成交付与放款'}。
                </div>
              </Panel>

              <Panel eyebrow="Risk Flags" title="当前风险与处理建议">
                {detail.riskFlags.length > 0 ? (
                  <div className="space-y-3">
                    {detail.riskFlags.map((risk) => (
                      <div
                        key={risk.id}
                        className="rounded-[18px] border border-[#4e3724] bg-[#130f0d] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[#f6dfbc]">{formatRiskType(risk.type)}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[#e7b66f]">
                            {formatRiskSeverity(risk.severity)}
                          </div>
                        </div>
                        <div className="mt-2 text-sm leading-7 text-[#cfb08b]">{risk.note}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-[#4e3724] bg-[#130f0d] px-4 py-3 text-sm leading-7 text-[#d2b796]">
                    当前交易单没有新增风险标记，可按既定托管与验货流程继续推进。
                  </div>
                )}
              </Panel>
            </section>

            <Panel eyebrow="Timeline" title="交易推进节奏">
              <div className="space-y-4">
                {detail.timeline.map((step, index) => (
                  <TimelineRow
                    key={step.key}
                    step={step}
                    isCurrent={!step.done && detail.timeline.slice(0, index).every((entry) => entry.done)}
                  />
                ))}
              </div>
            </Panel>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Panel eyebrow="Next Action" title="现在该做什么">
              <div className="space-y-4">
                <div className="rounded-[18px] border border-[#4b3624] bg-[#120f0d] px-4 py-3 text-sm leading-7 text-[#d1b594]">
                  {currentStep
                    ? `当前主动作：${currentStep.label}。如需继续推进，请先确认托管比例、验货节点与当前风险提示。`
                    : '当前交易单已进入最后阶段，可继续准备交付与放款确认。'}
                </div>
                <Link
                  href="/battery-exchange/market"
                  className="block rounded-full bg-[#f0b76b] px-5 py-3 text-center text-sm font-semibold text-[#20160f]"
                >
                  返回现货交易台
                </Link>
                <Link
                  href="/battery-exchange/trade-orders"
                  className="block rounded-full border border-[#6d4d31] px-5 py-3 text-center text-sm font-semibold text-[#f3d0a1]"
                >
                  查看交易单列表
                </Link>
                <Link
                  href="/battery-exchange"
                  className="block rounded-full border border-[#3f2e22] px-5 py-3 text-center text-sm font-semibold text-[#d9bb97]"
                >
                  回电池现货入口
                </Link>
                <Link
                  href="/battery-exchange/operators"
                  className="block rounded-full border border-[#3f2e22] px-5 py-3 text-center text-sm font-semibold text-[#d9bb97]"
                >
                  进入风控与处置台
                </Link>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
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

function TimelineRow({
  step,
  isCurrent,
}: {
  step: TradeTimelineStep;
  isCurrent: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-4 ${
        step.done
          ? 'border-[#5c452f] bg-[#17120f]'
          : isCurrent
            ? 'border-[#c98a49] bg-[#21170f]'
            : 'border-[#3d2e22] bg-[#120f0d]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[#f6dfbc]">{step.label}</div>
          <div className="mt-1 text-xs text-[#b99876]">
            {step.done ? `已完成${step.at ? ` · ${formatDate(step.at)}` : ''}` : isCurrent ? '当前节点' : '待处理节点'}
          </div>
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-[#f0c27b]">
          {step.done ? 'Done' : isCurrent ? 'Now' : 'Next'}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[#5f442b] bg-[#241a13] px-3 py-1">{children}</span>;
}

function formatTradeStatus(status: TradeOrderDetail['status']) {
  switch (status) {
    case 'awaiting_escrow':
      return '待托管';
    case 'awaiting_inspection':
      return '待验货';
    case 'ready_to_release':
      return '可放款';
    case 'in_dispute':
      return '争议处理中';
    default:
      return status;
  }
}

function formatRiskType(type: string) {
  switch (type) {
    case 'manual_review':
      return '人工复核';
    case 'grade_variance':
      return '等级偏差';
    case 'inspection_pending':
      return '待验货确认';
    default:
      return type;
  }
}

function formatRiskSeverity(severity: string) {
  switch (severity) {
    case 'high':
      return '高风险';
    case 'medium':
      return '中风险';
    case 'low':
      return '低风险';
    default:
      return severity;
  }
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
