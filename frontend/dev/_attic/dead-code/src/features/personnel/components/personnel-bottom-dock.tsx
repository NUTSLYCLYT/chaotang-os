'use client';

/**
 * 吏部 · 底部 BottomDock — 上下文感知版
 *
 * 模仿户部 HubuBottomDock 模式：
 *   - 无选中岗位 → 显示组织总览 + 通用 prompts
 *   - 有选中岗位 → 显示岗位上下文 + 针对性 prompts
 *
 * 所有上下文数据根据 selectedPosition 动态生成。
 */

import { BottomDock } from '@/features/shared/components/bottom-dock';
import { useAgentChat } from '@/features/swarm/lib/use-agent-chat';
import type { PersonnelPosition, PersonnelOverview } from '@/lib/contracts/personnel';
import { PERSONNEL_POSITION_STATUS_LABEL } from '@/lib/contracts/personnel';

const PERSONNEL_ACCENT = '#6BA0FF';
const GREEN = '#3DD68C';
const RED = '#F43F5E';
const AMBER = '#FB923C';

/* ── 动态 Quick Prompts ── */

function buildQuickPrompts(position: PersonnelPosition | null): string[] {
  if (!position) {
    return [
      '当前组织最大的单点风险在哪里？',
      '核心岗位空缺中，哪个最该优先补？',
      '华东技术团队超载怎么缓解？',
      '人才质量 A- 评级能否撑住下半年的增长需求？',
      '敏感权限审计该复查哪些岗位？',
    ];
  }

  const label = PERSONNEL_POSITION_STATUS_LABEL[position.status];
  return [
    `「${position.title}」当前状态为「${label}」，组织影响多大？`,
    `补「${position.title}」的最佳候选人是谁？给数据依据。`,
    `「${position.title}」的继任覆盖是否充分？`,
    position.candidates.length > 0
      ? `「${position.title}」候选人 ${position.candidates.map(c => c.name).join('、')}，各有什么优劣？`
      : `「${position.title}」暂无候选人，该从哪里挖？`,
    `若「${position.title}」出现离职风险，哪些跨部门协作链路会受影响？`,
  ];
}

/* ── 动态 Badges ── */

function buildBadges(position: PersonnelPosition | null, overview: PersonnelOverview | null) {
  const base: { label: string; value: string }[] = [];
  if (overview?.orgHealth) {
    base.push(
      { label: '人才', value: `${overview.orgHealth.totalHeadcount}` },
      { label: '核心岗', value: `${overview.orgHealth.corePositions}` },
      { label: '风险', value: `${overview.orgHealth.singlePointRisks}` },
    );
  }
  if (position) {
    base.push(
      { label: '选中', value: position.team },
      { label: '状态', value: PERSONNEL_POSITION_STATUS_LABEL[position.status] },
    );
  }
  return base;
}

/* ── 动态 Focus Panel ── */

