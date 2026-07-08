"use client";

import Link from "next/link";
import useSWR from "swr";
import { BOTTOM_NOTICE } from "@/features/dadian/lib/dadian";
import type { DadianFeedResponse } from "@/lib/contracts/dadian";
import { withBasePath } from "@/lib/base-path";

async function feedFetcher(url: string): Promise<DadianFeedResponse> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const json = (await res.json()) as { success: boolean; data: DadianFeedResponse };
  return json.data;
}

export default function BottomBar() {
  const { data: feedData, error } = useSWR<DadianFeedResponse>(
    withBasePath("/api/court/dadian/feed"),
    feedFetcher,
    { refreshInterval: 15_000, revalidateOnFocus: false, dedupingInterval: 10_000 },
  );

  const latest = feedData?.items?.[0];
  const notice = error
    ? "朝堂动态暂候补录 · 可先下旨，史馆稍后补录"
    : feedData?.notice ?? BOTTOM_NOTICE;
  const role = error ? "钦天监" : latest?.depts?.[0] ?? "丞相";
  const accent = error ? "#F5A524" : "#F0C66A";
  const href = latest?.taskId
    ? `/command-center?task=${encodeURIComponent(latest.taskId)}`
    : "/command-center";

  return (
    <div className="fixed bottom-10 left-1/2 z-[120] w-[calc(100%-24px)] -translate-x-1/2 animate-fade-in overflow-hidden rounded-lg border border-[#d8b76a]/30 bg-[#050912]/90 shadow-[0_18px_54px_rgba(0,0,0,0.42)] backdrop-blur-xl md:absolute md:bottom-3 md:w-[min(1120px,calc(100%-24px))] md:bg-[#050912]/86">
      <div className="grid items-center gap-2 px-3 py-2.5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-3 md:px-4">
        <div className="flex items-center gap-3">
          <div
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-black/24 sm:flex"
            style={{ borderColor: `${accent}55`, color: accent }}
          >
            <ScrollIcon />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#8F835F]">
              Imperial Copilot · 御前副驾驶栏
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: `${accent}44`, color: accent }}>
                {role}
              </span>
              <span className="truncate text-[12px] text-parchment-100">{notice}</span>
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <CopilotStep active label="下旨" />
          <StepLine />
          <CopilotStep active={Boolean(latest)} label="拆解" />
          <StepLine />
          <CopilotStep active={!error} label="追踪" />
          <StepLine />
          <CopilotStep active={!error} label="归档" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={href}
            className="rounded border border-[#F0C66A]/36 bg-[#F0C66A]/10 px-3 py-2 text-[12px] font-medium text-[#F0C66A] transition hover:bg-[#F0C66A]/16"
          >
            继续办理
          </Link>
          <Link
            href="/court-briefing"
            className="hidden rounded border border-white/12 bg-white/[0.035] px-3 py-2 text-[12px] text-parchment-200/76 transition hover:bg-white/[0.07] sm:inline-flex"
          >
            回上书房
          </Link>
        </div>
      </div>
    </div>
  );
}

function CopilotStep({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#3DD68C]" : "bg-white/16"}`} />
      <span className={`text-[11px] ${active ? "text-parchment-100" : "text-parchment-200/38"}`}>{label}</span>
    </div>
  );
}

function StepLine() {
  return <span className="h-px w-8 bg-white/10" />;
}

function ScrollIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <rect x="4" y="3" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
