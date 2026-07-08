'use client';

import Link from 'next/link';
import { Activity, ChevronRight, Crown, Radio } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { EmptyState } from '@/features/shared/components/imperial/empty-state';
import { StatusChip } from '@/components/ui/status-chip';
import { RiskBadge } from '@/components/ui/risk-badge';
import { PrimeMinisterHub } from '@/components/effects';
import { AGENT_META, AGENT_DISPLAY_ORDER } from '@/types/agent';
import type { AgentCode, AgentRun } from '@/types/agent';
import type { Task } from '@/types/task';
import { executionModeInPlainWords } from '@/features/throne/lib/plain-language';

export function PrimeMinisterHero({
  task,
  runsCount,
  activeCount,
}: {
  task: Task | null;
  runsCount: number;
  activeCount: number;
}) {
  return (
    <GlassPanel variant="gold" tone="elevated" hudCorners glow padding="lg" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 animate-rotate-slow"
        style={{
          background:
            'conic-gradient(from 0deg, transparent, rgba(240, 198, 106, 0.08) 30%, transparent 60%, rgba(107, 160, 255, 0.08) 80%, transparent)',
        }}
      />

      <div className="relative flex items-center gap-6">
        <div className="relative flex h-[160px] w-[160px] flex-shrink-0 items-center justify-center">
          <div
            className="absolute inset-0 animate-rotate-slow rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, #F0C66A 0%, rgba(240, 198, 106, 0.4) 20%, transparent 35%, transparent 65%, rgba(107, 160, 255, 0.5) 85%, #6BA0FF 100%)',
              padding: '2px',
              mask: 'radial-gradient(circle, transparent 68%, black 70%)',
              WebkitMask: 'radial-gradient(circle, transparent 68%, black 70%)',
            }}
          />
          <div
            className="animate-breathe absolute inset-[8px] rounded-full border"
            style={{
              borderColor: 'rgba(240, 198, 106, 0.3)',
              backgroundColor: 'rgba(10, 14, 30, 0.8)',
            }}
          />
          <div className="relative flex flex-col items-center">
            <Crown size={32} className="text-[#F0C66A]" strokeWidth={1.5} />
            <div className="mt-1 gold-text text-[16px] font-bold tracking-[0.2em]">丞相</div>
            <div className="font-mono text-[11px] text-[#6A7299]">Prime Minister</div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#6A7299]">朝堂中枢</div>
            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="gold-text display-serif text-[30px] font-bold tracking-wider">朝堂总览</h1>
              <span className="font-mono text-[11px] text-[#9AA3C4]" suppressHydrationWarning>
                {new Date().toLocaleString('zh-CN')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <StatusChip state="running" label={`${activeCount} 路在办`} />
            <StatusChip state="idle" label={`${runsCount - activeCount} 待命`} />
            {task && <RiskBadge level="medium" label="1 项监控" size="sm" />}
          </div>

          <div className="rounded-md border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(240, 198, 106, 0.2)', backgroundColor: 'rgba(240, 198, 106, 0.05)' }}>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-[#9AA3C4]">
              当前密旨
            </div>
            <div className="text-[#EAEEFB]">
              {task?.title ?? '尚无密旨 — 请前往指挥台下达'}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

export function CurrentTaskCard({ task, runs }: { task: Task | null; runs: AgentRun[] }) {
  if (!task) {
    return (
      <GlassPanel tone="flat" padding="lg" className="flex h-full items-center justify-center">
        <EmptyState
          icon={Activity}
          title="当前还没有主线任务"
          body="可先去王座下达新旨，或回看待批事项；一旦案件进入军机处，这里会显示当前主线与推进状态。"
          action={{ label: '去王座下旨', href: '/throne/compose' }}
        />
      </GlassPanel>
    );
  }

  const progressPct = Math.round(
    runs.filter((r) => r.taskId === task.id).reduce((acc, r) => acc + r.progressPct, 0) /
      Math.max(1, runs.filter((r) => r.taskId === task.id).length),
  );

  return (
    <GlassPanel variant="default" tone="elevated" padding="lg" className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">当前密旨</div>
        <StatusChip state="running" size="sm" />
      </div>
      <h2 className="text-[16px] font-medium text-[#EAEEFB]">{task.title}</h2>
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#9AA3C4]">
        {task.rawCommand}
      </p>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-[#6A7299]">总体进度</span>
          <span className="font-mono text-[#F0C66A]">{progressPct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(26, 33, 66, 0.8)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #D4A84B, #F0C66A)',
              boxShadow: '0 0 12px rgba(240, 198, 106, 0.5)',
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: 'rgba(26, 33, 66, 0.6)' }}>
        <Stat label="子任务" value={runs.filter((r) => r.taskId === task.id).length} />
        <Stat label="风险项" value={runs.filter((r) => r.taskId === task.id && r.riskLevel === 'high').length} accent="#F5A524" />
        <Stat label="模式" value={executionModeInPlainWords(task.mode)} accent="#6BA0FF" />
      </div>
    </GlassPanel>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold" style={{ color: accent ?? '#EAEEFB' }}>
        {value}
      </div>
    </div>
  );
}

export function AgentMatrix({ runsByCode }: { runsByCode: Map<AgentCode, AgentRun> }) {
  return (
    <GlassPanel tone="elevated" padding="lg" hudCorners>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">协同阵列</div>
          <h3 className="text-[14px] font-medium text-[#EAEEFB]">十一路 Agent 协同矩阵</h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#9AA3C4]">
          <Activity size={12} className="text-[#F0C66A]" />
          <span>实时同步</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {AGENT_DISPLAY_ORDER.map((code) => {
          const meta = AGENT_META[code];
          const run = runsByCode.get(code);
          const state = run?.state ?? 'idle';
          const isActive = state === 'running' || state === 'summarizing';

          return (
            <div
              key={code}
              className={`relative rounded-lg border p-3 transition-all ${isActive ? 'animate-breathe' : ''}`}
              style={{
                backgroundColor:
                  state === 'idle' ? 'rgba(15, 20, 40, 0.5)' : 'rgba(20, 26, 52, 0.7)',
                borderColor: isActive ? `${meta.color}66` : 'rgba(26, 33, 66, 0.8)',
                boxShadow: isActive ? `0 0 20px ${meta.color}22` : undefined,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{meta.emoji}</span>
                  <div>
                    <div
                      className="text-[12px] font-medium"
                      style={{ color: isActive ? meta.color : '#EAEEFB' }}
                    >
                      {meta.nameCn}
                    </div>
                    <div className="font-mono text-[8px] text-[#6A7299]">{meta.nameEn}</div>
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <StatusChip state={state} size="sm" />
              </div>

              {run?.currentTaskTitle && (
                <div className="mt-2 line-clamp-1 text-[11px] text-[#9AA3C4]">
                  {run.currentTaskTitle}
                </div>
              )}

              {run && run.progressPct > 0 && (
                <div className="mt-2 h-0.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(26, 33, 66, 0.6)' }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${run.progressPct}%`,
                      backgroundColor: meta.color,
                      boxShadow: `0 0 8px ${meta.color}`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

export function PendingReviewPanel() {
  const briefs = [
    {
      unit: '户部投资军团',
      hook: '机会风险，先替陛下看清。',
      lead: '不是替陛下拍板买卖，而是先把最该盯的机会与最该防的风险摆到台前。',
      bullets: [
        '今日机会异动：哪些板块刚起风，是真起势，还是又一轮追高陷阱。',
        '风险先行信号：哪些地方表面平静，底下其实已经开始松动。',
        '资金风向变化：钱正往哪里流，哪些机会已经有人悄悄先手布局。',
      ],
      close: '先看懂风向，再决定进退；慢一步，往往差的不是一点。',
      level: 'medium' as const,
    },
    {
      unit: '太医院医圣军团',
      hook: '锻炼服药，按时替陛下提醒。',
      lead: '不是替陛下下诊断，而是把每天最容易拖延、最容易漏掉的健康动作盯紧。',
      bullets: [
        '今日服药提醒：哪一剂该按时入口，哪一个细节最容易被忽略。',
        '锻炼执行提醒：今天该动多少、怎么动，才算真在养身，不是白忙一场。',
        '医疗新进展：最近有哪些新药、新疗法、新研究，值得陛下留心跟进。',
      ],
      close: '真正拉开差距的，常常不是知道更多，而是有没有按时做到。',
      level: 'low' as const,
    },
    {
      unit: '锦衣卫情报军团',
      hook: '局势风向，第一时间替陛下梳理。',
      lead: '不是把杂音越报越多，而是先帮陛下分清什么只是热闹，什么会真正改局。',
      bullets: [
        '今日情报焦点：最值得盯住的，不一定最吵，却往往最可能改局。',
        'AI 大事速递：今天 AI 圈真正值得看的几件事，哪些会影响下一步判断。',
        '真假信号分辨：哪些消息只是过场，哪些变化已经开始落地生效。',
      ],
      close: '先看懂局，再决定跟不跟；晚一步，常常就不是同一个局了。',
      level: 'high' as const,
    },
  ];

  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">
            Prime Minister Daily Brief
          </div>
          <h3 className="text-[13px] font-medium text-[#F0C66A]">恭请陛下圣安 丞相今日裁断</h3>
        </div>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[11px]"
          style={{
            backgroundColor: 'rgba(240, 198, 106, 0.15)',
            color: '#F0C66A',
          }}
        >
          3
        </span>
      </div>

      <div className="space-y-2">
        {briefs.map((brief, index) => (
          <details
            key={brief.unit}
            open={index === 0}
            className="group rounded-md border transition-colors open:bg-white/[0.03]"
            style={{ borderColor: 'rgba(26, 33, 66, 0.6)' }}
          >
            <summary className="cursor-pointer list-none p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-[#9AA3C4]">{brief.unit}</div>
                  <div className="mt-1 display-serif text-[13px] leading-6 text-[#EAEEFB]">
                    {brief.hook}
                  </div>
                </div>
                <RiskBadge level={brief.level} size="sm" />
              </div>
            </summary>

            <div className="space-y-3 border-t px-2.5 pb-2.5 pt-2 text-[11px] leading-6 text-[#AEB7D1]" style={{ borderColor: 'rgba(26, 33, 66, 0.5)' }}>
              <p className="text-[#D9E0F4]">{brief.lead}</p>
              <ul className="space-y-1.5">
                {brief.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#F0C66A]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <p className="rounded-md border px-2 py-1.5 text-[#F5E9C9]" style={{ borderColor: 'rgba(240, 198, 106, 0.18)', backgroundColor: 'rgba(240, 198, 106, 0.06)' }}>
                {brief.close}
              </p>
            </div>
          </details>
        ))}
      </div>

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(240, 198, 106, 0.2)' }}>
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#F0C66A] transition hover:text-[#F5E9C9]"
        >
          去丞相台看今日主线
          <ChevronRight size={11} />
        </Link>
      </div>
    </GlassPanel>
  );
}

function ReviewItem({
  title,
  from,
  level,
}: {
  title: string;
  from: string;
  level: 'low' | 'medium' | 'high' | 'critical';
}) {
  return (
    <div className="rounded-md border p-2.5 transition-colors hover:bg-white/[0.03]" style={{ borderColor: 'rgba(26, 33, 66, 0.6)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="display-serif text-[13px] leading-6 text-[#EAEEFB]">{title}</div>
        <RiskBadge level={level} size="sm" />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="text-[11px] text-[#6A7299]">来自：{from}</div>
        <ChevronRight size={10} className="text-[#484F72]" />
      </div>
    </div>
  );
}

export function CentralHubPanel({
  runsByCode,
  playingScriptId,
}: {
  runsByCode: Map<AgentCode, AgentRun>;
  playingScriptId: string | null;
}) {
  return (
    <GlassPanel tone="elevated" padding="lg" hudCorners className="relative overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="section-eyebrow">Imperial Cabinet · 朝堂中枢</div>
          <h2 className="section-title gold-text mt-1 text-[20px]">
            丞相状态环
          </h2>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <PrimeMinisterHub
          runsByCode={runsByCode}
          dispatching={!!playingScriptId}
          size={560}
        />
      </div>
    </GlassPanel>
  );
}

export function LiveEventFeed() {
  const events = [
    { ts: '10:14:32', agent: '丞相', text: '已生成子任务树，分派 6 部门', tone: 'gold' },
    { ts: '10:14:28', agent: '锦衣卫', text: '欧盟 AI Act 细则更新，已上报', tone: 'danger' },
    { ts: '10:14:15', agent: '户部', text: '估值研判完成：低估区间，建议加仓', tone: 'success' },
    { ts: '10:14:02', agent: '工部', text: '技术可行性 B+，12 周可交付', tone: 'info' },
    { ts: '10:13:50', agent: '太医院', text: 'LDL 连续偏高，已生成干预计划', tone: 'warning' },
    { ts: '10:13:30', agent: '兵部', text: '竞品 A 新品发布日期逼近', tone: 'danger' },
  ];

  const toneColor: Record<string, string> = {
    gold: '#F0C66A',
    danger: '#F43F5E',
    success: '#3DD68C',
    warning: '#F5A524',
    info: '#60A5FA',
  };

  return (
    <GlassPanel tone="flat" padding="md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio size={12} className="text-[#6A7299]" />
          <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">
            Live Event Stream
          </div>
          <span className="text-[11px] text-[#8A6A2A]">◌ 演示</span>
        </div>
        <div className="text-[11px] text-[#6A7299]">最近 6 条</div>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        {events.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b py-1.5 text-[11px]"
            style={{ borderColor: 'rgba(26, 33, 66, 0.4)' }}
          >
            <span className="font-mono text-[11px] text-[#6A7299]">{e.ts}</span>
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${toneColor[e.tone]}20`,
                color: toneColor[e.tone],
              }}
            >
              {e.agent}
            </span>
            <span className="flex-1 truncate text-[#9AA3C4]">{e.text}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
