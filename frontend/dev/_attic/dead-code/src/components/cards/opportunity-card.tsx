/**
 * OpportunityCard — 机会卡
 *
 * 锦衣卫捕获的机会信号的通用展示
 */

import { Sparkles, ChevronRight, Send } from 'lucide-react';
import type { IntelSignal } from '@/types/intel';
import type { AgentCode } from '@/types/agent';
import { AGENT_META } from '@/types/agent';

export interface OpportunityCardProps {
  signal: IntelSignal;
  onClick?: () => void;
  onRoute?: (targets: AgentCode[]) => void;
  selected?: boolean;
  compact?: boolean;
}

export function OpportunityCard({
  signal,
  onClick,
  onRoute,
  selected,
  compact,
}: OpportunityCardProps) {
  const score = signal.impactScore ?? 0;
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`group cursor-pointer rounded-lg border p-${compact ? '2.5' : '3'} transition-all hover:bg-white/[0.03]`}
      style={{
        borderColor: selected ? 'rgba(61, 214, 140, 0.7)' : 'rgba(61, 214, 140, 0.35)',
        backgroundColor: selected ? 'rgba(61, 214, 140, 0.08)' : 'rgba(10, 14, 30, 0.4)',
      }}
    >
      {/* 顶部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-[#3DD68C]" />
          <span className="text-[9px] uppercase tracking-wider text-[#3DD68C]">
            Opportunity
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="font-mono text-[9px]"
            style={{ color: score >= 70 ? '#F0C66A' : '#6A7299' }}
          >
            {score}
          </span>
          <ChevronRight
            size={11}
            className="text-[#484F72] transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>

      {/* 标题 */}
      <h4 className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-[#EAEEFB]">
        {signal.title}
      </h4>

      {/* 摘要 */}
      {!compact && (
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#9AA3C4]">
          {signal.summary}
        </p>
      )}

      {/* 地区 + 行业 */}
      <div className="mt-2 flex items-center gap-1.5 text-[9px]">
        <span
          className="rounded px-1 py-0.5 font-mono"
          style={{ backgroundColor: 'rgba(26, 33, 66, 0.6)', color: '#9AA3C4' }}
        >
          {signal.regionLabel}
        </span>
        <span className="text-[#6A7299]">· {signal.industry}</span>
      </div>

      {/* 已转派 */}
      {signal.routedTo && signal.routedTo.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-[9px] text-[#3DD68C]">
          <Send size={8} />
          <span>已转派：</span>
          {signal.routedTo.map((code, i) => {
            const am = AGENT_META[code as AgentCode];
            if (!am) return null;
            return (
              <span key={code}>
                {am.nameCn}
                {i < signal.routedTo!.length - 1 && '、'}
              </span>
            );
          })}
        </div>
      )}

      {/* onRoute 按钮（可选） */}
      {onRoute && !signal.routedTo?.length && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRoute(['bing_bu', 'hu_bu']);
          }}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded border px-2 py-1 text-[9px] transition-colors hover:bg-white/5"
          style={{
            borderColor: 'rgba(61, 214, 140, 0.4)',
            color: '#3DD68C',
          }}
        >
          <Send size={8} />
          一键转派
        </button>
      )}
    </div>
  );
}
