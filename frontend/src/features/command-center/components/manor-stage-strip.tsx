/**
 * 朝堂 OS · Manor Stage Strip
 *
 * 把 legal-agent /manor/{name}/stream 的 stage_add/stage_update
 * 画成一排金色徽章，每位专家独立状态 + 呼吸动画。
 *
 * 给用户的观感：
 *   "情境拆解 → 资深律师 → 资深法官 → 检察长 → ..." 一个接一个亮起
 *   不是转个菊花等 3 秒，是看到 7 位大臣真·上朝。
 */

'use client';

import { CheckCircle2, Loader2, Clock, AlertTriangle } from 'lucide-react';
import type { StageEntry } from '@/features/command-center/hooks/use-manor-stream';

interface ManorStageStripProps {
  stages: StageEntry[];
  fallback?: boolean;
}

const STATUS_STYLES = {
  pending: {
    border: 'rgba(138,164,255,0.25)',
    bg: 'rgba(138,164,255,0.06)',
    color: '#8AA4FF',
    label: '待召',
  },
  running: {
    border: 'rgba(240,198,106,0.55)',
    bg: 'rgba(240,198,106,0.12)',
    color: '#F0C66A',
    label: '奏对中',
  },
  done: {
    border: 'rgba(61,214,140,0.4)',
    bg: 'rgba(61,214,140,0.08)',
    color: '#3DD68C',
    label: '已呈',
  },
  failed: {
    border: 'rgba(244,63,94,0.4)',
    bg: 'rgba(244,63,94,0.08)',
    color: '#F43F5E',
    label: '失守',
  },
} as const;

export function ManorStageStrip({ stages, fallback }: ManorStageStripProps) {
  if (stages.length === 0 && !fallback) return null;

  return (
    <div
      className="mb-3 rounded-xl border px-4 py-3"
      style={{
        borderColor: fallback ? 'rgba(244,63,94,0.3)' : 'rgba(240,198,106,0.22)',
        background:
          'linear-gradient(135deg, rgba(21,18,10,0.6) 0%, rgba(10,7,4,0.85) 100%)',
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${stages.some((s) => s.status === 'running') ? 'animate-pulse' : ''}`}
          style={{ background: fallback ? '#F43F5E' : '#F0C66A' }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F0C66A]">
          {fallback ? '上游不可达 · 走降级' : '群臣奏对 · Live Stream'}
        </span>
        <span className="ml-auto font-mono text-[11px] text-[#8A92AC]">
          {stages.filter((s) => s.status === 'done').length} / {stages.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {stages.map((stage, i) => {
          const style = STATUS_STYLES[stage.status];
          const Icon =
            stage.status === 'done'
              ? CheckCircle2
              : stage.status === 'running'
                ? Loader2
                : stage.status === 'failed'
                  ? AlertTriangle
                  : Clock;
          return (
            <div
              key={`${stage.name}-${i}`}
              title={stage.message ?? `${stage.name} · ${style.label}`}
              className="flex items-center gap-1.5 rounded-md border px-2 py-1"
              style={{
                borderColor: style.border,
                background: style.bg,
                color: style.color,
                fontFamily: '"Noto Serif SC", serif',
              }}
            >
              <Icon
                size={11}
                className={stage.status === 'running' ? 'animate-spin' : ''}
              />
              <span className="text-[12px] font-semibold tracking-[0.06em]">
                {stage.name}
              </span>
              <span
                className="text-[11px] font-medium opacity-70"
                style={{ color: style.color }}
              >
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
