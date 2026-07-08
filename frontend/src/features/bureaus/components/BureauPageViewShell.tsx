'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, ArrowLeft, GitBranch, Loader2, ShieldAlert } from 'lucide-react';

import {
  ShangshufangLayoutShell,
  ShangshufangRailPanel,
} from '@/features/shared/components/shangshufang-layout-shell';
import { DepartmentEdictStage } from '@/features/departments/components/DepartmentEdictStage';
import { RailSectionRenderer } from '@/features/departments/components/RailSectionRenderer';
import type { BureauAction, BureauPageView } from '@/lib/contracts/bureau-page-view';
import type { DepartmentCommandTone } from '@/lib/contracts/department-page-view';
import { withBasePath } from '@/lib/base-path';

const DEPARTMENT_LABEL: Record<BureauPageView['bureau']['department'], string> = {
  finance: '户部',
  ops: '兵部',
  personnel: '吏部',
  gongbu: '工部',
  legal: '刑部',
  market: '礼部',
};

const COMMAND_STYLE: Record<DepartmentCommandTone, string> = {
  green: 'border-[#7DE3A8]/35 bg-[#7DE3A8]/10 text-[#A9F3C3]',
  amber: 'border-[#F0C66A]/35 bg-[#F0C66A]/10 text-[#F4D98C]',
  red: 'border-[#FF8A8A]/35 bg-[#FF8A8A]/10 text-[#FFB0B0]',
  blue: 'border-[#86A9F2]/35 bg-[#86A9F2]/10 text-[#B8C9FF]',
  neutral: 'border-white/15 bg-white/[0.05] text-[#D7DFF2]',
};

function ActionButton({
  action,
  pending,
  onRun,
}: {
  action: BureauAction;
  pending?: boolean;
  onRun: (action: BureauAction) => void;
}) {
  const className = COMMAND_STYLE[action.tone ?? 'neutral'];
  return (
    <button
      type="button"
      disabled={Boolean(action.disabledReason) || pending}
      onClick={() => onRun(action)}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      title={action.disabledReason}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : action.intent === 'archive' ? <Archive size={13} /> : action.intent === 'handoff' ? <GitBranch size={13} /> : action.intent === 'block' ? <ShieldAlert size={13} /> : null}
      {action.label}
    </button>
  );
}

