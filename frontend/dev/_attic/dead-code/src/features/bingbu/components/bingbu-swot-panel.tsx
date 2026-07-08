/**
 * 朝堂 OS · 兵部 · SWOT 分析面板
 */

'use client';

import { GlassPanel } from '@/components/ui/glass-panel';
import type { BingbuSwot, SwotItem } from '@/lib/contracts/bingbu';

interface BingbuSwotPanelProps {
  swot: BingbuSwot;
}

export function BingbuSwotPanel({ swot }: BingbuSwotPanelProps) {
  const confidencePct = Math.round(swot.confidence * 100);

  return (
    <GlassPanel tone="elevated" padding="md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="section-eyebrow">SWOT Analysis</div>
          <h3 className="section-title mt-0.5">攻防四象限</h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-[13px] font-bold text-[#F5E9C9]">{confidencePct}%</div>
          <div className="text-[11px] text-[#6A7299]">置信度</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <SwotQuadrant
          title="优势 Strengths"
          items={swot.strengths}
          color="#3DD68C"
          icon="S"
        />
        <SwotQuadrant
          title="弱点 Weaknesses"
          items={swot.weaknesses}
          color="#F5A524"
          icon="W"
        />
        <SwotQuadrant
          title="机会 Opportunities"
          items={swot.opportunities}
          color="#6BA0FF"
          icon="O"
        />
        <SwotQuadrant
          title="威胁 Threats"
          items={swot.threats}
          color="#F43F5E"
          icon="T"
        />
      </div>

      <div className="mt-2 text-[11px] text-[#6A7299]">
        更新于 {new Date(swot.generatedAt).toLocaleDateString('zh-CN')}
      </div>
    </GlassPanel>
  );
}

function SwotQuadrant({
  title,
  items,
  color,
  icon,
}: {
  title: string;
  items: SwotItem[];
  color: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: `${color}33`,
        background: `linear-gradient(135deg, ${color}0a, rgba(0,0,0,0.3))`,
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
        >
          {icon}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
          {title}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="text-[11px] leading-5 text-[#C0C8D8]">
            <span style={{ color }} className="mr-1">·</span>
            {item.text}
            {item.source && (
              <span className="ml-1 text-[10px] text-[#6A7299]">[{item.source}]</span>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-[11px] text-[#6A7299]">暂无数据</li>
        )}
      </ul>
    </div>
  );
}
