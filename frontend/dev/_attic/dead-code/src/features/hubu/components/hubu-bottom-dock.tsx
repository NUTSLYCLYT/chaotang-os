'use client';

/**
 * 户部 · 底部 BottomDock
 *
 * 承接线所有户部下旨/决策动作——选中项目上下文在此统一处置。
 * 锦衣卫同构：底部是唯一的"下旨"入口，面板内不再散落决策按钮。
 *
 * LLM 可通过 get_finance_metrics 工具读取 Turso 财政数据，回答带 citations。
 */

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import type { HubuOverview, HubuProject } from '@/lib/contracts/hubu';
import { useEffect, useRef } from 'react';

const HUBU_ACCENT = '#ebcb7b';

/** 根据选中项目动态生成 quick prompts */
function buildQuickPrompts(project: HubuProject | null): string[] {
  if (!project) {
    return [
      '三个待批项目先批哪个？给数据依据。',
      '现金储备够撑当前待批预算合计吗？',
      '哪个待批项目最该砍或暂缓？',
      '按 ROI 排，预算该怎么分配？',
    ];
  }

  return [
    `「${project.title}」ROI ${project.estimated_roi}，预算${project.requested_budget}，风险${project.risk_level}——该批还是该退？`,
    `核验「${project.title}」的 ROI 假设和回收期${project.payback_window}是否合理。`,
    `若批「${project.title}」，现金余量还够撑其他待批项目吗？`,
    `「${project.title}」的验收标准我该补什么证据？`,
    `把「${project.title}」交工部${project.target_dept}之前，户部还需要做什么？`,
  ];
}

/** 户部神将 SVG 头像（简版） */
function HubuAvatar() {
  return (
    <svg viewBox="0 0 36 36" width={28} height={28} fill="none" aria-hidden>
      <circle cx={18} cy={12} r={7} fill="#ebcb7b" opacity={0.85} />
      <path
        d="M6 34c0-7 5-11 12-11s12 4 12 11"
        stroke="#ebcb7b"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      <path
        d="M12 7 C12 2, 24 2, 24 7"
        stroke="#c9a54a"
        strokeWidth={1.5}
        fill="none"
        opacity={0.6}
      />
    </svg>
  );
}

interface HubuBottomDockProps {
  overview: HubuOverview | null;
  selectedProject: HubuProject | null;
  dockAutoExpand?: boolean;
  dockSeedPrompt?: string | null;
  onDockSeedConsumed?: () => void;
}

