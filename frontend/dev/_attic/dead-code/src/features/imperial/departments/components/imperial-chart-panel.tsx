'use client';

import { BarChart3, LineChart } from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';

export interface ImperialChartPanelProps {
  title: string;
  subtitle: string;
  bars: Array<{ label: string; value: number; tone?: 'gold' | 'blue' | 'green' | 'purple' }>;
  lineLabel?: string;
}

const BAR_COLOR = {
  gold: '#F0C66A',
  blue: '#6BA0FF',
  green: '#3DD68C',
  purple: '#B794F4',
} as const;

export function ImperialChartPanel({
  title,
  subtitle,
  bars,
  lineLabel = '近四期趋势',
}: ImperialChartPanelProps) {
  return (
    <GlassPanel variant="gold" tone="deep" padding="lg" hudCorners className="overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="section-eyebrow">Chart Theater · 图表型主视区</div>
          <h2 className="section-title mt-1">{title}</h2>
          <p className="body-copy mt-2 text-[12px] leading-6 text-[#B8C0DA]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-[#F0C66A]">
          <BarChart3 size={14} />
          <LineChart size={14} />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-white/6 bg-[#060913] p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">Bar Summary</div>
          <div className="space-y-3">
            {bars.map((bar) => {
              const color = BAR_COLOR[bar.tone ?? 'gold'];
              return (
                <div key={bar.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-[#D9CFB4]">{bar.label}</span>
                    <span className="font-mono" style={{ color }}>{bar.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(8, bar.value))}%`,
                        background: `linear-gradient(90deg, ${color}99, ${color})`,
                        boxShadow: `0 0 14px ${color}55`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-[24px] border border-white/6 bg-[#060913] p-4">
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#8F835F]">{lineLabel}</div>
          <div className="relative h-[240px] overflow-hidden rounded-2xl border border-[#F0C66A]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.00))]">
            <div className="absolute inset-x-0 top-[20%] h-px bg-white/5" />
            <div className="absolute inset-x-0 top-[40%] h-px bg-white/5" />
            <div className="absolute inset-x-0 top-[60%] h-px bg-white/5" />
            <div className="absolute inset-x-0 top-[80%] h-px bg-white/5" />
            <svg viewBox="0 0 360 240" className="absolute inset-0 h-full w-full">
              <path
                d="M20 188 C70 168, 100 148, 146 132 S235 92, 280 86 S330 60, 340 44"
                fill="none"
                stroke="#F0C66A"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M20 188 C70 168, 100 148, 146 132 S235 92, 280 86 S330 60, 340 44"
                fill="none"
                stroke="rgba(240,198,106,0.25)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {[20, 146, 280, 340].map((x, index) => (
                <circle key={x} cx={x} cy={[188, 132, 86, 44][index]} r="5" fill="#F0C66A" />
              ))}
            </svg>
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[11px] text-[#6A7299]">
              <span>Q1</span>
              <span>Q2</span>
              <span>Q3</span>
              <span>Q4</span>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
