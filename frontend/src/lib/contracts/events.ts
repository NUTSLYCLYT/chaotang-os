/**
 * 朝堂 OS · WebSocket 事件契约
 *
 * 来源：font/src/events/events.gateway.ts（A 现有 5 个事件）
 * 目标位置：apps/web/lib/contracts/events.ts
 *
 * Phase 3 计划：所有事件 payload 统一加 timestamp（已有，但当前是 Date 对象，
 * 序列化后变 ISO 字符串，前端类型应使用 string）。
 */

import type { SwarmStatus, SwarmOverview, SwarmOutput } from './swarm';
import type { AgentMemberStatus } from './swarm';

/* ==========================================================================
   事件名常量（避免拼写错误）
   ========================================================================== */

export const SOCKET_EVENTS = {
  SWARM_STATUS_UPDATE: 'swarm:status-update',
  SWARM_OUTPUT_UPDATE: 'swarm:output-update',
  SWARM_OVERVIEW_UPDATE: 'swarm:overview-update',
  COMMAND_CALLBACK: 'command:callback',
  AGENT_STATUS_UPDATE: 'agent:status-update',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/* ==========================================================================
   事件 Payload 定义
   ========================================================================== */

export interface SwarmStatusUpdateEvent {
  swarmId: string;
  status: SwarmStatus;
  timestamp: string;
}

export interface SwarmOutputUpdateEvent {
  swarmId: string;
  output: SwarmOutput | Record<string, unknown>;
  timestamp: string;
}

export interface SwarmOverviewUpdateEvent {
  overview: SwarmOverview;
  timestamp: string;
}

export interface CommandCallbackEvent {
  commandId: string;
  result: unknown;
  timestamp: string;
}

export interface AgentStatusUpdateEvent {
  agentId: string;
  swarmId: string;
  status: AgentMemberStatus;
  timestamp: string;
}

/* ==========================================================================
   事件 → Payload 类型映射
   ========================================================================== */

export interface SocketEventMap {
  'swarm:status-update': SwarmStatusUpdateEvent;
  'swarm:output-update': SwarmOutputUpdateEvent;
  'swarm:overview-update': SwarmOverviewUpdateEvent;
  'command:callback': CommandCallbackEvent;
  'agent:status-update': AgentStatusUpdateEvent;
}

/* ==========================================================================
   类型守卫
   ========================================================================== */

export function isSwarmStatusUpdateEvent(event: unknown): event is SwarmStatusUpdateEvent {
  return typeof event === 'object' && event !== null && 'swarmId' in event && 'status' in event && 'timestamp' in event;
}

export function isCommandCallbackEvent(event: unknown): event is CommandCallbackEvent {
  return (
    typeof event === 'object' && event !== null && 'commandId' in event && 'result' in event && 'timestamp' in event
  );
}

/* ==========================================================================
   三省语义事件(T-be4 · 军机处 SSE)
   ========================================================================== */

/** 省代码 — 对应后端 translate_event 产出的 sheng 字段 */
export type ShengCode = 'zhongshu' | 'menxia' | 'shangshu';

/** 三省阶段状态 */
export type ShengStatus = 'active' | 'progress' | 'done';

/**
 * sansheng 事件 payload
 * 来源: GET /api/chaotang/decree/dispatch/{task_id}/stream
 * 后端在 council_* / group_* / aggregate / memorial.drafted 各阶段注入。
 */
export interface SanshengEvent {
  type: 'sansheng';
  /** 省代码 */
  sheng: ShengCode;
  /** 省中文名,如"中书省" */
  shengName: string;
  /** 阶段状态 */
  status: ShengStatus;
  /** 状态说明文本(可为空字符串) */
  summary: string;
}

/** 类型守卫 */
export function isSanshengEvent(event: unknown): event is SanshengEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as Record<string, unknown>).type === 'sansheng' &&
    typeof (event as Record<string, unknown>).sheng === 'string' &&
    typeof (event as Record<string, unknown>).status === 'string'
  );
}

/* ==========================================================================
   court 军机处 SSE 事件契约 (DATA-EVT-03 · 契约侧)

   来源: GET /api/court/events/stream (subscribeCourtStream → BattleStream)
   后端在丞相理解 / 大臣会审 / 庄园派遣执行 / 风险通报 / 跨组汇总 / 奏折生成
   各阶段逐条推送 SSE。下列 interface 与 BattleStream.tsx 消费的字段一一对齐，
   均为纯新增导出，不影响 SOCKET_EVENTS / SanshengEvent，向后兼容。
   ========================================================================== */

