/**
 * 朝堂 OS · 三省审议状态机 · Bill FSM
 *
 * 一道"案"的全生命周期：
 *   起草 → 审议 → 修改 → 准 → 执行 → 完成 / 失败 → 入史馆
 *
 * 设计：
 *   - 纯函数 transition(state, event) → newState
 *   - guards：Constitutional · "approved → executing" 必须 actor=ruler
 *   - reason 必填：每次转移必带文字理由 · audit 友好
 *   - 不可达状态由 typescript exhaustive check 兜住
 */

export type BillState =
  | 'drafted'        // 中书省起草完
  | 'under_review'   // 已送门下省审议中
  | 'revising'       // 门下驳回 · 中书在改
  | 'approved'       // 三省齐印 · 待执行
  | 'executing'      // 尚书省已派出 · 六部执行中
  | 'completed'      // 执行成功
  | 'failed'         // 执行失败
  | 'rejected'       // 终驳（不可重写）
  | 'shelved'        // 搁置再议
  | 'archived';      // 入史馆 · 终态

export type Actor = 'ruler' | 'zhongshu' | 'menxia' | 'shangshu' | 'liubu' | 'system';

export type EventType =
  | 'create'
  | 'submit_to_review'
  | 'approve'
  | 'reject_for_revision'
  | 'reject_final'
  | 'shelve'
  | 'resubmit'
  | 'dispatch'
  | 'mark_completed'
  | 'mark_failed'
  | 'archive';

export interface BillEvent {
  /** 事件 id · jsonl 行内唯一 */
  id: string;
  /** 案 id */
  billId: string;
  /** 事件类型 · 决定 transition */
  type: EventType;
  /** 触发者 · 用于 guard 校验 */
  actor: Actor;
  /** 时间戳 */
  ts: string;
  /** 必填理由 · 即 audit log 的 why */
  reason: string;
  /** 可选 · 事件载荷 */
  payload?: Record<string, unknown>;
}

export interface Bill {
  id: string;
  title: string;
  command: string;
  state: BillState;
  /** 当前 draft 文本（中书省最新版） */
  draft?: string;
  /** 门下省最新驳议 */
  menxiaReview?: { verdict: '准' | '驳' | '再议'; reasoning: string; violations: string[] };
  /** 尚书省执行计划 */
  shangshuPlan?: { steps: Array<{ dept: string; action: string }>; etaMs: number };
  /** 全事件历史 · 时间倒序 = audit timeline */
  events: BillEvent[];
  /** 创建时间 */
  createdAt: string;
  /** 上次 transition 时间 · 用于排序 */
  lastTransitionAt: string;
  /** 修订次数（每次 reject_for_revision +1） */
  revisionCount: number;
  /**
   * 降级标记 · safeFold 跳过坏帧时置 true · 默认不设=未降级
   * 透出供下游（route GET / scribe）感知此 bill 非完整 replay
   */
  degraded?: boolean;
  /** 被 safeFold 跳过的坏帧数 · 仅 degraded 时设置 */
  corruptedCount?: number;
}

/* ==========================================================================
 * 转移表 · 唯一权威
 * ========================================================================== */

interface Transition {
  from: BillState;
  on: EventType;
  to: BillState;
  /** 哪些 actor 可以触发 · 空集合 = 任何 actor */
  allowedActors?: Actor[];
}

const TRANSITIONS: Transition[] = [
  { from: 'drafted', on: 'submit_to_review', to: 'under_review', allowedActors: ['zhongshu', 'system'] },

  { from: 'under_review', on: 'approve', to: 'approved', allowedActors: ['menxia'] },
  { from: 'under_review', on: 'reject_for_revision', to: 'revising', allowedActors: ['menxia'] },
  { from: 'under_review', on: 'reject_final', to: 'rejected', allowedActors: ['menxia', 'ruler'] },
  { from: 'under_review', on: 'shelve', to: 'shelved', allowedActors: ['menxia', 'ruler'] },

  { from: 'revising', on: 'resubmit', to: 'under_review', allowedActors: ['zhongshu'] },
  { from: 'revising', on: 'reject_final', to: 'rejected', allowedActors: ['ruler'] },
  { from: 'revising', on: 'shelve', to: 'shelved', allowedActors: ['ruler'] },

  { from: 'approved', on: 'dispatch', to: 'executing', allowedActors: ['shangshu', 'ruler'] },
  { from: 'approved', on: 'shelve', to: 'shelved', allowedActors: ['ruler'] },

  { from: 'executing', on: 'mark_completed', to: 'completed', allowedActors: ['liubu', 'system'] },
  { from: 'executing', on: 'mark_failed', to: 'failed', allowedActors: ['liubu', 'system'] },

  // 任何终态都能入史馆
  { from: 'completed', on: 'archive', to: 'archived' },
  { from: 'failed', on: 'archive', to: 'archived' },
  { from: 'rejected', on: 'archive', to: 'archived' },
  { from: 'shelved', on: 'archive', to: 'archived', allowedActors: ['ruler', 'system'] },
];

/* ==========================================================================
 * 纯函数 · 易测
 * ========================================================================== */

export class BillTransitionError extends Error {
  from: BillState;
  on: EventType;
  actor: Actor;
  constructor(message: string, from: BillState, on: EventType, actor: Actor) {
    super(message);
    this.name = 'BillTransitionError';
    this.from = from;
    this.on = on;
    this.actor = actor;
  }
}

