'use client';

/**
 * 史馆 · ShiguanBottomDock
 *
 * 太史令底部交互 Dock：
 *   - 折叠态：展示档案统计概要
 *   - 展开态：左侧历史分析，右侧对话流
 *   - 发送走 /api/orchestration/run SSE 流（三省会审）
 *   - 快选 prompts 直接触发档案分析问询
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { ScrollText, Archive, TrendingUp, Award } from 'lucide-react';
import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useOrchestrationChat } from '@/features/shiguan/lib/use-orchestration-chat';
import type { ArchiveStats, ArchiveRecord } from '@/lib/contracts/archive';

const GOLD = '#F0C66A';

interface ShiguanBottomDockProps {
  stats: ArchiveStats | null;
  recentRecords: ArchiveRecord[];
}

function HistorianAvatar() {
  return (
    <span
      aria-label="太史令"
      style={{ fontSize: 20, lineHeight: 1 }}
    >
      📜
    </span>
  );
}

export function ShiguanBottomDock({ stats, recentRecords }: ShiguanBottomDockProps) {
  const greeting = stats
    ? `太史令回禀：史馆现有档案 ${stats.totalTasks} 卷，已结案 ${stats.totalCases} 件，综合成功率 ${stats.successRate}%。陛下有何垂询？`
    : '太史令回禀：史馆档案正在整理，请陛下稍候，或直接下旨垂询。';

  // useOrchestrationChat 走 /api/orchestration/run（三省会审 SSE 流）
  const { messages, handleSend } = useOrchestrationChat(greeting);

  const successRecords = recentRecords.filter((r) => r.outcome === 'success');
  const failedRecords = recentRecords.filter((r) => r.outcome === 'failed');
  const govRecords = recentRecords.filter((r) => r.isGovernance);

  const focusPanel = useMemo(() => (
    <div className="space-y-3">
      {/* 统计速览 */}
      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: `${GOLD}55`,
          background: `linear-gradient(135deg, ${GOLD}12, transparent 72%)`,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: GOLD }}>
              Archive Focus · 史馆总览
            </div>
            <div className="mt-1 text-[20px] font-semibold" style={{ color: '#F5E9C9' }}>
              {stats ? `${stats.successRate}% 成功率` : '加载中…'}
            </div>
          </div>
          <div
            className="rounded-full border px-3 py-1 font-mono text-[12px] font-bold"
            style={{
              borderColor: `${GOLD}55`,
              background: `${GOLD}14`,
              color: GOLD,
            }}
          >
            {stats ? `${stats.totalTasks} 卷` : '—'}
          </div>
        </div>
        <div className="mt-2 text-[12px] leading-6" style={{ color: '#9AA3C4' }}>
          史馆汇总历代蜂群任务与治理决策，提炼规律，为下一次裁断立先例。
        </div>
      </div>

      {/* 三格统计 */}
      <div className="grid grid-cols-3 gap-2">
        <ArchiveStat
          label="已结案"
          value={`${successRecords.length}`}
          note="蜂群与治理"
          color="#3DD68C"
          icon={Award}
        />
        <ArchiveStat
          label="治理决策"
          value={`${govRecords.length}`}
          note="三省审议"
          color={GOLD}
          icon={ScrollText}
        />
        <ArchiveStat
          label="待关注"
          value={`${failedRecords.length}`}
          note="失败或阻塞"
          color="#F43F5E"
          icon={TrendingUp}
        />
      </div>

      {/* 最近档案 */}
      {recentRecords.length > 0 && (
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
            Recent · 最近档案
          </div>
          <ul className="mt-2 space-y-1.5">
            {recentRecords.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[11px]" style={{ color: '#D6CCB0' }}>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      r.outcome === 'success'
                        ? '#3DD68C'
                        : r.outcome === 'failed'
                          ? '#F43F5E'
                          : r.outcome === 'blocked'
                            ? '#FB923C'
                            : '#6A7299',
                  }}
                />
                <span className="truncate">{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 快捷跳转 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/governance"
          className="rounded-full border px-3 py-1.5 text-[11px]"
          style={{
            borderColor: `${GOLD}55`,
            background: `${GOLD}14`,
            color: '#F5E9C9',
          }}
        >
          去三省审议台
        </Link>
        <Link
          href="/scribe"
          className="rounded-full border px-3 py-1.5 text-[11px]"
          style={{
            borderColor: 'rgba(255,255,255,0.12)',
            color: '#F5E9C9',
          }}
        >
          去复盘台
        </Link>
      </div>
    </div>
  ), [stats, recentRecords, successRecords, govRecords, failedRecords]);

  const collapsedTeaser = stats
    ? `史馆共 ${stats.totalTasks} 卷 · 结案 ${stats.totalCases} 件 · 成功率 ${stats.successRate}%`
    : '史馆档案整理中 · 请陛下垂询';

  return (
    <BottomDock
      title="太史馆"
      name="太史令 · 秉笔直书"
      accent={GOLD}
      visualStyle="imperial"
      avatar={<HistorianAvatar />}
      quickPrompts={[]}
      messages={messages}
      placeholder="请陛下问史…"
      sendLabel="问史"
      onSend={handleSend}
      badges={
        stats
          ? [
              { label: '档案', value: `${stats.totalTasks}` },
              { label: '成功率', value: `${stats.successRate}%` },
            ]
          : []
      }
      collapsedTeaser={collapsedTeaser}
      focusPanel={focusPanel}
    />
  );
}

function ArchiveStat({
  label,
  value,
  note,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
  icon: typeof Award;
}) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(160deg, ${color}0a, rgba(0,0,0,0.3))`,
      }}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        <Icon size={10} />
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] font-bold" style={{ color: '#F5E9C9' }}>
        {value}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: '#9AA3C4' }}>
        {note}
      </div>
    </div>
  );
}
