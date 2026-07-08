/**
 * 朝堂 OS V2 · 史馆 · 中栏任务详情
 *
 * 包含：任务头卡 + 参与部门 + 生命周期时间线。
 * 从 scribe/page.tsx 抽出；修正原来的 `nameZh` → `nameCn` 字段错误。
 */

'use client';

import Link from 'next/link';
import { Clock, GitBranch } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AGENT_META } from '@/types/agent';
import type { Task } from '@/types/task';
import { TaskStatusBadge } from './task-status-badge';
import { SectionLabel } from './section-label';
import { ManorReportSection } from './manor-report-section';
import { executionModeInPlainWords, taskTypeInPlainWords } from '@/features/throne/lib/plain-language';

export interface ScribeTaskDetailProps {
  task: Task;
}

export function ScribeTaskDetail({ task }: ScribeTaskDetailProps) {
  const agents = task.plan?.assignedAgents ?? [];

  return (
    <div className="space-y-5">
      <GlassPanel tone="elevated" padding="md" hudCorners>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-[#6A7299]">Task Record</div>
            <h2 className="mt-1 text-[16px] font-bold text-[#EAEEFB]">{task.title}</h2>
            {task.description && (
              <p className="mt-1.5 text-[11px] text-[#9AA3C4]">{task.description}</p>
            )}
          </div>
          <TaskStatusBadge status={task.status} />
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-[#1A2142] pt-3">
          <Metric label="类型" value={task.plan?.taskType ? taskTypeInPlainWords(task.plan.taskType) : '—'} />
          <Metric label="执行模式" value={executionModeInPlainWords(task.mode)} />
          <Metric
            label="归档时间"
            value={new Date(task.updatedAt).toLocaleDateString('zh-CN')}
          />
        </div>
      </GlassPanel>

      {/* 参与部门 */}
      <GlassPanel tone="elevated" padding="md">
        <SectionLabel icon={<GitBranch size={13} className="text-[#F0C66A]" />}>
          Participating Departments · 参与部门
        </SectionLabel>
        <div className="flex flex-wrap gap-2">
          {agents.length === 0 && (
            <div className="text-[11px] text-[#6A7299]">此任务无编排记录</div>
          )}
          {agents.map((code) => {
            const meta = AGENT_META[code];
            return (
              <Link
                key={code}
                href="/departments"
                className="flex items-center gap-1.5 rounded-md border border-[#1A2142] bg-[rgba(10,14,30,0.5)] px-2.5 py-1.5 transition-colors hover:border-[#F0C66A]/50"
              >
                <span className="text-sm">{meta?.emoji ?? '◆'}</span>
                <span className="text-[11px] text-[#EAEEFB]">{meta?.nameCn ?? code}</span>
              </Link>
            );
          })}
        </div>
      </GlassPanel>

      {/* 庄园研判报告 */}
      {task.manorReport && <ManorReportSection report={task.manorReport} />}

      {/* 生命周期 */}
      <GlassPanel tone="elevated" padding="md">
        <SectionLabel icon={<Clock size={13} className="text-[#93C5FD]" />}>
          Lifecycle Timeline · 生命周期
        </SectionLabel>
        <div className="relative space-y-3 border-l border-[#1A2142] pl-4">
          <TimelineEntry label="任务创建" time={task.createdAt} active />
          <TimelineEntry label="丞相研判" time={task.createdAt} active />
          <TimelineEntry label="部门执行" time={task.updatedAt} active />
          <TimelineEntry
            label="报告汇总"
            time={task.updatedAt}
            active={task.status !== 'running'}
          />
          <TimelineEntry
            label="批示归档"
            time={task.updatedAt}
            active={task.status === 'archived'}
          />
        </div>
      </GlassPanel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-[#EAEEFB]">{value}</div>
    </div>
  );
}

function TimelineEntry({ label, time, active }: { label: string; time: string; active: boolean }) {
  return (
    <div className="relative">
      <div
        className="absolute -left-[21px] top-1 h-2 w-2 rounded-full"
        style={{
          backgroundColor: active ? '#F0C66A' : '#484F72',
          boxShadow: active ? '0 0 8px rgba(240, 198, 106, 0.6)' : 'none',
        }}
      />
      <div className="text-[11px] text-[#EAEEFB]">{label}</div>
      <div className="font-mono text-[11px] text-[#6A7299]">
        {new Date(time).toLocaleString('zh-CN')}
      </div>
    </div>
  );
}
