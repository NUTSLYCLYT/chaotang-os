'use client';

/**
 * 朝堂气象 · Court Weather
 *
 * 根据 tasks/signals/runs 聚合出一个"系统气象"：
 *   晴 · 阴 · 骤雨 · 雷动
 * 挂在年号时辰栏旁，给客户一眼系统健康度。
 *
 * 非后台监控，是品牌钩子 — 用古风比喻传达 critical/warning 密度。
 */

import type { Task } from '@/types/task';
import type { IntelSignal } from '@/types/intel';
import type { AgentRun } from '@/types/agent';

interface Props {
  tasks: Task[];
  signals: IntelSignal[];
  runs: AgentRun[];
}

type Weather = 'clear' | 'cloudy' | 'storm' | 'thunder';

const WEATHER_MAP: Record<Weather, { glyph: string; label: string; hint: string; color: string }> = {
  clear: { glyph: '☀', label: '晴', hint: '朝堂清明 · 六部安好', color: '#F0C66A' },
  cloudy: { glyph: '☁', label: '阴', hint: '略有警讯 · 可巡视', color: '#6BA0FF' },
  storm: { glyph: '🌧', label: '骤雨', hint: '多件待议 · 宜尽早批', color: '#F5A524' },
  thunder: { glyph: '⚡', label: '雷动', hint: '急报在卷 · 需即处置', color: '#EF4444' },
};

export function CourtWeather({ tasks, signals, runs }: Props) {
  const weather = inferWeather(tasks, signals, runs);
  const info = WEATHER_MAP[weather];

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1"
      style={{
        borderColor: `${info.color}33`,
        background: `linear-gradient(90deg, ${info.color}0D, transparent)`,
      }}
      title={info.hint}
    >
      <span className="text-[14px]" style={{ color: info.color }}>
        {info.glyph}
      </span>
      <span className="text-[11px] font-medium" style={{ color: info.color }}>
        朝堂气象 · {info.label}
      </span>
      <span className="text-[11px] text-[#6A7299]">{info.hint}</span>
    </div>
  );
}

function inferWeather(tasks: Task[], signals: IntelSignal[], runs: AgentRun[]): Weather {
  const critical = signals.filter((s) => s.level === 'critical').length;
  if (critical > 0) return 'thunder';

  const warning = signals.filter((s) => s.level === 'warning').length;
  const pending = tasks.filter((t) => t.status === 'report_ready').length;
  if (warning + pending >= 3) return 'storm';
  if (warning + pending >= 1) return 'cloudy';

  const busy = runs.filter((r) => r.state === 'running' || r.state === 'summarizing').length;
  if (busy >= 2) return 'cloudy';

  return 'clear';
}
