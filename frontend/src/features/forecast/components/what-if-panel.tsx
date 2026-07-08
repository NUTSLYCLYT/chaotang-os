'use client';

import { useMemo, useState } from 'react';
import { Sliders, RotateCcw, Sparkles, Share2, Check } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { colors } from '@/config/design-tokens';
import type { ForecastScenario, ScenarioName } from '@/types/forecast';
import { toast } from 'sonner';
import type { WhatIfLevers } from '@/features/forecast/lib/what-if-share';

export interface WhatIfPanelProps {
  scenarios: ForecastScenario[];
  levers: WhatIfLevers;
  onChangeLevers: (next: WhatIfLevers) => void;
}

/**
 * Pure client-side what-if panel.
 *
 * forecastApi has no compute() endpoint, so we simulate scenario
 * probability shifts with a deterministic function of 3 macro inputs.
 * The output is normalized so the 3 probabilities always sum to 1.
 */

const SCENARIO_COLOR: Record<ScenarioName, string> = {
  optimistic: colors.success,
  base: colors.goldBright,
  pessimistic: colors.danger,
};

const SCENARIO_LABEL: Record<ScenarioName, string> = {
  optimistic: '上策',
  base: '中策',
  pessimistic: '下策',
};

interface Lever {
  key: 'macro' | 'execution' | 'geopolitics';
  label: string;
  description: string;
  /** -1 → tilts pessimistic; +1 → tilts optimistic */
}

const LEVERS: Lever[] = [
  {
    key: 'macro',
    label: '宏观景气',
    description: '全球市场与金融环境的综合指数',
  },
  {
    key: 'execution',
    label: '执行韧性',
    description: '内部组织执行与资源储备',
  },
  {
    key: 'geopolitics',
    label: '地缘摩擦',
    description: '贸易 / 关税 / 冲突烈度（反向）',
  },
];

function compute(
  baseline: Record<ScenarioName, number>,
  levers: Record<Lever['key'], number>,
): Record<ScenarioName, number> {
  const tilt =
    levers.macro * 0.35 +
    levers.execution * 0.25 -
    levers.geopolitics * 0.4;
  // tilt in [-1, 1] → shift optimistic up, pessimistic down
  const raw: Record<ScenarioName, number> = {
    optimistic: Math.max(0.01, baseline.optimistic + tilt * 0.25),
    base: Math.max(0.01, baseline.base - Math.abs(tilt) * 0.1),
    pessimistic: Math.max(0.01, baseline.pessimistic - tilt * 0.25),
  };
  const sum = raw.optimistic + raw.base + raw.pessimistic;
  return {
    optimistic: raw.optimistic / sum,
    base: raw.base / sum,
    pessimistic: raw.pessimistic / sum,
  };
}

