'use client';

/**
 * 刑部 · 底部 BottomDock
 *
 * 户部/兵部同构——统一用 useAgentChat。
 * 狄仁杰：动态快选 prompt、焦点面板、案件上下文感知。
 */

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import type { LegalOverview, LegalCase } from '@/lib/contracts/xingbu';
import { LEGAL_RISK_LABEL, LEGAL_CASE_STATUS_LABEL } from '@/lib/contracts/xingbu';
import { useEffect, useRef } from 'react';

const XINGBU_ACCENT = '#3DD68C';

/** 根据选中案件动态生成 quick prompts */
function buildQuickPrompts(kase: LegalCase | null, overview: LegalOverview | null): string[] {
  if (!kase) {
    return [
      '当前积压案件里哪个最该优先审理？给法理依据。',
      '合规审查未通过项该先处置哪个？为什么？',
      '在办案件中有无临近审限的？标出来。',
      '结案率趋势如何？瓶颈在哪个环节？',
      '综合看，我方最该警惕的合规风险是哪个？',
    ];
  }

  return [
    `「${kase.title}」案号${kase.caseNumber}——该判谁胜诉？给法理依据。`,
    `核验「${kase.title}」的证据链是否完整，缺什么证据？`,
    `「${kase.title}」的涉案金额${kase.amount}，量刑建议是什么？`,
    `${kase.plaintiff} vs ${kase.defendant}——该案对两部门的影响预判。`,
    `若维持原判/推翻原判，需要补充什么证据？引用法条。`,
  ];
}

/** 刑部神将 SVG 头像（狄仁杰·简版） */
function XingbuAvatar() {
  return (
    <svg viewBox="0 0 36 36" width={28} height={28} fill="none" aria-hidden>
      <circle cx={18} cy={12} r={7} fill="#3DD68C" opacity={0.85} />
      <path d="M6 34c0-7 5-11 12-11s12 4 12 11" stroke="#3DD68C" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <rect x={14} y={20} width={8} height={1.5} rx={0.75} fill="#3DD68C" opacity={0.5} />
      <rect x={14} y={23} width={6} height={1.5} rx={0.75} fill="#3DD68C" opacity={0.4} />
    </svg>
  );
}

interface XingbuBottomDockProps {
  overview: LegalOverview | null;
  selectedCase: LegalCase | null;
  dockAutoExpand?: boolean;
  dockSeedPrompt?: string | null;
  onDockSeedConsumed?: () => void;
}

