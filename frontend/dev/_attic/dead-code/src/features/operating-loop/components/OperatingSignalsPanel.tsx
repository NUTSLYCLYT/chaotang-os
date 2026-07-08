'use client';

import { GlassPanel } from '@/components/GlassPanel';
import type {
  DailyOperatingBrief,
  OperatingSignal,
  OperatingSignalType,
  OperatingSeverity,
} from '../lib/daily-brief';

const TYPE_LABEL: Record<OperatingSignalType, string> = {
  risk: '风险',
  opportunity: '机会',
  decision_needed: '待决策',
  execution_followup: '执行跟进',
};

const SEVERITY_LABEL: Record<OperatingSeverity, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

/** 严重度 → GlassPanel 配色变体（复用既有色板，不新增视觉风格） */
const SEVERITY_VARIANT: Record<OperatingSeverity, 'danger' | 'gold' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'gold',
  medium: 'info',
  low: 'default',
};

const SEVERITY_RANK: Record<OperatingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SOURCE_LABEL: Record<OperatingSignal['source'], string> = {
  manual: '人工录入',
  archive: '史馆',
  project: '项目',
  customer: '客户',
  finance: '户部',
  external_intel: '外部情报',
  mock: '演示',
};

interface OperatingSignalsPanelProps {
  brief: DailyOperatingBrief;
  /** 把某条信号/建议的行动转为圣旨草稿（交军机处会审） */
  onDispatch: (command: string) => void;
}

/** 今日经营简报面板：经营信号（含证据链）+ 每日建议，均可一键下旨会审 */
export function OperatingSignalsPanel({ brief, onDispatch }: OperatingSignalsPanelProps) {
  // spread 避免改动冻结数组（immutability）
  const signals = [...brief.signals].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  return (
    <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pr-1">
      <p className="body-copy">{brief.summary}</p>

      <div className="flex items-center gap-2 px-0.5">
        <span className="text-[8px] text-[#8A6A2A]" aria-hidden>
          ◆
        </span>
        <span className="section-eyebrow">经营信号 · {signals.length} 条</span>
        <span
          className="h-px flex-1 bg-gradient-to-r from-[#F0C66A]/25 to-transparent"
          aria-hidden
        />
      </div>

      {signals.map((sig) => (
        <SignalCard key={sig.id} signal={sig} onDispatch={onDispatch} />
      ))}
    </div>
  );
}

interface SignalCardProps {
  signal: OperatingSignal;
  onDispatch: (command: string) => void;
}

function SignalCard({ signal, onDispatch }: SignalCardProps) {
  return (
    <GlassPanel variant={SEVERITY_VARIANT[signal.severity]} padding="sm" hudCorners>
      <div className="flex items-start justify-between gap-2">
        <span className="section-title leading-snug">{signal.title}</span>
        <span className="shrink-0 rounded border border-[#F0C66A]/20 bg-[#F0C66A]/[0.05] px-2 py-0.5 text-[9px] tracking-[0.1em] text-[#D9C79A]">
          {TYPE_LABEL[signal.type]} · {SEVERITY_LABEL[signal.severity]}
        </span>
      </div>

      <p className="body-copy mt-1.5">{signal.summary}</p>

      {signal.evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {signal.evidence.map((ev, i) => (
            <li
              key={i}
              className="flex gap-1.5 text-[11px] leading-[1.6] text-[#b6ab8c]"
            >
              <span className="mt-px text-[#8A6A2A]" aria-hidden>
                ·
              </span>
              <span>{ev}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.1em] text-[#8F835F]">
          来源 · {SOURCE_LABEL[signal.source]}
        </span>
        <button
          type="button"
          onClick={() => onDispatch(signal.recommendedAction)}
          className="rounded border border-[#F0C66A]/30 bg-[#F0C66A]/[0.06] px-3 py-1 text-[11px] tracking-[0.08em] text-[#F0C66A] transition-colors hover:bg-[#F0C66A]/[0.12]"
        >
          下旨会审
        </button>
      </div>
    </GlassPanel>
  );
}
