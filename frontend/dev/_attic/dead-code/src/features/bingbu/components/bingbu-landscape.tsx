/**
 * 朝堂 OS · 兵部 · 竞品全景板
 *
 * 展示竞品列表 + 威胁等级 + 市场份额
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { CompetitorRecord, CompetitorThreatLevel } from '@/lib/contracts/bingbu';

const ACCENT = '#F43F5E';

interface BingbuLandscapeProps {
  competitors: CompetitorRecord[];
  onSelect?: (competitor: CompetitorRecord | null) => void;
  selectedId?: string | null;
}

export function BingbuLandscape({
  competitors,
  onSelect,
  selectedId,
}: BingbuLandscapeProps) {
  if (competitors.length === 0) {
    return (
      <GlassPanel tone="elevated" padding="md">
        <div className="flex h-32 items-center justify-center text-[12px] text-[#6A7299]">
          暂无竞品情报 · 兵部正在侦察中
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="section-eyebrow mb-1">Competitive Landscape</div>
      <h3 className="section-title mb-3">竞品全景 · 兵力分布</h3>
      <div className="space-y-2">
        {competitors.map((c) => (
          <CompetitorRow
            key={c.id}
            competitor={c}
            isSelected={selectedId === c.id}
            onClick={() => onSelect?.(selectedId === c.id ? null : c)}
            accent={ACCENT}
          />
        ))}
      </div>
    </GlassPanel>
  );
}

function CompetitorRow({
  competitor: c,
  isSelected,
  onClick,
  accent,
}: {
  competitor: CompetitorRecord;
  isSelected: boolean;
  onClick: () => void;
  accent: string;
}) {
  const { color, label } = threatConfig(c.threatLevel);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border px-3 py-3 text-left transition hover:brightness-110"
      style={{
        borderColor: isSelected ? `${accent}66` : 'rgba(255,255,255,0.06)',
        background: isSelected
          ? `linear-gradient(135deg, ${accent}12, rgba(0,0,0,0.3))`
          : 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* 左：名称 + 动态 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#F5E9C9]">{c.name}</span>
            <ThreatBadge color={color} label={label} />
          </div>
          <div className="mt-1 truncate text-[11px] text-[#8A92AC]">{c.latestMove}</div>
        </div>
        {/* 右：市场份额 */}
        <div className="flex flex-col items-end shrink-0">
          <span className="font-mono text-[15px] font-bold text-[#F5E9C9]">
            {c.marketSharePct.toFixed(1)}%
          </span>
          <span className="text-[11px] text-[#6A7299]">市场份额</span>
        </div>
      </div>

      {/* 份额进度条 */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(c.marketSharePct, 100)}%`,
            background: `linear-gradient(90deg, ${color}, ${accent})`,
          }}
        />
      </div>

      {/* 展开详情（仅选中状态） */}
      {isSelected && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/8 pt-3">
          <StrengthWeakCol label="优势" items={c.strengths} color="#3DD68C" />
          <StrengthWeakCol label="弱点" items={c.weaknesses} color="#F5A524" />
        </div>
      )}
    </button>
  );
}

function ThreatBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        borderColor: `${color}66`,
        background: `${color}14`,
        color,
      }}
    >
      {label}
    </span>
  );
}

function StrengthWeakCol({
  label,
  items,
  color,
}: {
  label: string;
  items: string[];
  color: string;
}) {
  return (
    <div>
      <div
        className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color }}
      >
        {label}
      </div>
      <ul className="space-y-1">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="flex items-start gap-1 text-[11px] text-[#9AA3C4]">
            <span style={{ color }} className="mt-[3px] shrink-0 text-[8px]">●</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function threatConfig(level: CompetitorThreatLevel): { color: string; label: string } {
  switch (level) {
    case 'critical':
      return { color: '#F43F5E', label: '危急' };
    case 'high':
      return { color: '#F5A524', label: '高危' };
    case 'medium':
      return { color: '#F0C66A', label: '中等' };
    case 'low':
    default:
      return { color: '#3DD68C', label: '低危' };
  }
}