/**
 * 校验某 transition 是否合法
 */
export function canTransition(
  from: BillState,
  type: EventType,
  actor: Actor,
): { ok: true; to: BillState } | { ok: false; reason: string } {
  const t = TRANSITIONS.find((x) => x.from === from && x.on === type);
  if (!t) {
    return { ok: false, reason: `无效转移：${from} 不能 ${type}` };
  }
  if (t.allowedActors && !t.allowedActors.includes(actor)) {
    return {
      ok: false,
      reason: `权限：${actor} 不可触发 ${type}（仅 ${t.allowedActors.join('/')} 可）`,
    };
  }
  return { ok: true, to: t.to };
}

/**
 * 应用一个事件 · 返回新 Bill
 *  · 不修改原 bill · immutable
 *  · 失败抛 BillTransitionError
 */
export function applyEvent(bill: Bill, event: BillEvent): Bill {
  const v = canTransition(bill.state, event.type, event.actor);
  if (!v.ok) {
    throw new BillTransitionError(v.reason, bill.state, event.type, event.actor);
  }

  return {
    ...bill,
    state: v.to,
    events: [...bill.events, event],
    lastTransitionAt: event.ts,
    revisionCount:
      event.type === 'reject_for_revision' ? bill.revisionCount + 1 : bill.revisionCount,
    // 副作用合并 · payload 可携带 draft / menxiaReview / shangshuPlan
    ...((event.payload?.draft as string) ? { draft: event.payload!.draft as string } : {}),
    ...((event.payload?.menxiaReview as Bill['menxiaReview'])
      ? { menxiaReview: event.payload!.menxiaReview as Bill['menxiaReview'] }
      : {}),
    ...((event.payload?.shangshuPlan as Bill['shangshuPlan'])
      ? { shangshuPlan: event.payload!.shangshuPlan as Bill['shangshuPlan'] }
      : {}),
  };
}

/**
 * 从 0 个事件 fold 出当前 Bill
 *  · Event-Sourced 入口 · 时间旅行 / replay 全靠它
 *  · 第一个事件必须是 'create' 类型
 *  · 严格模式 · 中间任一帧坏直接抛
 */
export function foldEvents(events: BillEvent[]): Bill | null {
  if (events.length === 0) return null;
  const first = events[0]!;
  if (first.type !== 'create') {
    throw new Error('first event must be create');
  }

  const initial: Bill = {
    id: first.billId,
    title: (first.payload?.title as string) ?? '（无题案）',
    command: (first.payload?.command as string) ?? '',
    state: 'drafted',
    draft: first.payload?.draft as string | undefined,
    events: [first],
    createdAt: first.ts,
    lastTransitionAt: first.ts,
    revisionCount: 0,
  };

  let bill = initial;
  for (let i = 1; i < events.length; i++) {
    bill = applyEvent(bill, events[i]!);
  }
  return bill;
}

/**
 * 容错 fold · 坏帧不让整个 bill 消失
 *
 *  · 第 1 帧必须 create · 否则 null
 *  · 中间帧失败 · 跳过 · 加入 corrupted[] · 继续
 *  · 返回的 bill 仍可信（只缺被跳的帧）
 *
 *  生产场景：手动 vim 改 jsonl / 磁盘损坏 / event schema 升级遗漏
 */
export interface SafeFoldResult {
  bill: Bill | null;
  corrupted: Array<{ event: BillEvent; reason: string }>;
}

export function safeFold(events: BillEvent[]): SafeFoldResult {
  const corrupted: Array<{ event: BillEvent; reason: string }> = [];
  if (events.length === 0) return { bill: null, corrupted };

  const first = events[0]!;
  if (first.type !== 'create') {
    return {
      bill: null,
      corrupted: [{ event: first, reason: 'first event must be create' }],
    };
  }

  const initial: Bill = {
    id: first.billId,
    title: (first.payload?.title as string) ?? '（无题案）',
    command: (first.payload?.command as string) ?? '',
    state: 'drafted',
    draft: first.payload?.draft as string | undefined,
    events: [first],
    createdAt: first.ts,
    lastTransitionAt: first.ts,
    revisionCount: 0,
  };

  let bill = initial;
  for (let i = 1; i < events.length; i++) {
    const e = events[i]!;
    try {
      bill = applyEvent(bill, e);
    } catch (err) {
      corrupted.push({
        event: e,
        reason: err instanceof Error ? err.message : String(err),
      });
      // 跳过 · 继续 · 不让一帧坏拖垮整 bill
    }
  }
  // 透出降级标记 · 不可变 spread · 不破坏 SafeFoldResult 形状
  // corrupted 明细仍照常通过 result.corrupted 返回不变
  if (corrupted.length > 0 && bill) {
    return {
      bill: { ...bill, degraded: true, corruptedCount: corrupted.length },
      corrupted,
    };
  }
  return { bill, corrupted };
}

/** 列出某 bill 当前合法的 next events · UI 用 */
export function legalNextEvents(state: BillState): EventType[] {
  return TRANSITIONS.filter((t) => t.from === state).map((t) => t.on);
}

/** 是否终态 */
export function isTerminal(state: BillState): boolean {
  return state === 'archived';
}
