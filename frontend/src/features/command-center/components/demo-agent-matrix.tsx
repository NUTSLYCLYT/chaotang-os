'use client';

import { useEffect, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { TypewriterText } from '@/components/effects';
import { AGENT_META } from '@/types/agent';
import type { AgentCode } from '@/types/agent';

/**
 * DEMO-006 · 5部门并行可视化
 *
 * Shows up in command-center workspace when a task enters "running" status.
 * 5 departments activate with staggered 200ms delay, each showing a
 * live stream of their analysis text.
 *
 * The qin_tian_jian dependency arrow (→ hu_bu) is rendered as an SVG line
 * overlaid on the grid.
 */

const DEMO_DEPARTMENTS: AgentCode[] = [
  'hu_bu',
  'jin_yi_wei',
  'bing_bu',
  'li_bu_rites',
  'qin_tian_jian',
];

const STREAM_SNIPPETS: Record<AgentCode, string> = {
  hu_bu: '正在拉取近 8 季度财报与估值指标…P/E 约 38x，毛利率 75.2%，增速拐点已现。',
  jin_yi_wei: '扫描全球 142 条监管信号…美国出口管制 Q2 将扩大范围，欧盟 AI Act 二审通过。',
  bing_bu: 'AMD MI300X 推理性价比追至 70-80%…训练端护城河仍在，推理端开始失血。',
  li_bu_rites: '抓取散户情绪与机构调研报告…分析师评级偏多，但多头拥挤度达 18 月高位。',
  qin_tian_jian: '等待户部与兵部数据…推演未来 12 月三种情景树（强势/震荡/回调）。',
  // unused agents — satisfy type completeness
  xing_bu: '',
  li_bu: '',
  gong_bu: '',
  prime_minister: '',
  scribe: '',
  tai_yi_yuan: '',
};

interface DeptCardProps {
  code: AgentCode;
  active: boolean;
  delayMs: number;
}

function DeptCard({ code, active, delayMs }: DeptCardProps) {
  const [visible, setVisible] = useState(false);
  const meta = AGENT_META[code];

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);

  return (
    <div
      className="relative rounded-2xl border p-3 transition-all duration-500"
      style={{
        borderColor: visible ? `${meta.color}55` : 'rgba(26, 33, 66, 0.5)',
        backgroundColor: visible ? 'rgba(20, 26, 52, 0.65)' : 'rgba(10, 14, 30, 0.4)',
        boxShadow: visible ? `0 0 18px ${meta.color}18` : undefined,
        opacity: visible ? 1 : 0.35,
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base leading-none">{meta.emoji}</span>
        <div>
          <div
            className="text-[12px] font-semibold"
            style={{ color: visible ? meta.color : '#484F72' }}
          >
            {meta.nameCn}
          </div>
          <div className="font-mono text-[11px] text-[#484F72]">{meta.nameEn}</div>
        </div>
        {visible && (
          <div
            className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: meta.color }}
          />
        )}
      </div>

      <div
        className="min-h-[52px] rounded-lg border p-2 font-mono text-[11px] leading-5"
        style={{
          borderColor: 'rgba(26, 33, 66, 0.6)',
          backgroundColor: 'rgba(4, 6, 14, 0.4)',
          color: '#9AA3C4',
        }}
      >
        {visible ? (
          <TypewriterText
            text={STREAM_SNIPPETS[code]}
            charDelayMs={28}
            startDelayMs={300}
          />
        ) : (
          <span className="text-[#303648]">待命中...</span>
        )}
      </div>

      {/* Progress bar */}
      {visible && (
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[rgba(26,33,66,0.6)]">
          <div
            className="h-full transition-all duration-[6000ms] ease-out"
            style={{
              width: '100%',
              backgroundColor: meta.color,
              boxShadow: `0 0 6px ${meta.color}`,
              transform: 'scaleX(0)',
              transformOrigin: 'left',
              animation: `grow-bar 6s ease-out ${delayMs + 400}ms forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

interface DemoAgentMatrixProps {
  active: boolean;
}

export function DemoAgentMatrix({ active }: DemoAgentMatrixProps) {
  if (!active) return null;

  return (
    <GlassPanel tone="elevated" padding="lg" hudCorners className="mb-4 overflow-hidden">
      <style>{`
        @keyframes grow-bar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#6A7299]">
            Agent Matrix · 五部协同
          </div>
          <h3 className="mt-1 text-[14px] font-semibold text-[#EAEEFB]">
            五路并行研判 · 实时推进中
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#F0C66A]/20 bg-[#F0C66A]/8 px-3 py-1 text-[11px] text-[#F0C66A]">
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: '#F0C66A' }}
          />
          并行执行
        </div>
      </div>

      {/* 5-department grid: 3 top row + 2 bottom row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {DEMO_DEPARTMENTS.slice(0, 3).map((code, i) => (
          <DeptCard key={code} code={code} active={active} delayMs={i * 200} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {DEMO_DEPARTMENTS.slice(3).map((code, i) => (
          <DeptCard key={code} code={code} active={active} delayMs={(i + 3) * 200} />
        ))}
      </div>

      {/* Dependency hint */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[#5A6280]">
        <span>钦天监</span>
        <span>→</span>
        <span>依赖户部 + 兵部数据（优先完成）</span>
      </div>
    </GlassPanel>
  );
}
