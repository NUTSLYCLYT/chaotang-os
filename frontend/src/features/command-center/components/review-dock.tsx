'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Gavel, ShieldCheck, TimerReset } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ApprovalActionBar } from '@/components/interactive/approval-action-bar';
import type { ApprovalAction } from '@/components/interactive/approval-action-bar';
import type { Task } from '@/types/task';

export interface ReviewDockProps {
  task: Task;
}

const REVIEWABLE_STATUSES: Task['status'][] = [
  'report_ready',
  'aggregating',
  'planning',
];

export function ReviewDock({ task }: ReviewDockProps) {
  const [pending, setPending] = useState<ApprovalAction | null>(null);
  const [lastAction, setLastAction] = useState<{
    action: ApprovalAction;
    comment: string;
    at: string;
  } | null>(null);

  const reviewable = REVIEWABLE_STATUSES.includes(task.status);
  const readiness = deriveReviewReadiness(task.status);
  const checks = deriveReviewChecks(task.status);

  const handle = (action: ApprovalAction) => (comment: string) => {
    setPending(action);
    // mock latency
    setTimeout(() => {
      setLastAction({ action, comment, at: new Date().toISOString() });
      setPending(null);
      // 金玺落印 · 按决定类型
      if (typeof window !== 'undefined') {
        const verdict =
          action === 'approve' ? '准' : action === 'reject' ? '驳' : '再议';
        window.dispatchEvent(
          new CustomEvent('court:seal-stamp', {
            detail: { verdict, note: comment ? comment.slice(0, 12) : undefined },
          }),
        );
        // approve → 1.1s 后金花撒落 · 归档庆典（登朝/落印/归档三部曲的第三幕）
        if (action === 'approve') {
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('court:archive-ceremony', {
                detail: {
                  title: task.title,
                  note: comment ? comment.slice(0, 16) : '陛下圣明 · 此案归档',
                },
              }),
            );
          }, 1100);
        }
      }
    }, 600);
  };

  if (!reviewable) {
    return (
      <GlassPanel tone="flat" padding="md">
        <div className="section-eyebrow flex items-center gap-2 text-[#8f835f]">
          <Gavel size={11} />
          御批 · 任务尚未到批示阶段
        </div>
        <div className="body-copy mt-2 text-[12px] text-[#8f835f]">
          丞相建议：此刻不必急着下判断。先等呈报成形，再做御前裁定。
        </div>
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[11px] leading-6 text-[#9AA3C4]">
          当前节奏：先让军机处把问题压清、把执行结果收回来，再决定是否值得御前拍板。
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-2">
      <div className="section-eyebrow flex items-center gap-2 text-[#F0C66A]">
        <Gavel size={11} />
        Imperial Review · 御批
      </div>
      <div className="rounded-xl border border-[#F0C66A]/12 bg-[#F0C66A]/[0.03] px-4 py-3 text-[11px] leading-6 text-[#C8CDD8]">
        丞相建议：现在看的不是“过程好不好看”，而是结论是否足够支撑批示。
      </div>
      <div
        className="rounded-xl border px-4 py-4"
        style={{
          borderColor: readiness.border,
          background: readiness.background,
        }}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: readiness.color }}>
          {readiness.icon}
          {readiness.title}
        </div>
        <div className="mt-2 text-[11px] leading-6 text-[#C8CDD8]">{readiness.body}</div>
      </div>
      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#8F835F]">裁断前检查</div>
        <div className="mt-3 space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/15 px-3 py-3 text-[11px]"
            >
              <span className="text-[#D9CFB4]">{check.label}</span>
              <span className={check.done ? 'text-[#3DD68C]' : 'text-[#F5A524]'}>
                {check.done ? '已具备' : '待补足'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <ApprovalActionBar
        taskId={task.id}
        pendingAction={pending}
        onApprove={handle('approve')}
        onInquire={handle('inquire')}
        onReject={handle('reject')}
      />
      <div className="flex flex-wrap gap-2">
        <Link
          href={task.status === 'report_ready' ? '/governance' : '/manors'}
          className="rounded-full border border-[#F0C66A]/35 bg-[#F0C66A]/12 px-3 py-2 text-[11px] text-[#F0C66A] transition hover:bg-[#F0C66A]/18"
        >
          {task.status === 'report_ready' ? '裁断后送三省治理流' : '先去执行层继续收束'}
        </Link>
        <Link
          href={
            task.status === 'report_ready' && task.finalReportId
              ? `/present/${task.finalReportId}`
              : task.status === 'report_ready'
              ? `/scribe/${task.id}`
              : '/command-center'
          }
          className="rounded-full border border-white/10 px-3 py-2 text-[11px] text-[#EAEEFB] transition hover:bg-white/5"
        >
          {task.status === 'report_ready' ? '查看呈报与演示路径' : '继续留在军机处'}
        </Link>
      </div>
      {lastAction && (
        <div className="rounded-md border border-white/5 bg-black/30 px-3 py-2 text-[10px] text-[#9AA3C4]">
          <span className="text-[#3DD68C]">已记录</span> · {lastAction.action} ·{' '}
          {new Date(lastAction.at).toLocaleTimeString('zh-CN')}
          {lastAction.comment && (
            <span className="text-[#6A7299]"> · {lastAction.comment}</span>
          )}
        </div>
      )}
    </div>
  );
}

function deriveReviewReadiness(status: Task['status']) {
  if (status === 'report_ready') {
    return {
      title: '现在就是裁断窗口',
      body: '案件已经形成呈报。继续停在军机处的收益很低，最值钱的动作是做批准、追问或驳回。',
      color: '#F0C66A',
      border: 'rgba(240,198,106,0.25)',
      background: 'rgba(240,198,106,0.06)',
      icon: <ShieldCheck size={13} />,
    };
  }

  if (status === 'aggregating') {
    return {
      title: '接近裁断，但还要再收一层',
      body: '结果正在回收与汇总。可以提前准备批示标准，但不要在结论还没成形时过早拍板。',
      color: '#6BA0FF',
      border: 'rgba(107,160,255,0.22)',
      background: 'rgba(107,160,255,0.06)',
      icon: <TimerReset size={13} />,
    };
  }

  return {
    title: '当前更像预审，而不是终裁',
    body: '此时的御批更适合指出要补什么、问什么，而不是直接给出最终结论。',
    color: '#F58B8B',
    border: 'rgba(245,139,139,0.22)',
    background: 'rgba(245,139,139,0.06)',
    icon: <AlertTriangle size={13} />,
  };
}

function deriveReviewChecks(status: Task['status']) {
  return [
    {
      label: '案件已从拆解转入结果收束阶段',
      done: status === 'aggregating' || status === 'report_ready' || status === 'reviewed',
    },
    {
      label: '当前已有足够材料支持御前动作',
      done: status === 'report_ready' || status === 'reviewed',
    },
    {
      label: '已能判断是送治理还是继续执行',
      done: status === 'planning' || status === 'aggregating' || status === 'report_ready' || status === 'reviewed',
    },
  ];
}
