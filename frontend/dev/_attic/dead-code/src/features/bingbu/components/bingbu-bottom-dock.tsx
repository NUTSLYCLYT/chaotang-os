'use client';

/**
 * 兵部 · 底部 BottomDock
 *
 * 户部同构——统一用 useAgentChat（共享 hook），不再手写 SSE 流解析。
 * 孙武：动态快选 prompt、焦点面板、竞品上下文感知。
 */

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import type { BingbuOverview, CompetitorRecord } from '@/lib/contracts/bingbu';
import { useEffect, useRef } from 'react';

const BINGBU_ACCENT = '#6BA0FF';

function threatLabel(level: CompetitorRecord['threatLevel']) {
  if (level === 'low') return '低危';
  if (level === 'medium') return '中危';
  if (level === 'high') return '高危';
  return '危急';
}

/** 根据选中竞品动态生成 quick prompts */
function buildQuickPrompts(competitor: CompetitorRecord | null): string[] {
  if (!competitor) {
    return [
      '当前最危险的竞品是谁？该优先部署哪个战场？',
      '给我一个 SWOT 快速总批，标出最紧迫的窗口。',
      '近期哪些市场窗口不能错过？怎么打？',
      '防守哪一客户/细分最急？给兵力部署建议。',
      '综合评价：我方该攻还是该守？给数据依据。',
    ];
  }

  return [
    `「${competitor.name}」威胁${threatLabel(competitor.threatLevel)}，份额${competitor.marketSharePct}%——该进攻还是防守？`,
    `核验「${competitor.name}」的弱点是否可信，哪个弱点最可被利用？`,
    `针对「${competitor.name}」最新动向「${competitor.latestMove.slice(0, 30)}…」，我方最优反制策略是什么？`,
    `若与「${competitor.name}」正面交锋，我方胜算几何？给出 SWOT 交叉分析。`,
    `「${competitor.name}」的战场分布如何？哪些战场该加兵、哪些该撤？`,
  ];
}

/** 兵部神将 SVG 头像（孙武·简版） */
function BingbuAvatar() {
  return (
    <svg viewBox="0 0 36 36" width={28} height={28} fill="none" aria-hidden>
      <circle cx={18} cy={12} r={7} fill="#6BA0FF" opacity={0.85} />
      <path d="M6 34c0-7 5-11 12-11s12 4 12 11" stroke="#6BA0FF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <path d="M10 5 L14 12 L20 4 L22 12 L26 5" stroke="#AFC8FF" strokeWidth={1.5} fill="none" opacity={0.5} />
    </svg>
  );
}

interface BingbuBottomDockProps {
  overview: BingbuOverview | null;
  selectedCompetitor: CompetitorRecord | null;
  selectedBattlefield?: string;
  dockAutoExpand?: boolean;
  dockSeedPrompt?: string | null;
  onDockSeedConsumed?: () => void;
}

