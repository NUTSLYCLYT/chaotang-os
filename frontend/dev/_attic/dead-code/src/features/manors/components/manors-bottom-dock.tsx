'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { AlertTriangle, ClipboardList, ScrollText } from 'lucide-react';
import { BottomDock } from '@/features/shared/components/bottom-dock';
import { colors } from '@/config/design-tokens';
import type { ManorExecution } from '@/features/shared/lib/court-flow-data';
import { useDockChat } from '@/lib/hooks/use-dock-chat';

const ACCENT = colors.blueBright;

const QUICK = [
  '先说最该巡哪座庄园',
  '今天最大的阻塞是什么？',
  '哪座庄园回写最值得看？',
  '如果只盯一条执行链，看哪条？',
  '给我一句庄园总批',
];

export function ManorsBottomDock({
  hottest,
  blockerCount,
  outputCount,
}: {
  hottest: ManorExecution | undefined;
  blockerCount: number;
  outputCount: number;
}) {
  const greeting = hottest
    ? `庄主回禀：今日先巡${hottest.title}。它最能代表当前执行阻塞与回写节奏。`
    : '庄主回禀：今日诸庄尚无主战场，可先看蜂群回写再定巡视次序。';
  const { messages, handleSend } = useDockChat(greeting);

  const focusPanel = useMemo(() => {
    if (!hottest) {
      return (
        <div className="flex h-full items-center justify-center text-[11px]" style={{ color: colors.textDim }}>
          当前没有主战场，先看十庄园俯瞰再决定巡视顺序。
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: `${ACCENT}55`,
            background: `linear-gradient(135deg, ${ACCENT}12, transparent 72%)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                Manor Focus
              </div>
              <div className="mt-1 text-[18px] font-semibold" style={{ color: colors.text }}>
                {hottest.title}
              </div>
            </div>
            <div
              className="rounded-full border px-2 py-1 font-mono text-[12px] font-bold"
              style={{
                borderColor: `${ACCENT}55`,
                background: `${ACCENT}14`,
                color: ACCENT,
              }}
            >
              {hottest.domain}
            </div>
          </div>
          <div className="mt-2 text-[13px] leading-6" style={{ color: colors.textDim }}>
            {hottest.queueState}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <DockStat
            label="今日动作"
            value={`${hottest.actionBoard.today.length} 条`}
            note={hottest.actionBoard.today[0] ?? '待更新'}
            color={colors.success}
            icon={ClipboardList}
          />
          <DockStat
            label="当前阻塞"
            value={`${hottest.actionBoard.blockers.length} 条`}
            note={hottest.actionBoard.blockers[0] ?? '当前无阻塞'}
            color={colors.warning}
            icon={AlertTriangle}
          />
          <DockStat
            label="回写摘要"
            value={`${hottest.writebackSummary.length} 条`}
            note={hottest.writebackSummary[0]?.title ?? '待回写'}
            color={colors.goldBright}
            icon={ScrollText}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/manors"
            className="rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: `${ACCENT}55`,
              background: `${ACCENT}14`,
              color: colors.text,
            }}
          >
            回庄园总览
          </Link>
          <Link
            href="/scribe"
            className="rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              color: colors.text,
            }}
          >
            去复盘台看回写
          </Link>
        </div>
      </div>
    );
  }, [hottest]);

  return (
    <BottomDock
      title="Manor Steward"
      name="庄主 · 十庄园总管"
      accent={ACCENT}
      avatar={<span className="text-[20px]">🏯</span>}
      quickPrompts={QUICK}
      messages={messages}
      placeholder="请陛下巡庄..."
      sendLabel="巡按"
      onSend={handleSend}
      badges={[
        { label: '阻塞', value: `${blockerCount}` },
        { label: '回写', value: `${outputCount}` },
      ]}
      collapsedTeaser={
        hottest
          ? `今日先巡${hottest.title} · ${hottest.queueState}`
          : '庄主在案。先看十庄园俯瞰，再定巡视顺序。'
      }
      focusPanel={focusPanel}
    />
  );
}

function DockStat({
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
  icon: typeof ClipboardList;
}) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(160deg, ${color}0a, rgba(0,0,0,0.3))`,
      }}
    >
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.18em]" style={{ color }}>
        <Icon size={10} />
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] font-bold" style={{ color: colors.text }}>
        {value}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: colors.textDim }}>
        {note}
      </div>
    </div>
  );
}

