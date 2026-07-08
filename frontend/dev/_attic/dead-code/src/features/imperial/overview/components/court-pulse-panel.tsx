/**
 * 朝堂 OS V2 · 大殿 · 朝堂脉搏（替代钦天监位置 · 更重要的信息）
 *
 * 给陛下右侧 4 列的"今日必看"：
 *   - 上半 3 张急事卡（危急信号 / 最紧任务 / 健康异常，按严重度排序）
 *   - 下半 4 个指标块（活跃 / 红信号 / 待御批 / 健康）
 *
 * 每张急事卡带一键跳转按钮。
 */

'use client';

import Link from 'next/link';
import {
  AlertOctagon,
  Activity,
  Heart,
  Flame,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { formatHealthRiskLevel } from '@/types/health';
import type { IntelSignal } from '@/types/intel';
import type { HealthProfile } from '@/types/health';
import type { Task } from '@/types/task';
import type { AsyncState } from '@/types/async-state';

interface UrgentItem {
  rank: number;
  icon: LucideIcon;
  accent: string;
  badge: string;
  title: string;
  summary: string;
  reason: string; // 为什么此刻出现在脉搏上 · 可信度来源
  cta: { label: string; href: string };
}

export interface CourtPulsePanelProps {
  quadrant: AsyncState<{ signals: IntelSignal[]; health: HealthProfile }>;
  currentTask: Task | null;
  pendingCount: number;
  activeCount: number;
  totalAgents?: number;
}

export function CourtPulsePanel({
  quadrant,
  currentTask,
  pendingCount,
  activeCount,
  totalAgents = 11,
}: CourtPulsePanelProps) {
  const isReady = quadrant.status === 'ready';
  const signals = isReady ? quadrant.data.signals : [];
  const health = isReady ? quadrant.data.health : null;

  const critical = signals.find((s) => s.level === 'critical');
  const warning = signals.find((s) => s.level === 'warning');
  const redCount = signals.filter(
    (s) => s.level === 'critical' || s.level === 'warning',
  ).length;
  const healthScore = health?.totalScore ?? null;
  const healthRisk = health?.riskLevel ?? null;
  const healthIsHigh = healthRisk === 'danger' || healthRisk === 'warning';

  // 构造 TOP 3 急事 · 严格按优先级
  const items: UrgentItem[] = [];
  if (critical) {
    items.push({
      rank: 1,
      icon: AlertOctagon,
      accent: '#F43F5E',
      badge: '危急情报',
      title: critical.title,
      summary: critical.regionLabel
        ? `${critical.regionLabel} · ${critical.summary?.slice(0, 40) ?? '需立即关注'}`
        : critical.summary?.slice(0, 54) ?? '锦衣卫紧急上报',
      reason: '锦衣卫 critical 等级上报 · 风险打分 ≥ 80',
      cta: { label: '进情报台', href: '/intel' },
    });
  }
  if (currentTask && currentTask.status === 'report_ready') {
    items.push({
      rank: items.length + 1,
      icon: Flame,
      accent: '#F0C66A',
      badge: '待御批',
      title: currentTask.title,
      summary: '丞相报告已就绪 · 请陛下一锤定音',
      reason: '丞相总批流程已聚合完成 · 等候陛下落印',
      cta: {
        label: '御前简报',
        href: currentTask.id ? `/throne/brief/${currentTask.id}` : '/throne',
      },
    });
  }
  if (healthIsHigh) {
    items.push({
      rank: items.length + 1,
      icon: Heart,
      accent: '#3DD68C',
      badge: '太医院',
      title: `风险等级 · ${formatHealthRiskLevel(healthRisk)}`,
      summary: `体征 ${healthScore ?? '--'}/100 · 请过太医院查脉案`,
      reason: `综合超时率 + 阻塞数 + 未归档积压 · 风险 ≥ warning 阈值`,
      cta: { label: '进太医院', href: '/health' },
    });
  }
  if (warning && items.length < 3) {
    items.push({
      rank: items.length + 1,
      icon: Activity,
      accent: '#FB923C',
      badge: '风险信号',
      title: warning.title,
      summary: warning.summary?.slice(0, 54) ?? '锦衣卫持续监测',
      reason: '锦衣卫 warning 等级上报 · 风险 50-80 · 建议 24h 内处置',
      cta: { label: '进情报台', href: '/intel' },
    });
  }

  // 若尚无急事（朝堂平稳），给一个"平稳"占位
  const hasNoUrgent = items.length === 0;

  return (
    <GlassPanel variant="gold" tone="deep" padding="md" hudCorners className="overflow-hidden">
      {/* Header · 右侧栏紧凑版 */}
      <div className="space-y-2 border-b border-white/8 pb-3">
        <div
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1"
          style={{
            borderColor: hasNoUrgent ? 'rgba(61,214,140,0.35)' : 'rgba(244,63,94,0.35)',
            background: hasNoUrgent ? 'rgba(61,214,140,0.1)' : 'rgba(244,63,94,0.1)',
          }}
        >
          <span
            className={`h-2 w-2 rounded-full ${!hasNoUrgent ? 'animate-pulse' : ''}`}
            style={{
              background: hasNoUrgent ? '#3DD68C' : '#F43F5E',
              boxShadow: `0 0 8px ${hasNoUrgent ? '#3DD68C' : '#F43F5E'}`,
            }}
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.3em]"
            style={{ color: hasNoUrgent ? '#3DD68C' : '#F43F5E' }}
          >
            Court Pulse · 朝堂脉搏
          </span>
        </div>
        <h3
          className="text-[13.5px] font-bold tracking-[0.04em]"
          style={{ color: '#F5E9C9', fontFamily: '"Noto Serif SC", serif' }}
        >
          {hasNoUrgent ? '朝堂平稳 · 暂无急章' : `眼下 ${items.length} 件最需陛下留意`}
        </h3>
        {/* 4 指标 · 2x2 grid 适配右栏窄幅 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
          <InlineStat label="在办" value={`${activeCount}/${totalAgents}`} color="#F0C66A" pulse={activeCount > 0} />
          <InlineStat label="红信号" value={`${redCount}`} color={redCount > 0 ? '#F43F5E' : '#8A92AC'} pulse={redCount > 0} />
          <InlineStat label="待御批" value={`${pendingCount}`} color={pendingCount > 0 ? '#F0C66A' : '#8A92AC'} />
          <InlineStat
            label="体征"
            value={healthScore !== null ? `${healthScore}` : '—'}
            color={
              healthRisk === 'danger'
                ? '#F43F5E'
                : healthRisk === 'warning'
                  ? '#FB923C'
                  : '#3DD68C'
            }
          />
        </div>
      </div>

      {/* TOP 3 急事 · 1 列纵向（右侧面板更紧凑） */}
      <div className="mt-3 space-y-2">
        {hasNoUrgent ? (
          <div className="rounded-xl border border-[#3DD68C]/15 bg-[#3DD68C]/[0.04] px-4 py-3 text-center text-[13px] leading-6 text-[#A7D9C0]">
            今日暂无急章，可直接下新旨或回看待批事项。
          </div>
        ) : (
          items.slice(0, 3).map((item) => <UrgentRow key={item.rank} item={item} />)
        )}
      </div>

    </GlassPanel>
  );
}

