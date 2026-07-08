'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CheckCircle2, Clock3, FileText, Shield } from 'lucide-react';
import { BottomDock } from '@/features/shared/components/bottom-dock';
import { colors } from '@/config/design-tokens';
import type { GovernanceCase } from '@/features/shared/lib/court-flow-data';
import { useDockChat } from '@/lib/hooks/use-dock-chat';

const ACCENT = colors.goldBright;

const QUICK = [
  '先压成一句治理总批',
  '现在卡在起草还是复核？',
  '哪一案最该先裁？',
  '该送庄园还是再留三省？',
  '把今日治理规则讲明白',
];

export function GovernanceBottomDock({
  highestRiskCase,
  draftCount,
  reviewCount,
  dispatchCount,
}: {
  highestRiskCase: GovernanceCase | undefined;
  draftCount: number;
  reviewCount: number;
  dispatchCount: number;
}) {
  const greeting = reviewCount > 0
    ? '三省回禀：今日裁断压力在门下复核。先消边界与反证，再谈正式下发。'
    : dispatchCount > 0
      ? '三省回禀：今日重点在尚书下发。已成熟之议，不宜继续停在裁断层。'
      : '三省回禀：今日重点在中书起草。先把丞相判断写成正式动作，不让议题散掉。';
  const { messages, handleSend } = useDockChat(greeting);

  const focusPanel = useMemo(() => {
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
                Governance Focus
              </div>
              <div className="mt-1 text-[18px] font-semibold" style={{ color: colors.text }}>
                {highestRiskCase?.title ?? '当前尚无主审议题'}
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
              {highestRiskCase?.stage ?? 'idle'}
            </div>
          </div>
          <div className="mt-2 text-[13px] leading-6" style={{ color: colors.textDim }}>
            {highestRiskCase?.judgment ?? '治理层只裁断，不重做监国与解读。'}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <GovStat label="中书起草" value={`${draftCount} 件`} note="把判断写实" color={colors.info} icon={FileText} />
          <GovStat label="门下复核" value={`${reviewCount} 件`} note="先消边界反证" color={colors.warning} icon={Shield} />
          <GovStat label="尚书下发" value={`${dispatchCount} 件`} note="成熟议题不空转" color={colors.success} icon={CheckCircle2} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={highestRiskCase ? `/governance/${highestRiskCase.id}` : '/governance'}
            className="rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: `${ACCENT}55`,
              background: `${ACCENT}14`,
              color: colors.text,
            }}
          >
            展开当前议题
          </Link>
          <Link
            href="/manors"
            className="rounded-full border px-3 py-1.5 text-[11px]"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              color: colors.text,
            }}
          >
            去庄园执行面
          </Link>
        </div>
      </div>
    );
  }, [dispatchCount, draftCount, highestRiskCase, reviewCount]);

  return (
    <BottomDock
      title="Grand Secretariat"
      name="三省 · 裁断中枢"
      accent={ACCENT}
      avatar={<span className="text-[20px]">📜</span>}
      quickPrompts={QUICK}
      messages={messages}
      placeholder="请陛下裁断..."
      sendLabel="裁断"
      onSend={handleSend}
      badges={[
        { label: '复核', value: `${reviewCount}` },
        { label: '待发', value: `${dispatchCount}` },
      ]}
      collapsedTeaser={
        highestRiskCase
          ? `当前主案：${highestRiskCase.title} · ${highestRiskCase.stage}`
          : '三省在案。只裁断成熟议题，不回头重做解读。'
      }
      focusPanel={focusPanel}
    />
  );
}

function GovStat({
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
  icon: typeof FileText;
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

