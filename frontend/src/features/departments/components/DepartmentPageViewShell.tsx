'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, ArrowLeft, GitBranch, Loader2 } from 'lucide-react';

import { EdictStage } from '@/features/shangshufang/components/MemorialScroll';
import {
  ShangshufangLayoutShell,
  ShangshufangRailPanel,
} from '@/features/shared/components/shangshufang-layout-shell';
import { RailSectionRenderer } from '@/features/departments/components/RailSectionRenderer';
import { HubuBudgetCaseBody, HubuBudgetIntakeBody } from '@/features/departments/components/HubuBudgetCaseBody';
import { LifuOfficeDesk } from '@/features/lifu/components/LifuOfficeDesk';
import type {
  DepartmentCommand,
  DepartmentCommandTone,
  DepartmentPageCode,
  DepartmentPageView,
  DepartmentRailItem,
  DepartmentRailSection,
} from '@/lib/contracts/department-page-view';
import { withBasePath } from '@/lib/base-path';

const COMMAND_STYLE: Record<DepartmentCommandTone, string> = {
  green: 'border-[#7DE3A8]/35 bg-[#7DE3A8]/10 text-[#A9F3C3]',
  amber: 'border-[#F0C66A]/35 bg-[#F0C66A]/10 text-[#F4D98C]',
  red: 'border-[#FF8A8A]/35 bg-[#FF8A8A]/10 text-[#FFB0B0]',
  blue: 'border-[#86A9F2]/35 bg-[#86A9F2]/10 text-[#B8C9FF]',
  neutral: 'border-white/15 bg-white/[0.05] text-[#D7DFF2]',
};