export function HubuBottomDock({ overview, selectedProject, dockAutoExpand = false, dockSeedPrompt, onDockSeedConsumed }: HubuBottomDockProps) {
  const { messages, handleSend } = useAgentChat({
    endpoint: '/api/court/hubu/ask',
    greeting: selectedProject
      ? `臣户部尚书接旨。已加载项目「${selectedProject.title}」（${selectedProject.priority} / ${selectedProject.estimated_roi} ROI / 预算${selectedProject.requested_budget}），请陛下示下审批取舍——臣必附数据依据与冲突声明。`
      : '臣户部尚书恭请陛下示下。预算池/待批项目/ROI/现金储备已核账，可询审批取舍——臣必附数据依据与冲突声明。',
    accent: HUBU_ACCENT,
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
    if (overview?.summary) {
      base.push(
        { label: '待批', value: String(overview.summary.pending_count) },
        { label: 'ROI', value: overview.summary.avg_roi },
        { label: '余量', value: overview.summary.cash_reserve },
      );
    }
    if (selectedProject) {
      base.push(
        { label: '选中', value: selectedProject.priority },
        { label: '风险', value: selectedProject.risk_level },
      );
    }
    return base;
  })();

  const teaser = selectedProject
    ? `焦点：${selectedProject.title} · ROI ${selectedProject.estimated_roi} · ${selectedProject.priority}`
    : undefined;

  const focusPanel = overview ? (
    <div className="space-y-3">
      {/* 选中项目优先 */}
      {selectedProject ? (
        <>
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: HUBU_ACCENT }}>
              决策上下文 · Decision Context
            </div>
            <p className="mt-2 text-[12px] leading-6 text-[#F5E9C9]">
              {selectedProject.risk_level === 'critical'
                ? '⚠️ 该项目风险评级「紧急」，建议先退回补证再进入审批流程。'
                : selectedProject.priority === 'P0'
                  ? '✅ 高优先级项目，建议准奏并同步启动军机执行。'
                  : selectedProject.estimated_roi.includes('高')
                    ? '✅ 高回报项目，建议准奏。注意核查回收期与现金流匹配。'
                    : '📋 该项目可按常规流程审批。注意核查回收期与现金流匹配。'}
            </p>
          </div>

          {/* 验收标准 */}
          {selectedProject.acceptance_criteria.length > 0 && (
            <div>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: HUBU_ACCENT }}>
                验收要点
              </div>
              <div className="space-y-1">
                {selectedProject.acceptance_criteria.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: HUBU_ACCENT }} />
                    <span className="text-[11px] leading-5 text-[#C6BB9D]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 同级项目对比 */}
          {(() => {
            const peers = overview.projects
              .filter(p => p.priority === selectedProject.priority && p.id !== selectedProject.id)
              .slice(0, 3);
            return peers.length > 0 ? (
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#6BA0FF' }}>
                  同级项目对比
                </div>
                <div className="space-y-1">
                  {peers.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
                      <span className="truncate text-[11px] text-[#C6BB9D]">{p.title}</span>
                      <span className="ml-2 shrink-0 font-mono text-[10px]" style={{ color: HUBU_ACCENT }}>{p.estimated_roi}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </>
      ) : (
        <>
          {/* 无选中时 — 财政总览 */}
          <div>
            <div
              className="text-[9px] uppercase tracking-[0.22em]"
              style={{ color: HUBU_ACCENT }}
            >
              财政总览 · Finance Overview
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-[20px] font-semibold text-[#F5E9C9]">
                {overview.summary.total_requested}
              </div>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: `${HUBU_ACCENT}66`,
                  color: HUBU_ACCENT,
                  background: `${HUBU_ACCENT}10`,
                }}
              >
                总申请预算
              </span>
              {overview.summary.source === 'turso' && (
                <span className="rounded border border-[#3DD68C]/40 bg-[#3DD68C]/10 px-1.5 py-0.5 text-[9px] text-[#3DD68C]">
                  Turso 实时
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '本周已准', value: overview.summary.approved_this_week, color: '#3DD68C' },
              { label: '现金余量', value: overview.summary.cash_reserve, color: '#6BA0FF' },
              { label: '平均 ROI', value: overview.summary.avg_roi, color: HUBU_ACCENT },
              { label: '待批数', value: String(overview.summary.pending_count), color: '#FB923C' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border p-2.5"
                style={{
                  borderColor: `${item.color}33`,
                  background: `linear-gradient(160deg, ${item.color}0a, rgba(0,0,0,0.3))`,
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: item.color }}
                >
                  {item.label}
                </div>
                <div className="mt-1 font-mono text-[14px] font-semibold text-[#F5E9C9]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {overview.summary.recommendation && (
            <div
              className="rounded-lg border px-3 py-2 text-[11px] leading-5"
              style={{
                borderColor: `${HUBU_ACCENT}33`,
                background: `${HUBU_ACCENT}08`,
                color: '#C6BB9D',
              }}
            >
              <span
                className="mr-1 text-[9px] uppercase tracking-[0.18em]"
                style={{ color: HUBU_ACCENT }}
              >
                建议：
              </span>
              {overview.summary.recommendation}
            </div>
          )}

          {/* 待批项目列表 */}
          {overview.projects.filter((p) => p.status === 'pending_review').length > 0 && (
            <div>
              <div
                className="mb-1.5 text-[9px] uppercase tracking-[0.2em]"
                style={{ color: '#FB923C' }}
              >
                待批项目
              </div>
              <div className="space-y-1">
                {overview.projects
                  .filter((p) => p.status === 'pending_review')
                  .slice(0, 3)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5"
                    >
                      <span className="truncate text-[11px] text-[#D6CCB0]">{p.title}</span>
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-[#3DD68C]">
                        {p.estimated_roi}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  ) : null;

  return (
    <BottomDock
      title="Revenue Ministry · 户部"
      name={selectedProject ? `理财台 · ${selectedProject.title.slice(0, 12)}` : '户部尚书 · 理财台'}
      accent={HUBU_ACCENT}
      avatar={<HubuAvatar />}
      quickPrompts={buildQuickPrompts(selectedProject)}
      messages={messages}
      placeholder={
        selectedProject
          ? `就「${selectedProject.title}」下旨...`
          : '请陛下示下财政事宜...'
      }
      sendLabel="下旨"
      onSend={handleSend}
      badges={badges}
      focusPanel={focusPanel}
      collapsedTeaser={teaser}
      defaultExpanded={dockAutoExpand}
    />
  );
}