function buildFocusPanel(position: PersonnelPosition | null, overview: PersonnelOverview | null) {
  if (!overview) return null;

  return (
    <div className="space-y-3">
      {position ? (
        <>
          {/* 选中岗位上下文 */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: PERSONNEL_ACCENT }}>
              决策上下文 · Decision Context
            </div>
            <p className="mt-2 text-[12px] leading-6 text-[#F5E9C9]">
              {position.status === 'single_point'
                ? '🚨 高危：该岗位为单点依赖，无继任计划。一旦离职将导致关键能力断档。建议立即启动双人补岗。'
                : position.status === 'vacant'
                  ? '⚠️ 该岗位空缺超 45 天，已进入合规警戒线。建议加速候选人筛选。'
                  : position.status === 'overload'
                    ? '⚡ 该团队负载超 100%，建议拆岗或补副手以减轻单点压力。'
                    : '✅ 岗位运行健康，编制满额，可按常规流程管理。'}
            </p>
          </div>

          {/* 候选人速览 */}
          {position.candidates.length > 0 && (
            <div>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: GREEN }}>
                候选人速览
              </div>
              <div className="space-y-1">
                {position.candidates.slice(0, 3).map((c) => (
                  <div
                    key={c.name}
                    className="flex items-start justify-between rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                  >
                    <div>
                      <span className="text-[11px] text-[#C6BB9D]">{c.name}</span>
                      <p className="mt-0.5 text-[9px] text-[#6A7299]">{c.note}</p>
                    </div>
                    <span className="ml-2 shrink-0 font-mono text-[10px]" style={{ color: GREEN }}>
                      {c.match}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 同级岗位对比 */}
          {(() => {
            const peers = overview.positions
              .filter((p) => p.team === position.team && p.id !== position.id)
              .slice(0, 3);
            return peers.length > 0 ? (
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#C070D0' }}>
                  同级岗位对比 · {position.team}
                </div>
                <div className="space-y-1">
                  {peers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                    >
                      <span className="truncate text-[11px] text-[#C6BB9D]">{p.title}</span>
                      <span
                        className="ml-2 shrink-0 font-mono text-[10px]"
                        style={{ color: p.status === 'healthy' ? GREEN : p.status === 'overload' ? AMBER : RED }}
                      >
                        {PERSONNEL_POSITION_STATUS_LABEL[p.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </>
      ) : (
        <>
          {/* 无选中时 — 组织总览 */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: PERSONNEL_ACCENT }}>
              组织总览 · Org Overview
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-[20px] font-semibold text-[#F5E9C9]">
                {overview.orgHealth.totalHeadcount.toLocaleString()}
              </div>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: `${PERSONNEL_ACCENT}66`,
                  color: PERSONNEL_ACCENT,
                  background: `${PERSONNEL_ACCENT}10`,
                }}
              >
                在岗总人数
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '核心岗位', value: `${overview.orgHealth.corePositions}`, color: '#3DD68C' },
              { label: '空缺岗位', value: `${overview.orgHealth.totalVacant}`, color: '#F43F5E' },
              { label: '满编率', value: `${overview.orgHealth.coreFilledRate}%`, color: PERSONNEL_ACCENT },
              { label: '人才质量', value: overview.orgHealth.talentQuality, color: '#C070D0' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border p-2.5"
                style={{
                  borderColor: `${item.color}33`,
                  background: `linear-gradient(160deg, ${item.color}0a, rgba(0,0,0,0.3))`,
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: item.color }}>
                  {item.label}
                </div>
                <div className="mt-1 font-mono text-[14px] font-semibold text-[#F5E9C9]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* 判词 */}
          {overview.orgHealth.recommendation && (
            <div
              className="rounded-lg border px-3 py-2 text-[11px] leading-5"
              style={{
                borderColor: `${PERSONNEL_ACCENT}33`,
                background: `${PERSONNEL_ACCENT}08`,
                color: '#C6BB9D',
              }}
            >
              <span className="mr-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: PERSONNEL_ACCENT }}>
                建议：
              </span>
              {overview.orgHealth.recommendation}
            </div>
          )}

          {/* 高风险岗位列表 */}
          {(() => {
            const risks = overview.positions.filter(
              (p) => p.status === 'single_point' || p.status === 'vacant',
            );
            return risks.length > 0 ? (
              <div>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em]" style={{ color: '#F43F5E' }}>
                  组织警报
                </div>
                <div className="space-y-1">
                  {risks.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5"
                    >
                      <span className="truncate text-[11px] text-[#D6CCB0]">{p.title}</span>
                      <span
                        className="ml-2 shrink-0 font-mono text-[10px]"
                        style={{ color: p.status === 'single_point' ? '#F43F5E' : '#FB923C' }}
                      >
                        {PERSONNEL_POSITION_STATUS_LABEL[p.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </>
      )}
    </div>
  );
}

/* ── 动态 Greeting ── */

function buildGreeting(position: PersonnelPosition | null): string {
  if (position) {
    const label = PERSONNEL_POSITION_STATUS_LABEL[position.status];
    return `臣吏部尚书接旨。已加载岗位「${position.title}」（${position.team} / ${label} / ${position.filled}/${position.headcount}），请陛下示下组织取舍——臣必附数据依据与冲突声明。`;
  }
  return '臣吏部尚书恭请陛下示下。在岗人才/核心岗位/继任覆盖已核账，可询任免取舍——臣必附数据依据与冲突声明。';
}

/* ── 动态 Teaser ── */

function buildTeaser(position: PersonnelPosition | null): string | undefined {
  if (!position) return '吏部在案 · 只看组织系统信号，不用小样本判断具体个人。';
  return `焦点：${position.title} · ${position.team} · ${PERSONNEL_POSITION_STATUS_LABEL[position.status]}`;
}

/* ═══════════ 组件 ═══════════ */

interface PersonnelBottomDockProps {
  overview: PersonnelOverview | null;
  selectedPosition: PersonnelPosition | null;
}

export function PersonnelBottomDock({ overview, selectedPosition }: PersonnelBottomDockProps) {
  const { messages, handleSend } = useAgentChat({
    endpoint: '/api/court/dept/hr/ask',
    greeting: buildGreeting(selectedPosition),
    accent: PERSONNEL_ACCENT,
  });

  const quickPrompts = buildQuickPrompts(selectedPosition);
  const badges = buildBadges(selectedPosition, overview);
  const focusPanel = buildFocusPanel(selectedPosition, overview);
  const teaser = buildTeaser(selectedPosition);

  return (
    <BottomDock
      title="Personnel Ministry · 吏部"
      name={selectedPosition ? `组织台 · ${selectedPosition.title.slice(0, 12)}` : '吏部尚书 · 组织台'}
      accent={PERSONNEL_ACCENT}
      avatar={<span className="text-[18px]">🧭</span>}
      quickPrompts={quickPrompts}
      messages={messages}
      placeholder={
        selectedPosition
          ? `就「${selectedPosition.title}」下旨...`
          : '请陛下示下组织人才事宜...'
      }
      sendLabel="下旨"
      onSend={handleSend}
      badges={badges}
      focusPanel={focusPanel}
      collapsedTeaser={teaser}
    />
  );
}