export function XingbuBottomDock({
  overview,
  selectedCase,
  dockAutoExpand = false,
  dockSeedPrompt,
  onDockSeedConsumed,
}: XingbuBottomDockProps) {
  const { messages, handleSend } = useAgentChat({
    endpoint: '/api/court/dept/legal/ask',
    greeting: selectedCase
      ? `臣刑部尚书狄仁杰接旨。已调阅案卷「${selectedCase.title}」（${selectedCase.caseNumber} / ${selectedCase.plaintiff}诉${selectedCase.defendant}），请陛下示下裁断——臣必附法理依据与冲突声明。`
      : overview
        ? `臣刑部尚书恭请陛下示下。在办案件 ${overview.summary.totalCases} 件，待审 ${overview.summary.pendingCount} 件，合规积压 ${overview.summary.complianceBacklog} 项。可询裁断取舍——臣必附法理依据与冲突声明。`
        : '臣刑部尚书恭请陛下示下。律法台已就位。',
    accent: XINGBU_ACCENT,
  });

  /* ── dock seed prompt ── */
  const seedSent = useRef(false);
  useEffect(() => {
    if (dockSeedPrompt && !seedSent.current) {
      seedSent.current = true;
      handleSend(dockSeedPrompt);
      onDockSeedConsumed?.();
    }
    if (!dockSeedPrompt) {
      seedSent.current = false;
    }
  }, [dockSeedPrompt, handleSend, onDockSeedConsumed]);

  const badges = (() => {
    const base: { label: string; value: string }[] = [];
    if (overview) {
      base.push(
        { label: '在办', value: String(overview.summary.totalCases) },
        { label: '待审', value: String(overview.summary.pendingCount) },
        { label: '结案率', value: overview.summary.closureRate },
      );
    }
    if (selectedCase) {
      base.push(
        { label: '状态', value: LEGAL_CASE_STATUS_LABEL[selectedCase.status] },
        { label: '风险', value: LEGAL_RISK_LABEL[selectedCase.riskLevel] },
      );
    }
    return base;
  })();

  const teaser = selectedCase
    ? `焦点：${selectedCase.caseNumber} · ${selectedCase.title.slice(0, 16)} · ${selectedCase.plaintiff}诉${selectedCase.defendant}`
    : overview
      ? `在办 ${overview.summary.totalCases} 件，待审 ${overview.summary.pendingCount} 件，狄仁杰请陛下裁断。`
      : '狄仁杰在案 · 律法昭昭，请陛下裁断。';

  /* ── 焦点面板 ── */
  const focusPanel = selectedCase ? (
    <div className="space-y-3">
      <div>
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: XINGBU_ACCENT }}>
          裁断上下文 · Judgment Context
        </div>
        <p className="mt-2 text-[12px] leading-6 text-[#F5E9C9]">
          {selectedCase.riskLevel === 'critical'
            ? '⚠️ 该案风险评级「紧急」，建议立即开庭审理，同步通报相关各部门。'
            : selectedCase.priority === 'P0'
              ? '⚖️ 最高优先级案件，建议加急排期，优先调取证据。'
              : selectedCase.status === 'appeal'
                ? '📋 上诉案件，需重新审查原判证据链与程序合法性。'
                : '📋 该案可按常规流程审理。注意核查证据链完整性。'}
        </p>
      </div>

      {/* 法条引用 */}
      {selectedCase.legalReferences.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: XINGBU_ACCENT }}>
            引用法条 · Legal References
          </div>
          <div className="space-y-1">
            {selectedCase.legalReferences.slice(0, 4).map((ref, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: XINGBU_ACCENT }} />
                <span className="text-[11px] leading-5 text-[#C6BB9D]">{ref}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : overview ? (
    <div className="space-y-3">
      <div>
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: XINGBU_ACCENT }}>
          司法总览 · Justice Overview
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-[20px] font-semibold text-[#F5E9C9]">
            {overview.summary.totalCases}
          </div>
          <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: `${XINGBU_ACCENT}66`, color: XINGBU_ACCENT, background: `${XINGBU_ACCENT}10` }}>
            在办案件
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '待审', value: String(overview.summary.pendingCount), color: '#FB923C' },
          { label: '结案率', value: overview.summary.closureRate, color: '#3DD68C' },
          { label: '平均周期', value: `${overview.summary.avgCycleDays}天`, color: '#6BA0FF' },
          { label: '合规积压', value: String(overview.summary.complianceBacklog), color: '#F43F5E' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-2.5" style={{ borderColor: `${item.color}33`, background: `linear-gradient(160deg, ${item.color}0a, rgba(0,0,0,0.3))` }}>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: item.color }}>{item.label}</div>
            <div className="mt-1 font-mono text-[14px] font-semibold text-[#F5E9C9]">{item.value}</div>
          </div>
        ))}
      </div>

      {overview.summary.recommendation && (
        <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: `${XINGBU_ACCENT}33`, background: `${XINGBU_ACCENT}08`, color: '#C6BB9D' }}>
          <span className="mr-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: XINGBU_ACCENT }}>判词：</span>
          {overview.summary.recommendation}
        </div>
      )}
    </div>
  ) : null;

  return (
    <BottomDock
      title="Justice Ministry · 刑部"
      name={selectedCase ? `律法台 · ${selectedCase.caseNumber}` : '刑部尚书 · 律法台'}
      accent={XINGBU_ACCENT}
      avatar={<XingbuAvatar />}
      quickPrompts={buildQuickPrompts(selectedCase, overview)}
      messages={messages}
      placeholder={selectedCase ? `就「${selectedCase.title.slice(0, 20)}」下旨...` : '请陛下示下律法事宜...'}
      sendLabel="裁断"
      onSend={handleSend}
      badges={badges}
      focusPanel={focusPanel}
      collapsedTeaser={teaser}
      defaultExpanded={dockAutoExpand}
    />
  );
}
