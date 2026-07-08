/**
 * 朝堂 OS · 兵部 · 战略建议面板
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { StrategyRecommendation, StrategyType } from '@/lib/contracts/bingbu';

interface BingbuStrategyPanelProps {
  recommendations: StrategyRecommendation[];
}

const PRIORITY_LABELS: Record<number, string> = {
  1: '最急',
  2: '紧要',
  3: '重要',
  4: '一般',
  5: '备选',
};

export function BingbuStrategyPanel({ recommendations }: BingbuStrategyPanelProps) {
  if (recommendations.length === 0) {
    return (
      <GlassPanel tone="elevated" padding="md">
        <div className="section-eyebrow mb-1">Strategic Recommendations</div>
        <h3 className="section-title mb-3">兵部奏议</h3>
        <div className="text-[12px] text-[#6A7299]">暂无战略建议</div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="section-eyebrow mb-1">Strategic Recommendations</div>
      <h3 className="section-title mb-3">兵部奏议 · 攻防方略</h3>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </GlassPanel>
  );
}

function RecommendationCard({ rec }: { rec: StrategyRecommendation }) {
  const { color, icon, label } = strategyConfig(rec.type);
  const priorityLabel = PRIORITY_LABELS[rec.priority] ?? '一般';

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(135deg, ${color}08, rgba(0,0,0,0.25))`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
            style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}
          >
            {icon}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color }}
              >
                {label}
              </span>
              <span
                className="rounded-full border px-1.5 py-0.5 text-[10px] font-bold text-[#F5E9C9]"
                style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' }}
              >
                P{rec.priority} · {priorityLabel}
              </span>
            </div>
            <div className="mt-1 text-[13px] font-semibold text-[#F5E9C9]">{rec.title}</div>
            <div className="mt-1 text-[11px] leading-5 text-[#9AA3C4]">{rec.rationale}</div>
          </div>
        </div>
      </div>

      {/* 引用来源 */}
      {rec.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {rec.citations.map((cite, i) => (
            <span
              key={i}
              className="rounded border px-1.5 py-0.5 text-[10px] text-[#7A84A4]"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            >
              {cite}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function strategyConfig(type: StrategyType): { color: string; icon: string; label: string } {
  switch (type) {
    case 'attack':
      return { color: '#F43F5E', icon: '⚔', label: '进攻' };
    case 'defense':
      return { color: '#6BA0FF', icon: '🛡', label: '防守' };
    case 'observe':
      return { color: '#F0C66A', icon: '👁', label: '侦察' };
    case 'collaborate':
      return { color: '#3DD68C', icon: '🤝', label: '协作' };
    default:
      return { color: '#9AA3C4', icon: '·', label: type };
  }
}
