/**
 * 健康中心 · 干预计划时间轴
 *
 * 水平时间轴 + 分类图标 + 状态追踪
 */

'use client';

import {
  Activity,
  Apple,
  Pill,
  Stethoscope,
  Moon,
  MessageSquare,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EmptyState } from '@/features/shared/components/imperial/empty-state';
import type {
  InterventionPlan,
  InterventionAction,
  InterventionCategory,
} from '@/types/health';

const CATEGORY_META: Record<
  InterventionCategory,
  { label: string; color: string; Icon: typeof Activity }
> = {
  medication: { label: '用药', color: '#F43F5E', Icon: Pill },
  exercise: { label: '运动', color: '#3DD68C', Icon: Activity },
  diet: { label: '饮食', color: '#F0C66A', Icon: Apple },
  checkup: { label: '复查', color: '#60A5FA', Icon: Stethoscope },
  lifestyle: { label: '作息', color: '#B794F4', Icon: Moon },
  consult: { label: '咨询', color: '#6BA0FF', Icon: MessageSquare },
};

const ACTION_STATUS_STYLE: Record<
  InterventionAction['status'],
  { label: string; color: string }
> = {
  planned: { label: '计划中', color: '#9AA3C4' },
  in_progress: { label: '进行中', color: '#F0C66A' },
  done: { label: '已完成', color: '#3DD68C' },
  skipped: { label: '已跳过', color: '#484F72' },
};

export interface InterventionTimelineProps {
  plans: InterventionPlan[];
}

export function InterventionTimeline({ plans }: InterventionTimelineProps) {
  if (plans.length === 0) {
    return (
      <GlassPanel tone="elevated" padding="md">
        <EmptyState
          icon={Activity}
          title="当前还没有干预计划"
          body="等太医院形成阶段性建议后，这里会出现按时间排布的用药、运动、饮食与复查计划。"
        />
      </GlassPanel>
    );
  }

  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Intervention Plan Timeline
          </div>
          <h3 className="text-[13px] font-bold text-[#EAEEFB]">健康干预时间轴</h3>
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px]">
          {(['medication', 'exercise', 'diet', 'checkup', 'lifestyle'] as InterventionCategory[]).map(
            (c) => {
              const m = CATEGORY_META[c];
              return (
                <span key={c} className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  <span style={{ color: m.color }}>{m.label}</span>
                </span>
              );
            },
          )}
        </div>
      </div>

      <div className="space-y-5">
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
      </div>
    </GlassPanel>
  );
}

function PlanRow({ plan }: { plan: InterventionPlan }) {
  const start = new Date(plan.scheduledAt);
  const end = new Date(start.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  const doneCount = plan.actions.filter((a) => a.status === 'done').length;
  const progressPct = Math.round((doneCount / Math.max(1, plan.actions.length)) * 100);

  return (
    <div>
      {/* 计划头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-[#F0C66A]" />
          <div>
            <h4 className="text-[12px] font-bold text-[#EAEEFB]">{plan.title}</h4>
            <div className="font-mono text-[9px] text-[#6A7299]">
              {start.toLocaleDateString('zh-CN')} → {end.toLocaleDateString('zh-CN')} ·
              {' '}
              {plan.durationDays} 天
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[14px] font-bold text-[#F0C66A]">
            {progressPct}%
          </div>
          <div className="text-[9px] text-[#6A7299]">
            {doneCount} / {plan.actions.length}
          </div>
        </div>
      </div>

      {/* 水平轴 */}
      <div className="relative mb-3 h-1 rounded-full" style={{ backgroundColor: 'rgba(26, 33, 66, 0.8)' }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #3DD68C, #F0C66A)',
            boxShadow: '0 0 8px rgba(240, 198, 106, 0.5)',
          }}
        />
      </div>

      {/* Action 卡片列 */}
      <div className="grid grid-cols-4 gap-2">
        {plan.actions.map((action, idx) => (
          <ActionNode key={action.id} action={action} index={idx} />
        ))}
      </div>
    </div>
  );
}

function ActionNode({ action, index }: { action: InterventionAction; index: number }) {
  const meta = CATEGORY_META[action.category];
  const statusStyle = ACTION_STATUS_STYLE[action.status];
  const Icon = meta.Icon;
  const isDone = action.status === 'done';

  return (
    <div
      className="relative overflow-hidden rounded-md border p-2.5"
      style={{
        borderColor: `${meta.color}40`,
        backgroundColor: 'rgba(10, 14, 30, 0.5)',
      }}
    >
      {/* 序号 */}
      <span className="font-mono text-[9px] text-[#484F72]">
        WEEK {index + 1}
      </span>

      {/* 图标 */}
      <div
        className="mt-1 flex h-6 w-6 items-center justify-center rounded"
        style={{
          backgroundColor: `${meta.color}15`,
          border: `1px solid ${meta.color}40`,
        }}
      >
        <Icon size={11} style={{ color: meta.color }} />
      </div>

      {/* 描述 */}
      <div className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#EAEEFB]">
        {action.description}
      </div>

      {/* 状态 */}
      <div className="mt-2 flex items-center gap-1 text-[9px]">
        {isDone ? (
          <CheckCircle2 size={9} style={{ color: statusStyle.color }} />
        ) : (
          <Clock size={9} style={{ color: statusStyle.color }} />
        )}
        <span style={{ color: statusStyle.color }}>{statusStyle.label}</span>
      </div>
    </div>
  );
}
