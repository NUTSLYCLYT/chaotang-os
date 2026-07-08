'use client';

/**
 * 军机处 · 作战流 (BattleStream)
 *
 * 订阅 SSE court stream，将事件实时渲染为可视化时间线：
 *   - 丞相理解 (decree.understood)
 *   - 大臣会审 (minister.opinion)
 *   - 庄园执行 (group.dispatch / subagent.step / group.aggregated)
 *   - 风险通报 (risk.flagged)
 *   - 跨组汇总 (council.aggregated)
 *   - 奏折生成 (memorial.drafted)
 *   - done / error 终止状态
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SignalPulseDot } from '@/components/SignalPulseDot';
import { EnterStagger } from '@/components/EnterStagger';
import { Pulse } from '@/components/Pulse';
import { StatusPillButton } from '@/components/StatusPillButton';
import { subscribeCourtStream } from '@/lib/api/chaotang';
import type { SanshengEvent, ShengCode } from '@/lib/contracts/events';
import { isSanshengEvent } from '@/lib/contracts/events';

/* ── Court SSE event contract (structured, no bare assertions) ───────────────
 *
 * DATA-EVT-03: 后端 court stream 推送的 decree.understood / minister.opinion /
 * group.dispatch / subagent.step / group.aggregated / council.aggregated /
 * risk.flagged / memorial.drafted / council.summon / done / error 事件先前在组件
 * 内以 `ev.x as string | undefined` 裸断言逐字段读取。此处以判别联合 (discriminated
 * union) 对每个 type 建模,并提供 readStr/readNum 安全读取器,把裸断言替换为契约类型
 * 收窄 + 可选链,避免 any / bare assertion(§8)。事件处理与渲染逻辑完全不变。
 *
 * 注:SSE payload 经 JSON.parse 得到 Record<string, unknown>,字段可能缺失或类型
 * 不符,故各字段保持 optional 并经 readStr/readNum 做运行时类型校验。
 */

/** court stream 原始事件:JSON.parse 产物,字段不可信 */
type RawStreamEvent = Record<string, unknown>;

interface DecreeUnderstoodEvent {
  type: 'decree.understood';
  intent?: string;
  summary?: string;
}

interface MinisterOpinionEvent {
  type: 'minister.opinion';
  agentCode?: string;
  name?: string;
  status?: string;
  output?: string;
}

interface GroupDispatchEvent {
  type: 'group.dispatch';
  groupId?: string;
  name?: string;
}

interface SubagentStepEvent {
  type: 'subagent.step';
  content?: string;
}

interface GroupAggregatedEvent {
  type: 'group.aggregated';
  groupId?: string;
  summary?: string;
}

interface CouncilAggregatedEvent {
  type: 'council.aggregated';
  summary?: string;
}

interface RiskFlaggedEvent {
  type: 'risk.flagged';
  level?: string;
  label?: string;
  detail?: string;
}

interface MemorialDraftedEvent {
  type: 'memorial.drafted';
  memorialId?: string;
  runId?: string;
  qualityScore?: number;
}

interface DoneEvent {
  type: 'done';
  memorialId?: string;
  runId?: string;
}

interface ErrorEvent {
  type: 'error';
  message?: string;
}

interface CouncilSummonEvent {
  type: 'council.summon';
}

interface HeartbeatEvent {
  type: 'heartbeat';
}

/** court stream 判别联合 — type 字段判别。SanshengEvent 来自 events.ts 契约 */
type CourtStreamEvent =
  | SanshengEvent
  | DecreeUnderstoodEvent
  | MinisterOpinionEvent
  | GroupDispatchEvent
  | SubagentStepEvent
  | GroupAggregatedEvent
  | CouncilAggregatedEvent
  | RiskFlaggedEvent
  | MemorialDraftedEvent
  | DoneEvent
  | ErrorEvent
  | CouncilSummonEvent
  | HeartbeatEvent;

type CourtStreamEventType = CourtStreamEvent['type'];

/** 运行时安全读取器:仅在字段确为 string 时返回,否则 undefined(替代裸 `as string`) */
function readStr(ev: RawStreamEvent, key: string): string | undefined {
  const v = ev[key];
  return typeof v === 'string' ? v : undefined;
}

