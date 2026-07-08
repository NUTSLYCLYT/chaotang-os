"use client";

import { useState } from "react";
import useSWR from "swr";
import { PULSE_METRICS, type PulseMetric } from "@/features/dadian/lib/dadian";
import type { DadianPulseData } from "@/lib/contracts/dadian";
import { withBasePath } from "@/lib/base-path";

/** SWR fetcher for /api/court/dadian/pulse */
async function pulseFetcher(url: string): Promise<DadianPulseData> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`pulse ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: DadianPulseData };
  return json.data;
}

/**
 * 把 Turso 实时 pulse 字段映射到设计图 02-dadian.png 的 4 张脉搏卡。
 * 任一真实值缺失则回落该卡的设计静态值(PULSE_METRICS),保证 1:1 版式不塌。
 */
function buildMetrics(pulse: DadianPulseData | undefined): PulseMetric[] {
  if (!pulse || pulse.source === "fallback") return PULSE_METRICS;
  const real: Record<string, number | undefined> = {
    任务总数: pulse.activeTasks,
    风险预警: pulse.riskCount,
    机遇发现: pulse.opportunityCount,
    活跃智囊: pulse.swarmActivity || undefined,
  };
  return PULSE_METRICS.map((m) => {
    const v = real[m.label];
    return typeof v === "number" ? { ...m, value: v } : m;
  });
}

export default function PulsePanel() {
  const [collapsed, setCollapsed] = useState(false);

  // Poll Turso pulse every 30 s — drives metric cards with real data
  const { data: pulse, isLoading, error } = useSWR<DadianPulseData>(
    withBasePath("/api/court/dadian/pulse"),
    pulseFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );

  const metrics = buildMetrics(pulse);
  const isFallback = Boolean(error) || pulse?.source === "fallback";
  const statusLabel = isFallback ? "可先下旨" : "实时";
  const statusText = error
    ? "外廷回声偏弱 · 首屏仍可下旨"
    : pulse?.source === "fallback"
      ? "朝堂动态暂候补录 · 正显示演示基准"
      : "真实数据已接入";

  if (collapsed) {
    return (
      <aside className="absolute left-3 top-3 z-30 animate-fade-up md:left-4 md:top-7">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="group flex h-[132px] w-10 flex-col items-center justify-center gap-2 rounded-r-lg border border-l-0 border-[#F0C66A]/30 bg-[#06111f]/38 text-[#F0C66A] shadow-[0_14px_34px_rgba(0,0,0,0.28)] backdrop-blur-lg transition hover:bg-[#06111f]/58"
          aria-label="展开朝堂脉搏"
        >
          <span className="text-[13px] leading-none">脉</span>
          <span className="text-[13px] leading-none">搏</span>
          <ChevronIcon direction="right" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="absolute left-3 right-3 top-3 z-30 w-auto animate-fade-up rounded-lg border border-[#d8b76a]/24 bg-[#06111f]/68 p-3.5 shadow-[0_18px_42px_rgba(0,0,0,0.30)] backdrop-blur-xl transition hover:bg-[#06111f]/72 md:left-4 md:right-auto md:top-7 md:z-20 md:w-[220px] md:bg-[#06111f]/42 md:hover:bg-[#06111f]/58">
      {/* 标题 */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
        <h2 className="text-[15px] font-medium tracking-wide text-gold-200">
          今日状态
        </h2>
        <InfoIcon />
        </div>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${isFallback ? "border-ember-400/30 bg-ember-400/10 text-ember-400" : "border-jade-400/30 bg-jade-400/10 text-jade-400"}`}>
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#F0C66A]/18 bg-black/10 text-[#D8B76A]/80 transition hover:border-[#F0C66A]/45 hover:text-[#F0C66A]"
          aria-label="收起朝堂脉搏"
        >
          <ChevronIcon direction="left" />
        </button>
      </header>
      <p className="mt-2 text-[11px] leading-5 text-parchment-200/60">
        {statusText}
      </p>
      <div className="hairline-gold my-2.5 opacity-40" />

      {/* 指标卡 */}
      <div className="grid grid-cols-2 gap-2">
        {isLoading ? (
          <p className="text-micro text-parchment-200/45">加载中…</p>
        ) : (
          metrics.map((m) => <StatCard key={m.label} metric={m} />)
        )}
      </div>
      <div className="mt-3 rounded-md border border-[#F0C66A]/14 bg-black/16 px-2.5 py-2 text-[11px] leading-5 text-parchment-200/68">
        下一步：先用右侧一句话下旨，把最急的经营问题交给丞相拆解。
      </div>
    </aside>
  );
}

function StatCard({ metric }: { metric: PulseMetric }) {
  const warn = metric.trend === "warn";
  return (
    <div className="rounded-md border border-gold-400/10 bg-ink-800/28 px-2.5 py-2.5 backdrop-blur-sm">
      <p className="text-micro text-parchment-200/70">{metric.label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-[22px] font-bold leading-none ${
            warn ? "text-ember-400" : "text-gold-200"
          }`}
        >
          {metric.value}
        </span>
        <span className="text-micro text-parchment-200/60">{metric.unit}</span>
      </p>
      <p
        className={`mt-1.5 text-label ${warn ? "text-ember-400" : "text-jade-400"}`}
      >
        {metric.delta}
      </p>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-3.5 w-3.5 ${direction === "left" ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M7 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 text-parchment-200/45">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M10 9v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6.4" r="0.9" fill="currentColor" />
    </svg>
  );
}