function CommandButton({
  command,
  pending,
  onRun,
}: {
  command: DepartmentCommand;
  pending?: boolean;
  onRun: (command: DepartmentCommand) => void;
}) {
  const className = COMMAND_STYLE[command.tone ?? 'neutral'];
  const body = (
    <span
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-semibold transition hover:brightness-110 ${className} ${
        command.disabledReason ? 'cursor-not-allowed opacity-55' : ''
      }`}
      title={command.disabledReason}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : command.id.includes('archive') ? <Archive size={13} /> : command.id.includes('handoff') ? <GitBranch size={13} /> : null}
      {command.label}
    </span>
  );

  if (command.href && !command.disabledReason) {
    return <Link href={command.href}>{body}</Link>;
  }
  return (
    <button type="button" disabled={Boolean(command.disabledReason) || pending} onClick={() => onRun(command)}>
      {body}
    </button>
  );
}

function rowsFromRailItem(section: DepartmentRailSection, item: DepartmentRailItem): DepartmentPageView['mainEdict']['rows'] {
  return [
    { label: '任务标题', body: item.label },
    ...(item.body ? [{ label: '事项原文', body: item.body }] : []),
    ...(item.details?.length ? [{ label: '明细', body: item.details.map((detail) => `${detail.label}: ${detail.value}`).join('\n') }] : []),
    ...(item.value ? [{ label: '任务状态', body: item.value }] : []),
    ...(item.meta ? [{ label: '来源', body: item.meta }] : []),
  ];
}

export function DepartmentPageViewShell({
  view,
  focusTaskId,
  newBudget = false,
}: {
  view: DepartmentPageView;
  focusTaskId?: string;
  newBudget?: boolean;
}) {
  const [currentView, setCurrentView] = useState(view);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRailItemId, setSelectedRailItemId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentView(view);
    setSelectedRailItemId(null);
  }, [view.viewId]);

  async function runCommand(command: DepartmentCommand) {
    setPendingAction(command.id);
    setActionError(null);
    try {
      throw new Error('department_action_backend_endpoint_missing');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'department_action_failed');
    } finally {
      setPendingAction(null);
    }
  }

  function previewRailItem(section: DepartmentRailSection, item: DepartmentRailItem) {
    if (!item.actionId) return;
    setSelectedRailItemId(`${section.id}:${item.id}`);
    setCurrentView((previous) => ({
      ...previous,
      mainEdict: {
        ...previous.mainEdict,
        id: `${previous.mainEdict.id}:rail:${section.id}:${item.id}`,
        title: item.label,
        subtitle: section.title,
        question: section.subtitle ?? previous.mainEdict.question,
        rows: rowsFromRailItem(section, item),
      },
    }));
  }

  const hasOperationalRail = currentView.leftRail.some(
    (section) => !['department-focus', 'capabilities'].includes(section.id) && section.items.length > 0,
  );
  const showEmptyState = Boolean(currentView.emptyState && !hasOperationalRail);
  const showHubuBudgetCase = currentView.department.code === 'finance' && Boolean(focusTaskId);
  const showHubuBudgetIntake = currentView.department.code === 'finance' && newBudget && !focusTaskId;
  const showLifuOfficeDesk = currentView.department.code === 'market';

  return (
    <ShangshufangLayoutShell
      eyebrow={currentView.header.eyebrow}
      title={currentView.header.title}
      subtitle={`${currentView.header.subtitle} · ${currentView.header.primaryQuestion}`}
      accent={currentView.department.accent}
      background={currentView.department.background}
      breadcrumb={
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#8F99B3]">
          <Link href="/liubu" className="inline-flex items-center gap-1 transition hover:text-[#F0C66A]">
            <ArrowLeft size={12} />
            六部
          </Link>
          <span>/</span>
          <span style={{ color: currentView.department.accent }}>{currentView.department.name}</span>
        </div>
      }
      actions={
        <div
          className="inline-flex items-center gap-2 rounded-[8px] border px-3 py-1.5 text-[12px]"
          style={{
            borderColor: `${currentView.department.accent}42`,
            background: `${currentView.department.accent}12`,
            color: currentView.department.accent,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: currentView.department.accent }} />
          {currentView.header.status.label}
        </div>
      }
      left={
        <ShangshufangRailPanel
          title={`${currentView.department.name}各司`}
          subtitle="先选下属专司，再看具体事项。"
          accent={currentView.department.accent}
        >
          <div className="space-y-3">
            {showEmptyState && currentView.emptyState ? (
              <RailSectionRenderer
                section={{
                  id: 'empty-state',
                  title: currentView.emptyState.title,
                  subtitle: currentView.emptyState.actionLabel,
                  kind: 'empty',
                  items: [
                    {
                      id: 'empty-state-body',
                      label: currentView.emptyState.actionLabel ?? '待命',
                      body: currentView.emptyState.body,
                      tone: 'blue',
                    },
                  ],
                }}
              />
            ) : null}
            {currentView.leftRail.map((section) => (
              <RailSectionRenderer
                key={section.id}
                section={section}
                selectedItemId={selectedRailItemId}
                onItemSelect={previewRailItem}
              />
            ))}
          </div>
        </ShangshufangRailPanel>
      }
      center={
        <div className="h-full min-h-0">
          <EdictStage
            view={currentView.mainEdict}
            customBodyScroll="styled"
            footer={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {actionError ? <span className="mr-auto text-[11px] text-[#FFB0B0]">{actionError}</span> : null}
                {currentView.department.code === 'finance' && !showHubuBudgetIntake ? (
                  <Link
                    href="/liubu/hubu?newBudget=1"
                    className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#F0C66A]/35 bg-[#F0C66A]/10 px-3 text-[12px] font-semibold text-[#F4D98C] transition hover:brightness-110"
                  >
                    研发预算承办
                  </Link>
                ) : null}
                {currentView.commandBar.map((command) => (
                  <CommandButton
                    key={command.id}
                    command={command}
                    pending={pendingAction === command.id}
                    onRun={runCommand}
                  />
                ))}
              </div>
            }
          >
            {showHubuBudgetCase && focusTaskId ? (
              <HubuBudgetCaseBody taskId={focusTaskId} accent={currentView.department.accent} />
            ) : showHubuBudgetIntake ? (
              <HubuBudgetIntakeBody accent={currentView.department.accent} />
            ) : showLifuOfficeDesk ? (
              <LifuOfficeDesk />
            ) : null}
          </EdictStage>
        </div>
      }
      right={
        <ShangshufangRailPanel
          title={`${currentView.department.name}关注`}
          subtitle="当前状态、待办、风险、依据和缺口。"
          accent={currentView.department.accent}
        >
          <div className="space-y-3">
            {currentView.rightRail.map((section) => (
              <RailSectionRenderer
                key={section.id}
                section={section}
                selectedItemId={selectedRailItemId}
                onItemSelect={previewRailItem}
              />
            ))}
          </div>
        </ShangshufangRailPanel>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] tracking-[0.14em] text-[#7C86A6]">
          <span>{currentView.integrity.sourceLabel}</span>
          <span>{currentView.integrity.mode === 'fallback' ? '待接真链' : currentView.integrity.mode === 'partial' ? '部分真实' : '实时数据'}</span>
        </div>
      }
    />
  );
}

export function DepartmentPageViewLoading({ code }: { code: DepartmentPageCode | string }) {
  return (
    <ShangshufangLayoutShell
      eyebrow="DEPARTMENT VIEW"
      title="六部案卷加载中"
      subtitle={`正在调取 ${code} 的部门页面数据。`}
      left={<ShangshufangRailPanel title="左批" accent="#F0C66A"><div className="h-32 animate-pulse rounded-[8px] bg-white/[0.04]" /></ShangshufangRailPanel>}
      center={
        <div className="flex h-full min-h-[520px] items-center justify-center rounded-[8px] border border-[#F0C66A]/20 bg-black/30">
          <div className="flex items-center gap-2 text-[13px] text-[#F0C66A]">
            <Loader2 size={16} className="animate-spin" />
            调取部门案卷
          </div>
        </div>
      }
      right={<ShangshufangRailPanel title="右批" accent="#F0C66A"><div className="h-32 animate-pulse rounded-[8px] bg-white/[0.04]" /></ShangshufangRailPanel>}
    />
  );
}

export function DepartmentPageViewError({ code, message }: { code: DepartmentPageCode | string; message: string }) {
  return (
    <ShangshufangLayoutShell
      eyebrow="DEPARTMENT VIEW"
      title="部门案卷暂不可用"
      subtitle={`${code} 页面数据读取失败：${message}`}
      left={<ShangshufangRailPanel title="左批" accent="#F0C66A"><div className="text-[12px] leading-6 text-[#C8CDD8]">请稍后重试。</div></ShangshufangRailPanel>}
      center={
        <div className="flex h-full min-h-[520px] items-center justify-center rounded-[8px] border border-[#FF8A8A]/25 bg-[#FF8A8A]/[0.06] px-6 text-center text-[13px] leading-6 text-[#FFD0D0]">
          当前无法生成部门页面视图，但页面壳不会白屏。
        </div>
      }
      right={<ShangshufangRailPanel title="右批" accent="#F0C66A"><div className="text-[12px] leading-6 text-[#C8CDD8]">错误已限制在取数层。</div></ShangshufangRailPanel>}
    />
  );
}
