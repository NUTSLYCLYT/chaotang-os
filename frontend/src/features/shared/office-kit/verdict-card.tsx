'use client';

/**
 * 建部套件 · 通用决策卡 <VerdictCard>(2026-07-01)
 *
 * 各部各司"决策前算账"结果的统一呈现:4色裁决灯 + 标题 + 右侧指标 + 唯一下一步
 * + 展开(意见/缺证)+ 诚实标。招/培/编制等结构相同的卡收敛到此,建新司不再抄卡片。
 * (辞退带 signoff、薪酬带 band、转正无展开——结构不同,暂各自保留,后续按需并入。)
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface VerdictCfg {
  color: string;
  bg: string;
  border: string;
}

export interface VerdictCardProps {
  verdictCn: string;
  cfg: VerdictCfg;
  /** 标题(岗位/对象/候选人)。 */
  title: string;
  /** 右侧指标,已格式化(如 "年成本 ¥1,000" / "ROI 2" / "占比 23%")。 */
  metrics?: string[];
  /** 唯一下一步(主行,cfg 色)。 */
  nextStep: string;
  /** 展开区:各司意见(选才司/户部…)。 */
  opinions?: string[];
  /** 展开区:缺证/阻塞项(虚线 chip)。 */
  blockers?: string[];
  /** 缺证 chip 色(默认琥珀;辞退类可传红)。 */
  blockerColor?: string;
  /** 诚实标脚注(LOCAL · …)。 */
  sourceNote: string;
  /** 协办部门(显"本决策借了谁"——让老板看见跨部协作,不是孤立柜台)。 */
  collaborators?: { name: string; accent: string; note?: string }[];
}

export function VerdictCard({
  verdictCn,
  cfg,
  title,
  metrics = [],
  nextStep,
  opinions = [],
  blockers = [],
  blockerColor = '#E5B84D',
  sourceNote,
  collaborators = [],
}: VerdictCardProps) {
  const [open, setOpen] = useState(false);
  const hasDetail = opinions.length > 0 || blockers.length > 0;

  return (
    <div className="rounded-[16px] border p-4" style={{ borderColor: cfg.border, background: cfg.bg }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: `${cfg.color}22`, color: cfg.color }}>
          {verdictCn}
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[#F5E9C9]">{title}</span>
        {metrics.map((m, i) => (
          <span key={i} className="font-mono text-[11px] text-[#7a8090]">{m}</span>
        ))}
        {hasDetail && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="shrink-0 text-[#5a6070] transition hover:text-[#b6ab8c]" aria-label={open ? '收起' : '展开'}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      <p className="mt-1.5 text-[11.5px]" style={{ color: `${cfg.color}cc` }}>{nextStep}</p>

      {/* 协办徽:本决策借了哪个部门的能力(让老板看见跨部协作,不是孤立柜台) */}
      {collaborators.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px]" style={{ color: '#5a6070' }}>协办</span>
          {collaborators.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ border: `1px solid ${c.accent}44`, background: `${c.accent}14`, color: c.accent }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.accent }} />
              {c.name}{c.note ? ` · ${c.note}` : ''}
            </span>
          ))}
        </div>
      )}

      {open && hasDetail && (
        <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: `${cfg.color}18` }}>
          {opinions.map((o, i) => (
            <div key={i} className="text-[11px] text-[#8a9aaa]">{o}</div>
          ))}
          {blockers.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {blockers.map((b) => (
                <span key={b} className="rounded-[6px] border border-dashed px-1.5 py-0.5 text-[10px]" style={{ borderColor: `${blockerColor}28`, color: `${blockerColor}99` }}>
                  ⚠ {b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] text-[#4a5060]">{sourceNote}</p>
    </div>
  );
}
