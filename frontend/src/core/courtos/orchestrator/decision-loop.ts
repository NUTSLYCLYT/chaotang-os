/**
 * DecisionLoop（AGENTS.md §13 主闭环）—— 纯函数状态机。
 *
 * Loop = 状态 + 动作 + 下一步。AI 不决定流程，只执行流程中的一步。
 * 这是产品决策层（PRD §8.10），区别于后端 TaskStatus 执行层。
 *
 * 全程纯函数、无副作用、无 @/ 运行时依赖 → 可离线单测：
 *   node --experimental-strip-types --test src/core/courtos/orchestrator/decision-loop.nodetest.ts
 */
import type { DecisionState, DecisionAction } from '../types';

/** 终态：不可再迁出（archived / failed）。 */
export const TERMINAL_STATES: ReadonlySet<DecisionState> = new Set<DecisionState>([
  'archived',
]);

/** 合法迁移表：from → { action → to }。`fail` 为全局规则单独处理。 */
const TRANSITIONS: Record<DecisionState, Partial<Record<DecisionAction, DecisionState>>> = {
  draft: { refine_intent: 'intent_refined' },
  intent_refined: { check_evidence: 'evidence_checking' },
  evidence_checking: { request_evidence: 'waiting_for_evidence', start_review: 'reviewing' },
  waiting_for_evidence: { start_review: 'reviewing' },
  reviewing: { generate_report: 'report_ready' },
  report_ready: { ask_decision: 'waiting_for_decision' },
  waiting_for_decision: {
    accept: 'accepted',
    reject: 'rejected',
    follow_up: 'following_up',
    request_recheck: 'rechecking',
  },
  accepted: { archive: 'archived' },
  rejected: {},
  following_up: { start_review: 'reviewing' },
  rechecking: { start_review: 'reviewing' },
  archived: {},
  failed: { refine_intent: 'intent_refined' }, // 失败可恢复，任务不丢
};

export class IllegalDecisionTransitionError extends Error {
  readonly from: DecisionState;
  readonly action: DecisionAction;
  constructor(from: DecisionState, action: DecisionAction) {
    super(`[DecisionLoop] 非法迁移: ${from} --${action}-->`);
    this.name = 'IllegalDecisionTransitionError';
    this.from = from;
    this.action = action;
  }
}

/** 异常随时可发生：任何非终态都能 fail。 */
function failTarget(from: DecisionState): DecisionState | undefined {
  return TERMINAL_STATES.has(from) ? undefined : 'failed';
}

export function nextState(from: DecisionState, action: DecisionAction): DecisionState | undefined {
  if (action === 'fail') return failTarget(from);
  return TRANSITIONS[from]?.[action];
}

export function assertValidTransition(from: DecisionState, action: DecisionAction): void {
  if (nextState(from, action) === undefined) {
    throw new IllegalDecisionTransitionError(from, action);
  }
}

/** 执行迁移：校验 → 返回新状态（纯函数，不改入参）。 */
export function transition(from: DecisionState, action: DecisionAction): DecisionState {
  const to = nextState(from, action);
  if (to === undefined) throw new IllegalDecisionTransitionError(from, action);
  return to;
}

export function getAvailableActions(state: DecisionState): DecisionAction[] {
  const actions = Object.keys(TRANSITIONS[state] ?? {}) as DecisionAction[];
  if (!TERMINAL_STATES.has(state) && state !== 'failed') actions.push('fail');
  return actions;
}

const USER_FACING_TEXT: Record<DecisionState, string> = {
  draft: '草稿',
  intent_refined: '待确认',
  evidence_checking: '缺证检查中',
  waiting_for_evidence: '待补证',
  reviewing: '会审中',
  report_ready: '奏折已生成',
  waiting_for_decision: '待裁决',
  accepted: '已采纳',
  rejected: '已驳回',
  following_up: '追问中',
  rechecking: '复核中',
  archived: '已归档',
  failed: '失败',
};

export function getUserFacingStateText(state: DecisionState): string {
  return USER_FACING_TEXT[state];
}

const PROGRESS_STATES: ReadonlySet<DecisionState> = new Set<DecisionState>([
  'evidence_checking',
  'reviewing',
  'rechecking',
]);

export function shouldShowProgress(state: DecisionState): boolean {
  return PROGRESS_STATES.has(state);
}

export function shouldAllowUserDecision(state: DecisionState): boolean {
  return state === 'waiting_for_decision' || state === 'report_ready';
}

export function shouldAllowArchive(state: DecisionState): boolean {
  return state === 'accepted';
}