export function BingbuBottomDock({
  overview,
  selectedCompetitor,
  selectedBattlefield,
  dockAutoExpand = false,
  dockSeedPrompt,
  onDockSeedConsumed,
}: BingbuBottomDockProps) {
  const { messages, handleSend } = useAgentChat({
    endpoint: '/api/court/dept/ops/ask',
    greeting: selectedCompetitor
      ? `孙武回禀：已锁定「${selectedCompetitor.name}」（威胁${threatLabel(selectedCompetitor.threatLevel)} / 份额${selectedCompetitor.marketSharePct}%），请陛下示下攻守方略——臣必附情报依据与冲突声明。`
      : overview
        ? `孙武回禀：当前监控 ${overview.totalCompetitors} 家竞品，高危 ${overview.highThreatCount} 家，市场压力指数 ${overview.marketPressureIndex}/100。请陛下示下攻守方略——臣必附情报依据与冲突声明。`
        : '孙武回禀：兵部已就位，静候陛下军令。',
    accent: BINGBU_ACCENT,
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
    if (!overview) return [];
    const base: { label: string; value: string }[] = [
      { label: '竞品', value: String(overview.totalCompetitors) },
      { label: '高危', value: String(overview.highThreatCount) },
      { label: '压力', value: String(overview.marketPressureIndex) },
    ];
    if (selectedCompetitor) {
      base.push(
        { label: '威胁', value: threatLabel(selectedCompetitor.threatLevel) },
        { label: '份额', value: `${selectedCompetitor.marketSharePct}%` },
      );
    }
    return base;
  })();

  const teaser = selectedCompetitor
    ? `焦点：${selectedCompetitor.name} · ${threatLabel(selectedCompetitor.threatLevel)}威胁 · ${selectedBattlefield ?? '战场'}`
    : overview
      ? `高危竞品 ${overview.highThreatCount} 家，孙武请陛下定夺攻守。`
      : '孙武在案 · 天下未分，先看竞品态势。';

  /* ── 焦点面板 ── */
  const focusPanel = selectedCompetitor ? (
    <div className="space-y-3">
      {/* 决策上下文 */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: BINGBU_ACCENT }}>
          决策上下文 · Decision Context
        </div>
        <p className="mt-2 text-[12px] leading-6 text-[#F5E9C9]">
          {selectedCompetitor.threatLevel === 'critical'
            ? '⚠️ 该竞品威胁评级「危急」，建议立即启动最高级别反制预案，同步通报军机处与礼部。'
            : selectedCompetitor.threatLevel === 'high'
              ? '🔴 高威胁竞品，建议优先部署防守兵力，密切关注其动向变化。'
              : selectedCompetitor.threatLevel === 'medium'
                ? '🟡 中等威胁，可保持侦察频率，暂不需大规模兵力调动。'
                : '🟢 低威胁竞品，维持常规监控即可。'}
        </p>
      </div>

      {/* 竞品弱点（可攻击窗口） */}
      {selectedCompetitor.weaknesses.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#3DD68C' }}>
            可攻击窗口 · Attack Windows
          </div>
          <div className="space-y-1">
            {selectedCompetitor.weaknesses.slice(0, 3).map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#3DD68C' }} />
                <span className="text-[11px] leading-5 text-[#C6BB9D]">{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 竞品优势（需警惕） */}
      {selectedCompetitor.strengths.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#F43F5E' }}>
            敌方优势 · Hostile Strengths
          </div>
          <div className="space-y-1">
            {selectedCompetitor.strengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#F43F5E' }} />
                <span className="text-[11px] leading-5 text-[#FCA5B8]">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 同级竞品对比 */}
      {overview && (() => {
        const peers = overview.competitors
          .filter(c => c.threatLevel === selectedCompetitor.threatLevel && c.id !== selectedCompetitor.id)
          .slice(0, 3);
        return peers.length > 0 ? (
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#F0C66A' }}>
              同级威胁对比
            </div>
            <div className="space-y-1">
              {peers.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                  <span className="truncate text-[11px] text-[#C6BB9D]">{p.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-[10px]" style={{ color: BINGBU_ACCENT }}>{p.marketSharePct}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}
    </div>
  ) : overview ? (
    <div className="space-y-3">
      {/* 无选中时 — 战局总览 */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: BINGBU_ACCENT }}>
          战局总览 · Battle Overview
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-[20px] font-semibold text-[#F5E9C9]">
            {overview.marketPressureIndex}<span className="text-[14px] text-[#8F9AB8]">/100</span>
          </div>
          <span className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: `${BINGBU_ACCENT}66`, color: BINGBU_ACCENT, background: `${BINGBU_ACCENT}10` }}>
            市场压力指数
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '监控竞品', value: String(overview.totalCompetitors), color: '#6BA0FF' },
          { label: '高危威胁', value: String(overview.highThreatCount), color: '#F43F5E' },
          { label: '战略建议', value: String(overview.recommendations.length), color: '#3DD68C' },
          { label: 'SWOT 置信', value: `${Math.round(overview.swot.confidence * 100)}%`, color: '#F0C66A' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-2.5" style={{ borderColor: `${item.color}33`, background: `linear-gradient(160deg, ${item.color}0a, rgba(0,0,0,0.3))` }}>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: item.color }}>{item.label}</div>
            <div className="mt-1 font-mono text-[14px] font-semibold text-[#F5E9C9]">{item.value}</div>
          </div>
        ))}
      </div>

      {/* 高危竞品列表 */}
      {overview.competitors.filter(c => c.threatLevel === 'critical' || c.threatLevel === 'high').length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#F43F5E' }}>
            高危竞品 · High Threat
          </div>
          <div className="space-y-1">
            {overview.competitors.filter(c => c.threatLevel === 'critical' || c.threatLevel === 'high').slice(0, 3).map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5">
                <span className="truncate text-[11px] text-[#D6CCB0]">{c.name}</span>
                <span className="ml-2 shrink-0 font-mono text-[10px]" style={{ color: THREAT_ACCENT(c.threatLevel) }}>{threatLabel(c.threatLevel)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <BottomDock
      title="Operations Ministry · 兵部"
      name={selectedCompetitor ? `战情台 · ${selectedCompetitor.name.slice(0, 12)}` : '兵部尚书 · 战情台'}
      accent={BINGBU_ACCENT}
      avatar={<BingbuAvatar />}
      quickPrompts={buildQuickPrompts(selectedCompetitor)}
      messages={messages}
      placeholder={selectedCompetitor ? `就「${selectedCompetitor.name}」下旨...` : '请陛下示下军令...'}
      sendLabel="出兵"
      onSend={handleSend}
      badges={badges}
      focusPanel={focusPanel}
      collapsedTeaser={teaser}
      defaultExpanded={dockAutoExpand}
    />
  );
}

function THREAT_ACCENT(level: CompetitorRecord['threatLevel']): string {
  if (level === 'critical') return '#F43F5E';
  if (level === 'high') return '#FB923C';
  if (level === 'medium') return '#F0C66A';
  return '#3DD68C';
}
