/**
 * 朝堂 OS · Orchestration · AgentRun 9 态状态机
 *
 * 9 态来源于 lib/contracts/agent.ts 的 AgentState（Tier 0 冻结）：
 *   idle → assigned → running → waiting_dependency → summarizing
 *        → completed | failed | fallback_completed → archived
 *
 * 本模块：
 *   - 定义合法迁移表 ALLOWED_TRANSITIONS（防非法跳转）
 *   - transitionAgentRun() 校验迁移 + 更新内存态 + 广播 SSE
 *   - 内置一个进程内 SSE 订阅总线（subscribe/broadcast），供 route handler 桥接
 *
 * 设计取舍：
 *   - 单实例进程内广播（够 MVP）；多实例需换 Redis pub/sub，接口不变
 *   - 永不抛出非法迁移异常给调用方？不——非法迁移是 bug，必须显式抛出
 *
 * ⚠️ SWARM-FSM-01：本模块当前未被 agents/run 写路径接入（裸 SQL runtime 直接置
 *   running/completed/failed），属待接入而非死代码。接入计划：agents/run 写库后
 *   调用 broadcastAgentRun，events/route.ts 改 subscribeAgentRun fan-out（见
 *   SWARM-SSE-05）。在未接入前严禁假定真实流程经过本状态机。
 */

import { logger } from '@/lib/logger';
import type { AgentState, AgentRun } from '@/lib/contracts/agent';

/* ==========================================================================
 * 合法迁移表
 * ========================================================================== */

/** 终态：不可再迁出 */
export const TERMINAL_STATES: ReadonlySet<AgentState> = new Set<AgentState>([
  'archived',
]);

/**
 * 每个状态可迁往的下一组状态。
 * 任何状态都允许迁往 'failed'（异常随时可发生）。
 */
export const ALLOWED_TRANSITIONS: Record<AgentState, ReadonlyArray<AgentState>> = {
  idle: ['assigned', 'failed'],
  assigned: ['running', 'waiting_dependency', 'failed'],
  running: ['waiting_dependency', 'summarizing', 'completed', 'failed', 'fallback_completed'],
  waiting_dependency: ['running', 'failed'],
  summarizing: ['completed', 'failed', 'fallback_completed'],
  completed: ['archived'],
  failed: ['archived', 'fallback_completed'],
  fallback_completed: ['archived'],
  archived: [],
};

/**
 * 校验一次迁移是否合法。
 */
export function canTransition(from: AgentState, to: AgentState): boolean {
  // SWARM-TRANS-09：同态幂等 no-op。注意：archived 等终态同态调用（如
  // archived → archived）同样返回 true；若调用方需禁止终态再迁出，应在调用前
  // 显式先查 TERMINAL_STATES.has(from)。此处保持向后兼容的幂等返回值不变。
  if (from === to) return true; // 幂等：同态视为合法 no-op
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: AgentState,
    public readonly to: AgentState,
    public readonly runId: string,
  ) {
    super(`illegal AgentRun transition: ${from} → ${to} (run=${runId})`);
    this.name = 'IllegalTransitionError';
  }
}

/* ==========================================================================
 * SSE 事件总线（进程内）
 * ========================================================================== */

export interface AgentRunTransitionEvent {
  type: 'agent_run_transition';
  runId: string;
  taskId: string;
  agentCode: string;
  from: AgentState;
  to: AgentState;
  progressPct: number;
  summary?: string;
  timestamp: string;
}

type Listener = (event: AgentRunTransitionEvent) => void;

const listeners = new Set<Listener>();

/**
 * 订阅 AgentRun 迁移事件。返回取消订阅函数。
 */
export function subscribeAgentRun(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 广播一条迁移事件到所有订阅者。监听器自身抛错不影响其他订阅者。
 */
export function broadcastAgentRun(event: AgentRunTransitionEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch (err) {
      logger.warn('agent run listener threw', {
        err: err instanceof Error ? err.message : String(err),
        runId: event.runId,
      });
    }
  }
}

/* ==========================================================================
 * transitionAgentRun · 核心 API
 * ========================================================================== */

export interface TransitionPatch {
  progressPct?: number;
  summary?: string;
  riskLevel?: AgentRun['riskLevel'];
  confidence?: number;
}

/**
 * 把一个 AgentRun 迁移到新状态：校验 → 返回不可变新对象 → 广播 SSE。
 *
 * 遵循 immutability：不修改传入对象，返回全新副本。
 *
 * @throws IllegalTransitionError 当迁移非法时
 */
export function transitionAgentRun(
  run: Readonly<AgentRun>,
  to: AgentState,
  patch: TransitionPatch = {},
): AgentRun {
  if (!canTransition(run.state, to)) {
    throw new IllegalTransitionError(run.state, to, run.id);
  }

  const now = new Date().toISOString();
  const isTerminal = to === 'completed' || to === 'failed' || to === 'fallback_completed';

  const next: AgentRun = {
    ...run,
    state: to,
    progressPct: patch.progressPct ?? deriveProgress(to, run.progressPct),
    latestSummary: patch.summary ?? run.latestSummary,
    riskLevel: patch.riskLevel ?? run.riskLevel,
    confidence: patch.confidence ?? run.confidence,
    isWaitingDependency: to === 'waiting_dependency',
    hasReported: run.hasReported || isTerminal,
    startedAt: run.startedAt ?? (to === 'running' ? now : run.startedAt),
    completedAt: isTerminal ? now : run.completedAt,
  };

  broadcastAgentRun({
    type: 'agent_run_transition',
    runId: next.id,
    taskId: next.taskId,
    agentCode: next.agentCode,
    from: run.state,
    to,
    progressPct: next.progressPct,
    summary: next.latestSummary,
    timestamp: now,
  });

  logger.info('agent run transition', {
    runId: next.id,
    from: run.state,
    to,
    progressPct: next.progressPct,
  });

  return next;
}

/**
 * 按目标态推导默认进度（未显式传 progressPct 时使用）。
 */
function deriveProgress(to: AgentState, current: number): number {
  switch (to) {
    case 'idle':
      return 0;
    case 'assigned':
      return 5;
    case 'running':
      return Math.max(current, 20);
    case 'waiting_dependency':
      return Math.max(current, 40);
    case 'summarizing':
      return Math.max(current, 85);
    case 'completed':
    case 'fallback_completed':
      return 100;
    case 'failed':
      return current;
    case 'archived':
      return 100;
    default:
      return current;
  }
}

/**
 * 工厂：创建一个 idle 态的新 AgentRun。
 */
export function createAgentRun(params: {
  id: string;
  taskId: string;
  subtaskId: string;
  agentCode: AgentRun['agentCode'];
  currentTaskTitle?: string;
}): AgentRun {
  return {
    id: params.id,
    taskId: params.taskId,
    subtaskId: params.subtaskId,
    agentCode: params.agentCode,
    state: 'idle',
    progressPct: 0,
    currentTaskTitle: params.currentTaskTitle,
    isWaitingDependency: false,
    hasReported: false,
  };
}