/** 运行时安全读取器:仅在字段确为有限 number 时返回,否则 undefined */
function readNum(ev: RawStreamEvent, key: string): number | undefined {
  const v = ev[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** 类型守卫:把原始 SSE payload 收窄为已知 court 事件类型(判别 type 字段) */
function isCourtStreamEvent(ev: RawStreamEvent): ev is RawStreamEvent & { type: CourtStreamEventType } {
  return typeof ev.type === 'string';
}

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface MinisterRow {
  agentCode: string;
  name: string;
  status: 'running' | 'completed';
  opinion: string;
}

export interface GroupCard {
  groupId: string;
  name: string;
  status: 'dispatching' | 'running' | 'aggregated';
  liveText: string;   // accumulated subagent.step content
  summary?: string;
}

export interface RiskBanner {
  level: string;
  label: string;
  detail: string;
}

/** 单省当前状态快照 */
export interface SanshengStateEntry {
  sheng: ShengCode;
  shengName: string;
  status: SanshengEvent['status'];
  summary: string;
}

/** 三省状态映射 — 键为 ShengCode */
export type SanshengStates = Partial<Record<ShengCode, SanshengStateEntry>>;

interface StreamState {
  decreeIntent?: string;
  decreeSummary?: string;
  ministers: MinisterRow[];
  groups: GroupCard[];
  activeGroupId?: string;   // most recently dispatched group for subagent.step routing
  risks: RiskBanner[];
  councilSummary?: string;
  memorialId?: string;
  runId?: string;
  qualityScore?: number;
  streamStatus: 'idle' | 'live' | 'done' | 'error';
  errorMessage?: string;
  sanshengStates: SanshengStates;
}

/** 作战流终态标签 — 供左/右栏热区面板复用同一 SSE 解析结果 */
export type StreamStatus = StreamState['streamStatus'];

/** 最终奏折快照 — 军机处「最终奏折」热区面板复用，不另开 SSE 连接 */
export interface MemorialSnapshot {
  memorialId?: string;
  runId?: string;
  qualityScore?: number;
  streamStatus: StreamStatus;
}

const INITIAL_STATE: StreamState = {
  ministers: [],
  groups: [],
  risks: [],
  streamStatus: 'idle',
  sanshengStates: {},
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

const RISK_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  low:      { border: '#3DD68C40', bg: '#3DD68C0D', text: '#3DD68C', dot: 'info'     },
  medium:   { border: '#F0C66A40', bg: '#F0C66A0D', text: '#F0C66A', dot: 'watch'    },
  high:     { border: '#F5A52440', bg: '#F5A5240D', text: '#F5A524', dot: 'warning'  },
  critical: { border: '#F43F5E40', bg: '#F43F5E0D', text: '#F43F5E', dot: 'critical' },
};

function riskStyle(level: string) {
  return RISK_COLORS[level] ?? RISK_COLORS.medium;
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-eyebrow mb-2 mt-5 first:mt-0">{children}</div>
  );
}

function DecreeCard({ intent, summary }: { intent?: string; summary?: string }) {
  if (!intent && !summary) return null;
  return (
    <GlassPanel variant="gold" tone="elevated" padding="md" hudCorners>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-[20px]">📜</span>
        <div className="min-w-0 flex-1">
          <div className="section-eyebrow mb-1">丞相理解 · Decree Understood</div>
          {intent && (
            <div className="text-[14px] font-semibold leading-[1.6] text-[#F6EFD8]">{intent}</div>
          )}
          {summary && (
            <div className="mt-1 text-[12px] leading-[1.75] text-[#B6BDD5]">{summary}</div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function MinisterRow({ row }: { row: MinisterRow }) {
  const isRunning = row.status === 'running';
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      {isRunning ? (
        <span className="mt-1 flex-shrink-0">
          <SignalPulseDot level="watch" size={6} />
        </span>
      ) : (
        <span className="mt-1 flex-shrink-0 h-[18px] w-[18px] flex items-center justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3DD68C] opacity-80" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[#F6EFD8]">{row.name}</span>
          <span className="font-mono text-[10px] text-[#8F835F]">{row.agentCode}</span>
        </div>
        {row.opinion && (
          <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.6] text-[#9AA3C4]">
            {row.opinion}
          </div>
        )}
      </div>
      <StatusPillButton
        status={isRunning ? 'running' : 'done'}
        showLabel
        className="flex-shrink-0 text-[10px]"
      />
    </div>
  );
}

function GroupCard({ card }: { card: GroupCard }) {
  const textareaRef = useRef<HTMLDivElement>(null);
  const isDone = card.status === 'aggregated';
  const isRunning = card.status === 'running';

  // auto-scroll live text area
  useEffect(() => {
    if (textareaRef.current && isRunning) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [card.liveText, isRunning]);

  return (
    <GlassPanel
      variant={isDone ? 'success' : 'default'}
      tone="elevated"
      padding="sm"
      className="overflow-hidden"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {isRunning && (
            <Pulse color="#6BA0FF" intensity="subtle">
              <span className="h-2 w-2 rounded-full bg-[#6BA0FF]" />
            </Pulse>
          )}
          {isDone && <span className="h-2 w-2 rounded-full bg-[#3DD68C]" />}
          {card.status === 'dispatching' && (
            <span className="h-2 w-2 animate-breathe rounded-full bg-[#F0C66A] opacity-60" />
          )}
          <span className="text-[12px] font-semibold text-[#F6EFD8]">{card.name}</span>
          <span className="font-mono text-[10px] text-[#8F835F]">{card.groupId}</span>
        </div>
        <StatusPillButton
          status={isDone ? 'done' : isRunning ? 'running' : 'busy'}
          showLabel
          className="text-[10px]"
        />
      </div>

      {/* Live subagent text */}
      {card.liveText && (
        <div
          ref={textareaRef}
          className="max-h-[180px] overflow-y-auto rounded-md border border-white/[0.06] bg-[#0A0704]/60 px-3 py-2 font-mono text-[11px] leading-[1.7] text-[#9AA3C4] whitespace-pre-wrap"
          style={{ scrollBehavior: 'smooth' }}
        >
          {card.liveText}
          {isRunning && (
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-breathe bg-[#F0C66A] align-middle opacity-80" />
          )}
        </div>
      )}

      {/* Aggregated summary */}
      {isDone && card.summary && (
        <div className="mt-2 rounded-md border border-[#3DD68C]/20 bg-[#3DD68C]/[0.04] px-3 py-2 text-[11.5px] leading-[1.7] text-[#A8E6C9]">
          {card.summary}
        </div>
      )}
    </GlassPanel>
  );
}

function RiskBanner({ risk }: { risk: RiskBanner }) {
  const s = riskStyle(risk.level);
  return (
    <div
      className="flex items-start gap-3 rounded-lg px-3 py-2.5"
      style={{ border: `1px solid ${s.border}`, background: s.bg }}
    >
      <SignalPulseDot
        level={s.dot as 'info' | 'watch' | 'warning' | 'critical'}
        size={6}
        withPulse={risk.level === 'critical' || risk.level === 'high'}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold" style={{ color: s.text }}>
          {risk.label}
        </div>
        {risk.detail && (
          <div className="mt-0.5 text-[11px] leading-[1.6] text-[#9AA3C4]">{risk.detail}</div>
        )}
      </div>
      <span
        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: s.border, color: s.text }}
      >
        {risk.level}
      </span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export interface BattleStreamProps {
  taskId: string;
  /** 每当三省状态更新时回调(用于左栏面板复用同一 SSE 的解析结果,不开第二条连接) */
  onSanshengChange?: (states: SanshengStates) => void;
  /** 大臣会审列表变化时回调(右栏面板动态参与大臣) */
  onMinistersChange?: (ministers: MinisterRow[]) => void;
  /** 风险通报列表变化时回调(右栏面板真实争议风险) */
  onRisksChange?: (risks: RiskBanner[]) => void;
  /** 蜂群派遣/执行状态变化时回调(左栏蜂群格动态高亮) */
  onGroupsChange?: (groups: GroupCard[]) => void;
  /** 跨组汇总(council.aggregated)变化时回调(右栏「大臣会审」结论复用) */
  onCouncilSummaryChange?: (summary: string | undefined) => void;
  /** 奏折/终态变化时回调(右栏「最终奏折」面板复用,不另开 SSE) */
  onMemorialChange?: (memorial: MemorialSnapshot) => void;
}

export function BattleStream({ taskId, onSanshengChange, onMinistersChange, onRisksChange, onGroupsChange, onCouncilSummaryChange, onMemorialChange }: BattleStreamProps) {
  const router = useRouter();
  const [state, setState] = useState<StreamState>(INITIAL_STATE);

  // 三省状态变化时通知父组件(左栏面板),避免双 SSE 竞争
  useEffect(() => {
    onSanshengChange?.(state.sanshengStates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sanshengStates]);

  // 大臣会审变化时通知右栏面板
  useEffect(() => {
    onMinistersChange?.(state.ministers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ministers]);

  // 风险通报变化时通知右栏面板
  useEffect(() => {
    onRisksChange?.(state.risks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.risks]);

  // 蜂群派遣/执行状态变化时通知左栏蜂群格
  useEffect(() => {
    onGroupsChange?.(state.groups);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.groups]);

  // 跨组汇总变化时通知右栏「大臣会审」结论
  useEffect(() => {
    onCouncilSummaryChange?.(state.councilSummary);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.councilSummary]);

  // 奏折/终态变化时通知右栏「最终奏折」面板
  useEffect(() => {
    onMemorialChange?.({
      memorialId: state.memorialId,
      runId: state.runId,
      qualityScore: state.qualityScore,
      streamStatus: state.streamStatus,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.memorialId, state.runId, state.qualityScore, state.streamStatus]);

  useEffect(() => {
    if (!taskId) return;

    // Reset on new taskId
    setState(INITIAL_STATE);

    const cancel = subscribeCourtStream(
      taskId,
      (ev) => {
        // 收窄为已知 court 事件类型;无 type 字段则忽略
        if (!isCourtStreamEvent(ev)) return;
        const type = ev.type;

        setState((prev) => {
          // heartbeat — ignore
          if (type === 'heartbeat') return prev;

          // 三省语义事件 — 更新对应省状态快照
          if (type === 'sansheng' && isSanshengEvent(ev)) {
            const entry: SanshengEvent = ev;
            const sanshengStates: SanshengStates = {
              ...prev.sanshengStates,
              [entry.sheng]: {
                sheng: entry.sheng,
                shengName: entry.shengName,
                status: entry.status,
                summary: entry.summary,
              },
            };
            return { ...prev, sanshengStates };
          }

          if (type === 'decree.understood') {
            return {
              ...prev,
              streamStatus: 'live',
              decreeIntent: readStr(ev, 'intent') ?? prev.decreeIntent,
              decreeSummary: readStr(ev, 'summary') ?? prev.decreeSummary,
            };
          }

          if (type === 'council.summon') {
            return { ...prev, streamStatus: 'live' };
          }

          if (type === 'minister.opinion') {
            const agentCode = readStr(ev, 'agentCode');
            if (!agentCode) return prev;
            const name = readStr(ev, 'name') ?? agentCode;
            const status = readStr(ev, 'status') === 'completed' ? 'completed' : 'running';
            const opinion = readStr(ev, 'output') ?? '';
            const ministers = [...prev.ministers];
            const idx = ministers.findIndex((m) => m.agentCode === agentCode);
            if (idx >= 0) {
              ministers[idx] = { ...ministers[idx], status, opinion: opinion || ministers[idx].opinion };
            } else {
              ministers.push({ agentCode, name, status, opinion });
            }
            return { ...prev, ministers };
          }

          if (type === 'group.dispatch') {
            const groupId = readStr(ev, 'groupId');
            if (!groupId) return prev;
            const name = readStr(ev, 'name') ?? groupId;
            const groups = [...prev.groups];
            const idx = groups.findIndex((g) => g.groupId === groupId);
            if (idx < 0) {
              groups.push({ groupId, name, status: 'dispatching', liveText: '' });
            }
            return { ...prev, groups, activeGroupId: groupId };
          }

          if (type === 'subagent.step') {
            const content = readStr(ev, 'content') ?? '';
            const targetGroupId = prev.activeGroupId;
            if (!targetGroupId) return prev;
            const groups = prev.groups.map((g) =>
              g.groupId === targetGroupId
                ? { ...g, status: 'running' as const, liveText: g.liveText + content }
                : g,
            );
            return { ...prev, groups };
          }

          if (type === 'group.aggregated') {
            const groupId = readStr(ev, 'groupId');
            if (!groupId) return prev;
            const summary = readStr(ev, 'summary') ?? '';
            const groups = prev.groups.map((g) =>
              g.groupId === groupId
                ? { ...g, status: 'aggregated' as const, summary }
                : g,
            );
            return { ...prev, groups };
          }

          if (type === 'council.aggregated') {
            return {
              ...prev,
              councilSummary: readStr(ev, 'summary') ?? prev.councilSummary,
            };
          }

          if (type === 'risk.flagged') {
            const risks = [
              ...prev.risks,
              {
                level: readStr(ev, 'level') ?? 'medium',
                label: readStr(ev, 'label') ?? '风险通报',
                detail: readStr(ev, 'detail') ?? '',
              },
            ];
            return { ...prev, risks };
          }

          if (type === 'memorial.drafted') {
            return {
              ...prev,
              memorialId: readStr(ev, 'memorialId'),
              runId: readStr(ev, 'runId'),
              qualityScore: readNum(ev, 'qualityScore'),
            };
          }

          if (type === 'done') {
            return {
              ...prev,
              streamStatus: 'done',
              memorialId: readStr(ev, 'memorialId') ?? prev.memorialId,
              runId: readStr(ev, 'runId') ?? prev.runId,
            };
          }

          if (type === 'error') {
            return {
              ...prev,
              streamStatus: 'error',
              errorMessage: readStr(ev, 'message') ?? '未知错误',
            };
          }

          return prev;
        });
      },
      (e) => {
        console.warn('[BattleStream] SSE error', e);
        setState((prev) => ({
          ...prev,
          streamStatus: 'error',
          errorMessage: e instanceof Error ? e.message : '连接失败',
        }));
      },
    );

    return () => {
      cancel();
    };
  }, [taskId]);

  const {
    decreeIntent,
    decreeSummary,
    ministers,
    groups,
    risks,
    councilSummary,
    memorialId,
    qualityScore,
    streamStatus,
    errorMessage,
  } = state;

  const hasDecree = !!(decreeIntent || decreeSummary);
  const hasMinisters = ministers.length > 0;
  const hasGroups = groups.length > 0;
  const hasRisks = risks.length > 0;
  const hasCouncilSummary = !!councilSummary;
  const hasMemorial = !!memorialId;

  return (
    <div className="space-y-1 pb-8">
      {/* Stream header bar */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#F0C66A]/20 bg-gradient-to-r from-[#15120a] to-[#0a0704] px-4 py-3">
        <div className="flex items-center gap-2.5">
          {streamStatus === 'live' && (
            <Pulse color="#F0C66A" intensity="subtle">
              <span className="h-2 w-2 rounded-full bg-[#F0C66A]" />
            </Pulse>
          )}
          {streamStatus === 'done' && (
            <span className="h-2 w-2 rounded-full bg-[#3DD68C]" />
          )}
          {streamStatus === 'error' && (
            <span className="h-2 w-2 rounded-full bg-[#F43F5E]" />
          )}
          {streamStatus === 'idle' && (
            <span className="h-2 w-2 animate-breathe rounded-full bg-[#F0C66A] opacity-40" />
          )}
          <span className="gold-text text-[13px] font-semibold">军机处 · 作战流</span>
          <span className="font-mono text-[11px] text-[#8F835F]">{taskId}</span>
        </div>
        <div className="flex items-center gap-2">
          {streamStatus === 'live' && (
            <span className="rounded-full border border-[#F0C66A]/25 bg-[#F0C66A]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#F0C66A]">
              作战中
            </span>
          )}
          {streamStatus === 'done' && (
            <span className="rounded-full border border-[#3DD68C]/25 bg-[#3DD68C]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#3DD68C]">
              已完成
            </span>
          )}
          {streamStatus === 'error' && (
            <span className="rounded-full border border-[#F43F5E]/25 bg-[#F43F5E]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#F43F5E]">
              异常终止
            </span>
          )}
        </div>
      </div>

      {/* Decree understood */}
      <AnimatePresence>
        {hasDecree && (
          <motion.div
            key="decree"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <DecreeCard intent={decreeIntent} summary={decreeSummary} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ministers council */}
      {hasMinisters && (
        <div>
          <SectionLabel>大臣会审 · Ministers Council ({ministers.length})</SectionLabel>
          <EnterStagger staggerMs={50} className="space-y-2">
            {ministers.map((m) => (
              <MinisterRow key={m.agentCode} row={m} />
            ))}
          </EnterStagger>
        </div>
      )}

      {/* Execution groups */}
      {hasGroups && (
        <div>
          <SectionLabel>庄园执行 · Execution Groups ({groups.length})</SectionLabel>
          <EnterStagger staggerMs={80} className="space-y-3">
            {groups.map((g) => (
              <GroupCard key={g.groupId} card={g} />
            ))}
          </EnterStagger>
        </div>
      )}

      {/* Risk banners */}
      {hasRisks && (
        <div>
          <SectionLabel>风险通报 · Risk Flags ({risks.length})</SectionLabel>
          <EnterStagger staggerMs={60} className="space-y-2">
            {risks.map((r, i) => (
              <RiskBanner key={`${r.level}-${i}`} risk={r} />
            ))}
          </EnterStagger>
        </div>
      )}

      {/* Council aggregated summary */}
      {hasCouncilSummary && (
        <motion.div
          key="council-summary"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <SectionLabel>跨组汇总 · Council Summary</SectionLabel>
          <GlassPanel variant="info" tone="elevated" padding="md">
            <div className="text-[12.5px] leading-[1.75] text-[#B6BDD5]">{councilSummary}</div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Memorial drafted CTA */}
      {hasMemorial && (
        <motion.div
          key="memorial"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <GlassPanel variant="gold" tone="deep" padding="md" hudCorners glow>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="section-eyebrow mb-1">奏折已生成 · Memorial Drafted</div>
                <div className="text-[15px] font-semibold text-[#F6EFD8]">
                  恭喜！奏折已起草完成，请前往审批。
                </div>
                {qualityScore !== undefined && (
                  <div className="mt-1 text-[11px] text-[#8F835F]">
                    质量评分 · Quality Score:{' '}
                    <span className="font-mono font-bold text-[#F0C66A]">{qualityScore}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => router.push('/court-briefing')}
                  className="rounded-xl border border-[#F0C66A]/40 bg-[#F0C66A]/15 px-5 py-2.5 text-[13px] font-semibold text-[#F0C66A] transition hover:bg-[#F0C66A]/25 active:scale-95"
                >
                  上书房批阅 →
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/reports')}
                  className="rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2 text-[12px] text-[#9AA3C4] transition hover:bg-white/[0.07] active:scale-95"
                >
                  查看奏折
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/archive?taskId=${encodeURIComponent(taskId)}${memorialId ? `&memorialId=${encodeURIComponent(memorialId)}` : ''}`)}
                  className="rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2 text-[12px] text-[#C8CDD8] transition hover:bg-white/[0.07] active:scale-95"
                >
                  送史馆复盘
                </button>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Error banner */}
      {streamStatus === 'error' && errorMessage && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GlassPanel variant="danger" tone="elevated" padding="sm">
            <div className="flex items-center gap-2 text-[12px] text-[#F43F5E]">
              <span>⚠</span>
              <span>作战流异常：{errorMessage}</span>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Idle placeholder */}
      {streamStatus === 'idle' && !hasDecree && !hasMinisters && !hasGroups && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 opacity-40">
            <Pulse color="#F0C66A" intensity="subtle">
              <span className="text-[40px]">⚔</span>
            </Pulse>
          </div>
          <div className="text-[13px] text-[#8F835F]">正在连接作战流…</div>
          <div className="mt-1 font-mono text-[11px] text-[#5A4F38]">
            Awaiting SSE events from task {taskId}
          </div>
        </div>
      )}
    </div>
  );
}
