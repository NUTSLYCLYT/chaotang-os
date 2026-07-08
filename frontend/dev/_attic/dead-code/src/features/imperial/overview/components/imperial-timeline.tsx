'use client';

import { GlassPanel } from '@/components/ui/glass-panel';

const EVENTS = [
  { time: '07:20', label: '锦衣卫急报入殿', tone: 'gold' },
  { time: '08:10', label: '丞相收束今日唯一焦点', tone: 'blue' },
  { time: '09:00', label: '兵部与刑部形成争议', tone: 'warn' },
  { time: '09:40', label: '户部确认局部预算可放行', tone: 'gold' },
  { time: '10:15', label: '待陛下决定是否转军机处', tone: 'red' },
] as const;

const TONE = {
  gold: { dot: '#F0C66A', line: '#F0C66A33' },
  blue: { dot: '#6BA0FF', line: '#6BA0FF33' },
  warn: { dot: '#F5A524', line: '#F5A52433' },
  red: { dot: '#F43F5E', line: '#F43F5E33' },
} as const;

export function ImperialTimeline() {
  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="section-eyebrow">Imperial Timeline · 决策时间轴</div>
          <h2 className="section-title mt-1">今天的决策链路，按时间顺序留痕。</h2>
        </div>
        <div className="font-mono text-[11px] text-[#6A7299]">07:20 → 10:15</div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {EVENTS.map((event, index) => (
          <div key={event.time} className="relative rounded-2xl border border-white/6 bg-white/[0.03] p-4">
            {index < EVENTS.length - 1 ? (
              <div
                className="pointer-events-none absolute right-[-9px] top-[18px] hidden h-px w-[18px] md:block"
                style={{ background: TONE[event.tone].line }}
              />
            ) : null}
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: TONE[event.tone].dot, boxShadow: `0 0 12px ${TONE[event.tone].dot}` }}
              />
              <span className="font-mono text-[11px] text-[#9AA3C4]">{event.time}</span>
            </div>
            <div className="body-copy mt-3 text-[12px] leading-6 text-[#D3D8E8]">{event.label}</div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
