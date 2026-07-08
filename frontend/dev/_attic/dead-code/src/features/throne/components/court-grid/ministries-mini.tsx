'use client';

/**
 * 六部速览 · 2×3 小卡
 *
 * 每部一张：emoji · 部名 · 状态圆点 · 一行最新简讯
 * 点击进 /departments
 */

import Link from 'next/link';
import { AGENT_META, type AgentCode, type AgentRun } from '@/types/agent';

const MINISTRY_CODES: AgentCode[] = ['gong_bu', 'bing_bu', 'xing_bu', 'hu_bu', 'li_bu', 'li_bu_rites'];

interface Props {
  runs: AgentRun[];
}

export function MinistriesMini({ runs }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {MINISTRY_CODES.map((code) => {
        const meta = AGENT_META[code];
        const ministryRuns = runs.filter((r) => r.agentCode === code);
        const active = ministryRuns.find(
          (r) => r.state === 'running' || r.state === 'summarizing',
        );
        const hasBlocked = ministryRuns.some((r) => r.state === 'waiting_dependency');
        const activeCount = ministryRuns.filter(
          (r) => r.state === 'running' || r.state === 'summarizing',
        ).length;

        const dotColor = active
          ? '#6BA0FF'
          : hasBlocked
            ? '#F97316'
            : ministryRuns.length > 0
              ? '#F0C66A'
              : '#3F466A';
        const brief =
          active?.currentTaskTitle ??
          active?.latestSummary ??
          (hasBlocked ? '等待依赖' : '当值待命');

        return (
          <Link
            key={code}
            href="/departments"
            className="group rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:-translate-y-0.5 hover:border-[#F0C66A]/30 hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-2">
              <span className="text-[16px]">{meta.emoji}</span>
              <span className="text-[12px] font-semibold text-[#F5E9C9]">{meta.nameCn}</span>
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                aria-label={active ? '办理中' : hasBlocked ? '阻塞' : '待命'}
              />
            </div>
            <div className="mt-1.5 line-clamp-1 text-[11px] leading-5 text-[#9AA3C4]">
              {brief}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#6A7299]">
              {activeCount > 0 ? `办理 ${activeCount}` : '闲'}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
