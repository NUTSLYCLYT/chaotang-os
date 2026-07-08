/**
 * 朝堂 OS · Swarm 数据契约（A 兼容层 + B 升级路径）
 *
 * 来源：
 * - A 现有：apps/web/lib/types.ts（SwarmOverview / SwarmUnit / SwarmMember / SwarmOutput）
 * - A 实测 JSON：GET /api/v1/swarms 等 12 个端点
 * - B 升级：补 currentTaskId / createdAt / recentSummary / hasReturnedResult 等缺失字段
 *
 * 目标位置：apps/web/lib/contracts/swarm.ts
 */

/* ==========================================================================
   Swarm 状态枚举（A 现有 6 状态保留）
   ========================================================================== */

export type SwarmStatus = 'offline' | 'normal' | 'busy' | 'blocked' | 'warning' | 'done';

export type SwarmPriority = 'P0' | 'P1' | 'P2';

/* ==========================================================================
   SwarmRosterEntry · 蜂群聚集地全名册（GET :8081/api/swarm/roster，后端已 join）
   后端裸数组逐条字段;run 相关字段在该蜂群从未跑过时为 null/空串(诚实空)。
   status 是「最近一次 run 的状态」(completed/failed/idle/skipped...),非 SwarmStatus 枚举,
   故保持原始 string,由前端映射展示色调,不强转枚举。
   ========================================================================== */
export interface SwarmRosterEntry {
  id: string;
  name: string;
  /** owner 功能组(exec/finlaw/intel/content/review/rnd/unassigned...) */
  group: string;
  /** 最近一次 run 的原始状态;从未跑过 → 'idle' */
  status: string;
  /** 最近一次 run id;无则 null 或空串 */
  last_run_id: string | null;
  /** 最近一次 run 质量分;无则 null */
  last_quality_score: number | null;
  /** 最近一次 run 时间(ISO);无则 null */
  last_run_at: string | null;
  /** 最近一次 run 标题;无则 null 或空串 */
  latest_title: string | null;
}

/* ==========================================================================
   SwarmUnit · 单蜂群（与 GET /api/v1/swarms/:id 对齐）
   ========================================================================== */

export interface SwarmUnit {
  id: string;
  name: string;
  status: SwarmStatus;
  priority: SwarmPriority;
  currentTaskTitle?: string | null;
  /** 缺失字段补全：A 实测返回 null，类型层面允许 null */
  currentTaskId?: string | null;
  needsAttention: boolean;
  progressOverview?: string | null;
  riskSummary?: string | null;
  blockedReason?: string | null;
  missingInput?: string | null;
  /** 缺失字段补全 */
  createdAt: string;
  updatedAt: string;
}

/* ==========================================================================
   SwarmOverview · 总览数字（GET /api/v1/swarms/overview）
   ========================================================================== */

export interface SwarmOverview {
  total: number;
  online: number;
  busy: number;
  blocked: number;
  warning: number;
  completedToday: number;
  needsAttention: number;
}

/* ==========================================================================
   SwarmMember · 蜂群成员（Agent 实例）
   ========================================================================== */

export type AgentMemberStatus = 'idle' | 'running' | 'blocked' | 'done';
export type AgentMemberRole = string;

export interface SwarmMember {
  id: string;
  name: string;
  role: AgentMemberRole;
  status: AgentMemberStatus;
  swarmId: string;
  /** 缺失字段补全（A 实测已返回但 lib/types.ts 没声明） */
  recentSummary?: string | null;
  isBlocked: boolean;
  /** 缺失字段补全 */
  hasReturnedResult: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ==========================================================================
   SwarmOutput · 蜂群产出
   ========================================================================== */

export interface SwarmOutput {
  summary?: string | null;
  keyFindings?: string[];
  risks?: string[];
  pendingConfirmations?: string[];
  executableNextSteps?: string[];
}

export interface SwarmOutputArchive extends SwarmOutput {
  id: string;
  swarmId: string;
  swarmName?: string;
  swarmStatus?: SwarmStatus;
  createdAt: string;
  updatedAt: string;
}

/* ==========================================================================
   Interaction · 协同交互
   ========================================================================== */

export type InteractionType = 'instruction' | 'followup' | 'material' | 'result-update';

export interface Interaction {
  id: string;
  swarmId: string;
  actor: string;
  type: InteractionType;
  content: string;
  timestamp: string;
}

/* ==========================================================================
   Department · 部门协同（六部）
   ========================================================================== */

export interface DeptStatus {
  id: string;
  name: string;
  status: SwarmStatus;
  priority: SwarmPriority;
  currentTaskTitle?: string | null;
  needsAttention: boolean;
  progressOverview?: string | null;
  blockedReason?: string | null;
  isBlocked?: boolean;
  neededInput?: string | null;
}

/* ==========================================================================
   Dispatch DTO · 下旨指令
   ========================================================================== */

export type CommandType = 'instruction' | 'followup' | 'summon' | 'search' | 'material';

export interface DispatchCommandDto {
  type: CommandType;
  content: string;
  actor?: string;
  targetAgentId?: string;
  taskId?: string;
}

/* ==========================================================================
   Task Board · 丞相台任务看板
   ========================================================================== */

export interface BoardTask {
  id: string;
  title: string;
  priority: SwarmPriority;
  status: 'pending' | 'in-progress' | 'blocked' | 'awaiting-decision' | 'done';
  owner?: string | null;
  nextStep?: string | null;
  swarmId?: string | null;
  goal?: string | null;
  dependencies?: unknown;
  constraints?: unknown;
  missingInputs?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface TaskGroup {
  priority: SwarmPriority;
  tasks: BoardTask[];
}