export function BureauPageViewShell({ view }: { view: BureauPageView }) {
  const [currentView, setCurrentView] = useState(view);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentView(view);
  }, [view.viewId]);

  async function runAction(action: BureauAction) {
    setPendingAction(action.id);
    setActionError(null);
    try {
      const res = await fetch(
        withBasePath(`/api/court/bureaus/${encodeURIComponent(currentView.bureau.department)}/${encodeURIComponent(currentView.bureau.bureau)}/actions`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewId: currentView.viewId,
            action: action.id,
            intent: action.intent,
            target: action.target,
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: BureauPageView; error?: string };
      if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? 'bureau_action_failed');
      setCurrentView(json.data);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'bureau_action_failed');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <ShangshufangLayoutShell
      eyebrow="司级办事台"
      title={currentView.header.title}
      subtitle={`${currentView.header.subtitle} · ${currentView.header.userQuestion}`}
      accent={currentView.bureau.accent}
      background={currentView.bureau.background}
      breadcrumb={
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8F99B3]">
          <Link href="/departments" className="inline-flex items-center gap-1 transition hover:text-[#F0C66A]">
            <ArrowLeft size={12} />
            六部
          </Link>
          <span>/</span>
          <Link href={`/departments/${currentView.bureau.department}`} className="transition hover:text-[#F0C66A]">
            {DEPARTMENT_LABEL[currentView.bureau.department]}
          </Link>
          <span>/</span>
          <span style={{ color: currentView.bureau.accent }}>{currentView.bureau.name}</span>
        </div>
      }
      actions={
        <div
          className="inline-flex items-center gap-2 rounded-[8px] border px-3 py-1.5 text-[12px]"
          style={{
            borderColor: `${currentView.bureau.accent}42`,
            background: `${currentView.bureau.accent}12`,
            color: currentView.bureau.accent,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: currentView.bureau.accent }} />
          {currentView.dataMode === 'skeleton' ? '保守判断' : '有据可查'}
        </div>
      }
      left={
        <ShangshufangRailPanel
          title={`${currentView.bureau.name}左批`}
          subtitle="先看结论，再看该办哪一步。"
          accent={currentView.bureau.accent}
        >
          <div className="space-y-3">
            {currentView.leftRail.map((section) => (
              <RailSectionRenderer key={section.id} section={section} />
            ))}
          </div>
        </ShangshufangRailPanel>
      }
      center={
        <div className="h-full min-h-0">
          <DepartmentEdictStage
            view={currentView.mainEdict}
            documentTitle={`${DEPARTMENT_LABEL[currentView.bureau.department]}奏折`}
            footer={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {actionError ? <span className="mr-auto text-[11px] text-[#FFB0B0]">{actionError}</span> : null}
                {currentView.actions.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    pending={pendingAction === action.id}
                    onRun={runAction}
                  />
                ))}
              </div>
            }
          />
        </div>
      }
      right={
        <ShangshufangRailPanel
          title={`${currentView.bureau.name}右批`}
          subtitle="看依据、缺口、风险和该找谁。"
          accent={currentView.bureau.accent}
        >
          <div className="space-y-3">
            {currentView.rightRail.map((section) => (
              <RailSectionRenderer key={section.id} section={section} />
            ))}
          </div>
        </ShangshufangRailPanel>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] tracking-[0.14em] text-[#7C86A6]">
          <span>{currentView.integrity.sourceLabel}</span>
          <span>{currentView.header.blockedValue}</span>
        </div>
      }
    />
  );
}

export function BureauPageViewLoading({ department, bureau }: { department: string; bureau: string }) {
  return (
    <ShangshufangLayoutShell
      eyebrow="司级办事台"
      title="司级案卷加载中"
      subtitle={`正在调取 ${department}/${bureau} 的司级页面数据。`}
      left={<ShangshufangRailPanel title="左批" accent="#F0C66A"><div className="h-32 animate-pulse rounded-[8px] bg-white/[0.04]" /></ShangshufangRailPanel>}
      center={
        <div className="flex h-full min-h-[520px] items-center justify-center rounded-[8px] border border-[#F0C66A]/20 bg-black/30">
          <div className="flex items-center gap-2 text-[13px] text-[#F0C66A]">
            <Loader2 size={16} className="animate-spin" />
            调取司级案卷
          </div>
        </div>
      }
      right={<ShangshufangRailPanel title="右批" accent="#F0C66A"><div className="h-32 animate-pulse rounded-[8px] bg-white/[0.04]" /></ShangshufangRailPanel>}
    />
  );
}

export function BureauPageViewError({ department, bureau, message }: { department: string; bureau: string; message: string }) {
  return (
    <ShangshufangLayoutShell
      eyebrow="司级办事台"
      title="司级案卷暂不可用"
      subtitle={`${department}/${bureau} 页面数据读取失败：${message}`}
      left={<ShangshufangRailPanel title="左批" accent="#F0C66A"><div className="text-[12px] leading-6 text-[#C8CDD8]">请稍后重试。</div></ShangshufangRailPanel>}
      center={
        <div className="flex h-full min-h-[520px] items-center justify-center rounded-[8px] border border-[#FF8A8A]/25 bg-[#FF8A8A]/[0.06] px-6 text-center text-[13px] leading-6 text-[#FFD0D0]">
          当前无法生成司级页面视图，但页面壳不会白屏。
        </div>
      }
      right={<ShangshufangRailPanel title="右批" accent="#F0C66A"><div className="text-[12px] leading-6 text-[#C8CDD8]">错误已限制在取数层。</div></ShangshufangRailPanel>}
    />
  );
}