function InlineStat({
  label,
  value,
  color,
  pulse,
}: {
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: `${color}cc` }}
      >
        {label}
      </span>
      <span
        className="font-mono text-[14px] font-black"
        style={{ color, textShadow: `0 0 6px ${color}55` }}
      >
        {value}
      </span>
      {pulse && (
        <span
          className="inline-block h-1 w-1 animate-pulse rounded-full"
          style={{ background: color }}
        />
      )}
    </div>
  );
}

function UrgentRow({ item }: { item: UrgentItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.cta.href}
      title={`为什么此刻出现 · ${item.reason}`}
      className="group flex items-center gap-3 rounded-xl border bg-white/[0.02] px-3 py-2.5 transition-all hover:bg-white/[0.05]"
      style={{ borderColor: `${item.accent}33` }}
    >
      {/* 优先级数字 */}
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-[15px] font-black"
        style={{
          background: `${item.accent}15`,
          borderColor: `${item.accent}66`,
          color: item.accent,
          textShadow: `0 0 6px ${item.accent}66`,
        }}
      >
        {item.rank}
        <Icon
          size={10}
          className="absolute -bottom-1 -right-1 rounded-full bg-[#0a0704] p-0.5"
          style={{ color: item.accent }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{
              background: `${item.accent}15`,
              borderColor: `${item.accent}55`,
              color: item.accent,
            }}
          >
            {item.badge}
          </span>
        </div>
        <div
          className="mt-1 truncate text-[13px] font-semibold leading-5"
          style={{ color: '#F5E9C9' }}
        >
          {item.title}
        </div>
        <div
          className="truncate text-[12px] leading-[15px]"
          style={{ color: '#9AA3C4' }}
        >
          {item.summary}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all group-hover:translate-x-0.5"
        style={{
          borderColor: `${item.accent}55`,
          background: `${item.accent}12`,
          color: item.accent,
        }}
      >
        {item.cta.label}
        <ChevronRight size={10} />
      </div>
    </Link>
  );
}
