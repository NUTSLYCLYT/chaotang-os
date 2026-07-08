/**
 * ForecastScenarioCard — 钦天监情景卡
 *
 * 展示 A/B/C 情景之一，包含概率、置信度、收益描述、触发条件数
 */

import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ConfidenceRing } from '@/components/status/confidence-ring';
import type { ForecastScenario, ScenarioName } from '@/types/forecast';

export interface ForecastScenarioCardProps {
  scenario: ForecastScenario;
  isActive?: boolean;
  onSelect?: () => void;
}

const SCENARIO_STYLE: Record<
  ScenarioName,
  { label: string; color: string; Icon: typeof TrendingUp }
> = {
  optimistic: { label: '乐观情景', color: '#3DD68C', Icon: TrendingUp },
  base: { label: '基准情景', color: '#F0C66A', Icon: Minus },
  pessimistic: { label: '悲观情景', color: '#F43F5E', Icon: TrendingDown },
};

export function ForecastScenarioCard({
  scenario,
  isActive,
  onSelect,
}: ForecastScenarioCardProps) {
  const style = SCENARIO_STYLE[scenario.name];
  const Icon = style.Icon;
  const probPct = Math.round(scenario.probability * 100);

  return (
    <div
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <GlassPanel
        tone="elevated"
        padding="md"
        hudCorners={isActive}
        glow={isActive}
        className="cursor-pointer transition-all hover:scale-[1.01]"
        style={{
          borderColor: isActive ? `${style.color}aa` : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {/* 情景名 */}
            <div className="flex items-center gap-2">
              <Icon size={14} style={{ color: style.color }} strokeWidth={2} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: style.color }}>
                {scenario.name}
              </span>
            </div>
            <h3 className="mt-1 text-[15px] font-bold" style={{ color: style.color }}>
              {scenario.label || style.label}
            </h3>

            {/* 概率条 */}
            <div className="mt-3">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[9px] text-[#6A7299]">发生概率</span>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-mono text-[20px] font-bold"
                    style={{ color: style.color }}
                  >
                    {probPct}
                  </span>
                  <span className="text-[9px] text-[#6A7299]">%</span>
                </div>
              </div>
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgba(26, 33, 66, 0.8)' }}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${probPct}%`,
                    backgroundColor: style.color,
                    boxShadow: `0 0 8px ${style.color}88`,
                  }}
                />
              </div>
            </div>

            {/* 收益描述 */}
            <div className="mt-3 rounded px-2 py-1.5 text-[11px]"
              style={{
                backgroundColor: `${style.color}10`,
                color: style.color,
              }}
            >
              预期收益：{scenario.payoffDescription}
            </div>

            {/* 时间范围 */}
            <div className="mt-2 flex items-center gap-1 font-mono text-[9px] text-[#6A7299]">
              <Clock size={9} />
              {new Date(scenario.timeframe.start).toLocaleDateString('zh-CN')}
              {' → '}
              {new Date(scenario.timeframe.end).toLocaleDateString('zh-CN')}
            </div>
          </div>

          {/* 置信度圆环 */}
          <div className="flex-shrink-0">
            <ConfidenceRing value={scenario.confidence} size={56} />
            <div className="mt-1 text-center text-[9px] text-[#6A7299]">置信度</div>
          </div>
        </div>

        {/* 触发条件 / 风险窗口 汇总 */}
        <div
          className="mt-3 flex items-center justify-between border-t pt-2 text-[9px]"
          style={{ borderColor: 'rgba(26, 33, 66, 0.6)', color: '#484F72' }}
        >
          <span>{scenario.triggerConditions.length} 项触发条件</span>
          <span>{scenario.riskWindows.length} 个风险窗口</span>
          <span>{scenario.preActions.length} 条预行动</span>
        </div>
      </GlassPanel>
    </div>
  );
}
