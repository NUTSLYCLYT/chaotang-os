'use client';

import { Activity, Database, ShieldCheck } from 'lucide-react';
import useSWR from 'swr';

import { fetchYushiRejectionMetric } from '../api/guoli-client';
import { formatYushiRejectionValue } from '../lib/guoli-overview';

function formatCutoff(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatWindow(
  kind: 'ALL_RECORDED' | 'ROLLING_7D',
  startAt: string | null,
  endAt: string | null,
): string {
  // 诚实标窗口:ROLLING_7D 的比率只覆盖近 7 天,绝不能显示成"全部记录"(误导为全时段)。
  const label = kind === 'ROLLING_7D' ? '近 7 天' : '全部记录';
  if (!startAt || !endAt) return `${label} · 尚无样本`;
  return `${label} · ${formatCutoff(startAt)}—${formatCutoff(endAt)}`;
}

export function YushiRejectionRateCard() {
  const { data, error, isLoading } = useSWR(
    'guoli:yushi-rejection-rate',
    fetchYushiRejectionMetric,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );

  if (isLoading) {
    return (
      <section
        aria-label="御史封驳率读取中"
        className="w-full max-w-[980px] rounded-[18px] border border-[#b7965b]/25 bg-[#080a10]/88 px-5 py-4 text-[#b9ad95] shadow-[0_18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 text-sm tracking-[0.18em]">
          <Activity className="h-4 w-4 animate-pulse text-[#c8a86a]" aria-hidden="true" />
          正在核对御史真值台账…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section
        aria-label="御史封驳率不可用"
        className="w-full max-w-[980px] rounded-[18px] border border-[#a44b45]/35 bg-[#120b0d]/90 px-5 py-4 text-[#d8c8b5] shadow-[0_18px_50px_rgba(0,0,0,0.36)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <Database className="h-4 w-4 text-[#d3786f]" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium tracking-[0.14em]">国力读模型暂不可用</p>
            <p className="mt-1 text-xs text-[#a99885]">未使用本地数据补位，请稍后重试。</p>
          </div>
        </div>
      </section>
    );
  }

  const value = formatYushiRejectionValue(data);
  const isLive = data.status === 'LIVE';

  return (
    <section
      aria-label="御史封驳率"
      data-testid="guoli-yushi-card"
      data-status={data.status}
      data-value={data.value ?? ''}
      className="w-full max-w-[980px] overflow-hidden rounded-[18px] border border-[#b7965b]/35 bg-[linear-gradient(105deg,rgba(10,12,18,0.96),rgba(18,16,17,0.9))] text-[#efe4cd] shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl"
    >
      <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(212,174,103,0.8),rgba(139,52,47,0.75),transparent)]" />
      <div className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(210px,0.8fr)_minmax(0,1.7fr)] md:items-center md:px-6">
        <div className="flex items-center gap-4 border-b border-[#b7965b]/15 pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#a94742]/45 bg-[#351517]/55 shadow-[inset_0_0_18px_rgba(129,42,39,0.25)]">
            <ShieldCheck className="h-5 w-5 text-[#df8b7e]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] tracking-[0.24em] text-[#a99a82]">国力薄 · 御史台</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.15em] ${
                  isLive
                    ? 'border-[#648b6b]/55 bg-[#1d3825]/60 text-[#a9d1ae]'
                    : 'border-[#8f7350]/55 bg-[#382a19]/55 text-[#d1b47c]'
                }`}
              >
                {data.status}
              </span>
            </div>
            <div className="mt-1.5">
              <h2 className="text-sm font-medium tracking-[0.12em] text-[#e7d9bf]">{data.label}</h2>
              <strong
                className={`mt-1.5 block font-serif font-semibold leading-none tabular-nums text-[#fff4dc] ${
                  isLive ? 'text-3xl' : 'text-xl tracking-[0.08em]'
                }`}
              >
                {value ?? '暂无可计算值'}
              </strong>
            </div>
            {!isLive && data.reason ? (
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#b9a88f]">{data.reason}</p>
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs lg:grid-cols-3">
          <div>
            <dt className="text-[#8f846f]">样本</dt>
            <dd className="mt-1 font-medium tabular-nums text-[#e5d7bd]">{data.sampleSize} 条判决</dd>
          </div>
          <div className="col-span-1 lg:col-span-2">
            <dt className="text-[#8f846f]">时间窗口</dt>
            <dd className="mt-1 truncate font-medium text-[#e5d7bd]">
              {formatWindow(data.window.kind, data.window.startAt, data.window.endAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[#8f846f]">数据来源</dt>
            <dd className="mt-1 font-mono text-[11px] text-[#d4bd91]">{data.dataSource}</dd>
          </div>
          <div>
            <dt className="text-[#8f846f]">截止时间</dt>
            <dd className="mt-1 font-medium tabular-nums text-[#e5d7bd]">{formatCutoff(data.asOf)}</dd>
          </div>
          <div>
            <dt className="text-[#8f846f]">样例口径</dt>
            <dd className="mt-1 font-medium text-[#e5d7bd]">
              {data.includesDemo ? '包含 DEMO' : '不含 DEMO'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