export function WhatIfPanel({ scenarios, levers, onChangeLevers }: WhatIfPanelProps) {
  const baseline = useMemo<Record<ScenarioName, number>>(() => {
    const out: Record<ScenarioName, number> = {
      optimistic: 0.33,
      base: 0.34,
      pessimistic: 0.33,
    };
    for (const s of scenarios) out[s.name] = s.probability;
    // normalize in case sums off
    const sum = out.optimistic + out.base + out.pessimistic || 1;
    return {
      optimistic: out.optimistic / sum,
      base: out.base / sum,
      pessimistic: out.pessimistic / sum,
    };
  }, [scenarios]);

  const projected = useMemo(() => compute(baseline, levers), [baseline, levers]);
  const [copied, setCopied] = useState(false);

  const strongestMove = useMemo(() => {
    const deltas = (['optimistic', 'base', 'pessimistic'] as ScenarioName[]).map((name) => ({
      name,
      delta: projected[name] - baseline[name],
    }));
    return deltas.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0] ?? null;
  }, [baseline, projected]);

  const reset = () => onChangeLevers({ macro: 0, execution: 0, geopolitics: 0 });

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('已复制当前沙盘链接', {
        description: '外部打开后会直接落到同一组推演参数',
      });
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error('复制沙盘链接失败', {
        description: '请手动复制浏览器地址栏',
      });
    }
  };

  return (
    <GlassPanel tone="elevated" padding="lg">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders size={13} style={{ color: colors.goldBright }} />
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: colors.textMuted }}>
              What-If · 推演沙盘
            </div>
            <h3 className="mt-0.5 text-[13px] font-medium" style={{ color: colors.text }}>
              调参即时重算
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 rounded-md border border-[#F0C66A]/20 px-2.5 py-1 text-[11px] transition-colors hover:bg-[#F0C66A]/8"
            style={{ color: colors.goldBright }}
          >
            {copied ? <Check size={10} /> : <Share2 size={10} />}
            {copied ? '已复制链接' : '复制当前沙盘'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[11px] transition-colors hover:bg-white/5"
            style={{ color: colors.textDim }}
          >
            <RotateCcw size={10} />
            归零
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        {LEVERS.map((lever) => {
          const v = levers[lever.key];
          return (
            <div key={lever.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] font-medium" style={{ color: colors.text }}>
                    {lever.label}
                  </div>
                  <div className="text-[11px]" style={{ color: colors.textMuted }}>{lever.description}</div>
                </div>
                <div
                  className="font-mono text-[11px]"
                  style={{
                    color: v > 0 ? colors.success : v < 0 ? colors.danger : colors.textMuted,
                  }}
                >
                  {v > 0 ? '+' : ''}
                  {(v * 100).toFixed(0)}
                </div>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={v}
                onChange={(e) =>
                  onChangeLevers({ ...levers, [lever.key]: Number(e.target.value) })
                }
                className="w-full"
                style={{
                  accentColor: colors.goldBright,
                  background:
                    'linear-gradient(90deg, rgba(244,63,94,0.3), rgba(106,114,153,0.3), rgba(61,214,140,0.3))',
                  height: 4,
                  borderRadius: 2,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Projected probabilities */}
      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider" style={{ color: colors.textMuted }}>
          <Sparkles size={10} style={{ color: colors.goldBright }} />
          推演结果 · Projected
        </div>
        <div className="space-y-2">
          {(['optimistic', 'base', 'pessimistic'] as ScenarioName[]).map((name) => {
            const color = SCENARIO_COLOR[name];
            const next = projected[name];
            const prev = baseline[name];
            const delta = next - prev;
            return (
              <div key={name}>
                <div className="mb-0.5 flex items-baseline justify-between text-[11px]">
                  <span style={{ color }}>
                    {SCENARIO_LABEL[name]} · {name}
                  </span>
                  <span className="font-mono" style={{ color: colors.textDim }}>
                    <span style={{ color }}>{(next * 100).toFixed(1)}%</span>
                    <span
                      className="ml-1.5 text-[11px]"
                      style={{
                        color: delta > 0.005 ? colors.success : delta < -0.005 ? colors.danger : colors.textMuted,
                      }}
                    >
                      {delta >= 0 ? '+' : ''}
                      {(delta * 100).toFixed(1)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${next * 100}%`,
                      background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
        <div className="text-[11px]" style={{ color: colors.textMuted }}>
          当前结论 · What-If Readout
        </div>
        <div className="mt-1.5 text-[12px] leading-6" style={{ color: colors.text }}>
          {strongestMove
            ? `${SCENARIO_LABEL[strongestMove.name]} 变化最明显，较基准 ${
                strongestMove.delta >= 0 ? '上调' : '下调'
              } ${Math.abs(strongestMove.delta * 100).toFixed(1)} 个百分点。`
            : '当前参数尚未形成明显偏移。'}
        </div>
      </div>

      <div className="mt-3 text-center text-[11px]" style={{ color: colors.textFaint }}>
        客户端即时推演 · 当前参数已写入链接，可直接复制回看
      </div>
    </GlassPanel>
  );
}
