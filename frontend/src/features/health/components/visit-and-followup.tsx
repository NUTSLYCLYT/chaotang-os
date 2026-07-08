/**
 * 健康中心 · 就诊建议 + 复查提醒（双卡）
 */

'use client';

import { Stethoscope, CalendarCheck, ChevronRight, Clock } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EmptyState } from '@/features/shared/components/imperial/empty-state';
import type {
  VisitRecommendation,
  FollowupReminder,
  HealthRiskLevel,
} from '@/types/health';

const URGENCY_STYLE: Record<HealthRiskLevel, { label: string; color: string }> = {
  normal: { label: '常规', color: '#3DD68C' },
  watch: { label: '建议', color: '#F0C66A' },
  warning: { label: '尽快', color: '#F5A524' },
  danger: { label: '急诊', color: '#F43F5E' },
};

export interface VisitRecommendationListProps {
  recommendations: VisitRecommendation[];
}

export function VisitRecommendationList({ recommendations }: VisitRecommendationListProps) {
  return (
    <GlassPanel tone="elevated" padding="md" className="h-full">
      <div className="mb-3 flex items-center gap-2">
        <Stethoscope size={13} className="text-[#60A5FA]" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Visit Recommendations
          </div>
          <h3 className="text-[13px] font-bold text-[#EAEEFB]">就诊建议</h3>
        </div>
      </div>

      <div className="space-y-2">
        {recommendations.length === 0 && (
          <EmptyState
            icon={Stethoscope}
            title="当前无需新增就诊安排"
            body="现有指标暂未触发新的线下就诊建议，可先继续观察、记录指标并维持既有干预。"
          />
        )}
        {recommendations.map((rec) => {
          const style = URGENCY_STYLE[rec.urgency];
          return (
            <div
              key={rec.id}
              className="rounded-md border p-3 transition-colors hover:bg-white/[0.03]"
              style={{ borderColor: `${style.color}40` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[12px] font-bold text-[#EAEEFB]">{rec.department}</h4>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                      style={{
                        backgroundColor: `${style.color}15`,
                        color: style.color,
                      }}
                    >
                      {style.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px]" style={{ color: '#9AA3C4' }}>
                    {rec.specialty}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#9AA3C4]">
                    {rec.reason}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[9px] text-[#F0C66A]">
                    <Clock size={9} />
                    <span>建议 {rec.suggestedWithinDays} 天内就诊</span>
                  </div>
                </div>
                <ChevronRight size={12} className="mt-0.5 flex-shrink-0 text-[#484F72]" />
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

/* ========================================================================== */

export interface FollowupReminderListProps {
  reminders: FollowupReminder[];
}

export function FollowupReminderList({ reminders }: FollowupReminderListProps) {
  const sorted = [...reminders].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

  return (
    <GlassPanel tone="elevated" padding="md" className="h-full">
      <div className="mb-3 flex items-center gap-2">
        <CalendarCheck size={13} className="text-[#F0C66A]" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">
            Follow-up Reminders
          </div>
          <h3 className="text-[13px] font-bold text-[#EAEEFB]">复查提醒</h3>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <EmptyState
            icon={CalendarCheck}
            title="当前没有待办复查"
            body="等新的随访节点生成后，这里会提醒下一次检查、复诊或复测时间。"
          />
        )}
        {sorted.map((r) => {
          const dueDate = new Date(r.dueAt);
          const daysLeft = Math.ceil(
            (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          const urgent = daysLeft <= 14 && !r.completed;

          return (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-md border p-3"
              style={{
                borderColor: urgent ? 'rgba(245, 165, 36, 0.45)' : 'rgba(26, 33, 66, 0.8)',
                backgroundColor: urgent ? 'rgba(245, 165, 36, 0.06)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-col items-center justify-center rounded"
                  style={{
                    backgroundColor: urgent ? 'rgba(245, 165, 36, 0.15)' : 'rgba(26, 33, 66, 0.6)',
                    border: urgent ? '1px solid rgba(245, 165, 36, 0.4)' : '1px solid rgba(26, 33, 66, 0.8)',
                  }}
                >
                  <div
                    className="font-mono text-[10px] font-bold leading-none"
                    style={{ color: urgent ? '#F5A524' : '#9AA3C4' }}
                  >
                    {dueDate.getDate()}
                  </div>
                  <div className="text-[8px] leading-none text-[#6A7299]">
                    {dueDate.toLocaleDateString('zh-CN', { month: 'short' })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#EAEEFB]">{r.title}</div>
                  <div className="text-[9px]" style={{ color: urgent ? '#F5A524' : '#6A7299' }}>
                    {r.completed
                      ? '已完成'
                      : daysLeft > 0
                        ? `${daysLeft} 天后`
                        : daysLeft === 0
                          ? '今日'
                          : `已过期 ${-daysLeft} 天`}
                  </div>
                </div>
              </div>
              {r.completed && (
                <span className="text-[9px] text-[#3DD68C]">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