/** 丞相理解圣意 — decree.understood */
export interface DecreeUnderstoodEvent {
  type: 'decree.understood';
  /** 理解到的核心意图 */
  intent?: string;
  /** 补充说明摘要 */
  summary?: string;
}

/** 大臣会审意见 — minister.opinion */
export interface MinisterOpinionEvent {
  type: 'minister.opinion';
  /** 大臣（agent）代码 */
  agentCode: string;
  /** 大臣中文名（缺省时回退到 agentCode） */
  name?: string;
  /** 大臣当前状态，如 'running' | 'completed' */
  status?: string;
  /** 大臣输出意见正文 */
  output?: string;
}

/** 庄园（蜂群组）派遣 — group.dispatch */
export interface GroupDispatchEvent {
  type: 'group.dispatch';
  /** 庄园/组标识 */
  groupId: string;
  /** 庄园中文名（缺省时回退到 groupId） */
  name?: string;
}

/** 子智能体执行步骤 — subagent.step（流式增量文本） */
export interface SubagentStepEvent {
  type: 'subagent.step';
  /** 本步增量内容（累加到当前活跃组的 liveText） */
  content?: string;
  /** 可选：所属组标识 */
  groupId?: string;
}

/** 单庄园执行汇总 — group.aggregated */
export interface GroupAggregatedEvent {
  type: 'group.aggregated';
  /** 庄园/组标识 */
  groupId: string;
  /** 该组汇总文本 */
  summary?: string;
}

/** 跨组（议事会）汇总 — council.aggregated */
export interface CouncilAggregatedEvent {
  type: 'council.aggregated';
  /** 跨组汇总文本 */
  summary?: string;
}

/** 风险通报 — risk.flagged */
export interface RiskFlaggedEvent {
  type: 'risk.flagged';
  /** 风险级别，如 'low' | 'medium' | 'high' | 'critical' */
  level?: string;
  /** 风险标题 */
  label?: string;
  /** 风险细节描述 */
  detail?: string;
}

/** 奏折起草完成 — memorial.drafted */
export interface MemorialDraftedEvent {
  type: 'memorial.drafted';
  /** 奏折标识 */
  memorialId?: string;
  /** 运行标识 */
  runId?: string;
  /** 质量评分 */
  qualityScore?: number;
}

/** 作战流正常结束 — done */
export interface DoneEvent {
  type: 'done';
  /** 终态可携带的奏折标识 */
  memorialId?: string;
  /** 终态可携带的运行标识 */
  runId?: string;
}

/** 作战流异常终止 — error */
export interface ErrorEvent {
  type: 'error';
  /** 错误信息（面向 UI 的文案，非内部细节） */
  message?: string;
}

/**
 * court 军机处 SSE 判别联合
 *
 * 以 `type` 字段判别。注意：实际 SSE 流中还可能出现 'heartbeat'、'sansheng'、
 * 'council.summon' 等其它类型（见 BattleStream），它们不在本联合内 —— 本联合
 * 仅建模 DATA-EVT-03 列出的军机处核心阶段事件，供 BattleStream 类型收窄消费。
 */
export type CourtStreamEvent =
  | DecreeUnderstoodEvent
  | MinisterOpinionEvent
  | GroupDispatchEvent
  | SubagentStepEvent
  | GroupAggregatedEvent
  | CouncilAggregatedEvent
  | RiskFlaggedEvent
  | MemorialDraftedEvent
  | DoneEvent
  | ErrorEvent;

/** 本联合覆盖的 court 事件 type 取值集合 */
const COURT_STREAM_EVENT_TYPES = [
  'decree.understood',
  'minister.opinion',
  'group.dispatch',
  'subagent.step',
  'group.aggregated',
  'council.aggregated',
  'risk.flagged',
  'memorial.drafted',
  'done',
  'error',
] as const;

/**
 * 类型守卫：判断任意事件是否为 court 军机处 SSE 判别联合成员。
 * 可选导出，供 BattleStream 在分支前做整体收窄。
 */
export function isCourtStreamEvent(event: unknown): event is CourtStreamEvent {
  if (typeof event !== 'object' || event === null) return false;
  const type = (event as Record<string, unknown>).type;
  return (
    typeof type === 'string' &&
    (COURT_STREAM_EVENT_TYPES as readonly string[]).includes(type)
  );
}
