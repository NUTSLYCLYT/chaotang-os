/**
 * 朝堂 OS · Bill Store · jsonl 持久化 + 内存索引
 *
 * 复用上一轮 safe-jsonl · 多进程安全 · 自动 rotate
 *
 * 存储模型：
 *   bill-events.jsonl 是唯一事实源 · 每行一个 BillEvent
 *   内存维护 Map<billId, Bill> · 启动时 reload + foldEvents 重建
 *   写：append event → fold → 更新内存
 *   读：直接从 Map · O(1)
 */

import { promises as fs } from 'fs';
import { safeAppend, readAllRotations } from '@/lib/llm/safe-jsonl';
import { logger } from '@/lib/logger';
import {
  applyEvent,
  safeFold,
  type Bill,
  type BillEvent,
  type EventType,
  type Actor,
} from './bill-fsm';
import { chain, isChained, type ChainedEvent, verifyChain } from './audit-chain';

export class OptimisticLockError extends Error {
  expected: number;
  actual: number;
  constructor(expected: number, actual: number) {
    super(`optimistic lock failed · expected revision ${expected} · actual ${actual}`);
    this.name = 'OptimisticLockError';
    this.expected = expected;
    this.actual = actual;
  }
}

const STORE_PATH = process.env.BILL_EVENTS_PATH ?? '/tmp/courtos-bill-events.jsonl';

const bills = new Map<string, Bill>();
const eventsByBill = new Map<string, BillEvent[]>();
let loaded = false;

async function reload(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const lines = await readAllRotations(STORE_PATH);
    // 按 billId 分组
    for (const line of lines) {
      try {
        const e = JSON.parse(line) as BillEvent;
        const arr = eventsByBill.get(e.billId) ?? [];
        arr.push(e);
        eventsByBill.set(e.billId, arr);
      } catch {
        /* skip bad lines · 这是 jsonl 解析层 · 单行损坏不影响其他 */
      }
    }
    // safeFold 每组 · 单坏帧不污染整 bill
    for (const [billId, eventsRaw] of eventsByBill.entries()) {
      const events = eventsRaw.sort((a, b) => a.ts.localeCompare(b.ts));
      const { bill, corrupted } = safeFold(events);
      if (bill) bills.set(billId, bill);
      if (corrupted.length > 0) {
        logger.warn('[bill-store] corrupted frame(s) skipped on reload', {
          billId,
          corruptedCount: corrupted.length,
        });
      }
    }
  } catch {
    /* file 不存在 · 全新启动 */
  }
}

function genId(prefix = 'bill'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 写后读校验 · 落实「写盘成功后、更新内存前」的一致性闸门
 *  · 从磁盘（含 rotation）读回 · 确认刚写入的 event.id 存在
 *  · 且该行能 JSON.parse 出与内存等价对象（至少校验 id 与 type 匹配）
 *  · 校验失败 → throw · 调用方据此不更新内存 · 保证内存与磁盘一致
 */
async function verifyWritten(
  billId: string,
  expected: { id: string; type: EventType },
): Promise<void> {
  const lines = await readAllRotations(STORE_PATH);
  for (const line of lines) {
    let e: BillEvent;
    try {
      e = JSON.parse(line) as BillEvent;
    } catch {
      // 单行损坏不影响校验 · 继续找目标行
      continue;
    }
    if (e.billId === billId && e.id === expected.id) {
      if (e.type === expected.type) return;
      // id 命中但 type 不一致 · 视为写坏
      throw new Error('persist verify failed · 内存未更新');
    }
  }
  // 没找到刚写入的 event · 写盘未生效
  throw new Error('persist verify failed · 内存未更新');
}

/* ==========================================================================
 * Public API · 异步 · 永远先 await reload()
 * ========================================================================== */

export interface CreateBillInput {
  title: string;
  command: string;
  draft?: string;
  actor?: Actor;
  /**
   * 可选 · 案的归属用户 id · 写入首帧 create 事件 payload
   *  · 供 dashboard / 审计按归属过滤（见 billOwner）
   *  · 不传 → 与现状完全一致（向后兼容）
   */
  userId?: string;
  /**
   * 可选 · 案的归属租户（BL-07 · 租户隔离）· 写入首帧 create 事件 payload
   *  · 真实后端用 tenant_slug(字符串)，dev/本地 token 用 tenantId(数字)，故 string|number。
   *  · 供 getBill/listBills 按租户 scope（见 billTenant）· 杜绝跨租户横向访问
   *  · 不传 → 案无租户归属（legacy）· 不参与租户过滤（向后兼容）
   */
  tenantId?: string | number;
}

export async function createBill(input: CreateBillInput): Promise<Bill> {
  await reload();
  const billId = genId('bill');
  const now = new Date().toISOString();
  const plain: BillEvent = {
    id: genId('evt'),
    billId,
    type: 'create',
    actor: input.actor ?? 'zhongshu',
    ts: now,
    reason: '中书省起草',
    payload: {
      title: input.title,
      command: input.command,
      draft: input.draft,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.tenantId != null ? { tenantId: input.tenantId } : {}),
    },
  };
  // 加链：第一帧 prev = GENESIS
  const event = chain(null, plain);
  // 治理事件不可丢：超长 throw JsonlTooLongError 冒泡到 API（不静默截断）
  await safeAppend(STORE_PATH, JSON.stringify(event), { noTruncate: true });
  // 写后读校验 · 失败则不更新内存（保持内存与磁盘一致）
  await verifyWritten(billId, { id: event.id, type: event.type });
  const { bill } = safeFold([event]);
  if (!bill) {
    throw new Error('persist verify failed · 内存未更新');
  }
  bills.set(bill.id, bill);
  eventsByBill.set(bill.id, [event]);
  return bill;
}

/**
 * 纯 helper · 从首帧 create 事件读取案的归属用户 id
 *  · 单一来源 · 供 dashboard 与审计按归属过滤复用
 *  · 无归属（旧数据 / 未传 userId）→ null
 */
export function billOwner(b: Bill): string | null {
  return (b.events[0]?.payload?.userId as string | undefined) ?? null;
}

/**
 * 纯 helper · 从首帧 create 事件读取案的归属租户 id（BL-07）。
 *  · 无归属（legacy / 未传 tenantId）→ null（不参与租户过滤 · 向后兼容）。
 */
export function billTenant(b: Bill): string | number | null {
  const t = b.events[0]?.payload?.tenantId;
  return typeof t === 'string' || typeof t === 'number' ? t : null;
}

export interface AppendEventInput {
  billId: string;
  type: EventType;
  actor: Actor;
  reason: string;
  payload?: Record<string, unknown>;
  /**
   * 乐观锁：客户端读到的 events 数 · 不匹配抛 OptimisticLockError
   *  · undefined = 不校验（向后兼容）
   *  · 推荐生产强制传
   */
  expectedEventCount?: number;
}

/* ==========================================================================
 * Per-bill 写入串行化 · 防同 bill 并发 transition race
 * ========================================================================== */

const writeLocks = new Map<string, Promise<unknown>>();

async function withBillLock<T>(billId: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(billId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(
    billId,
    next.catch(() => undefined),
  );
  return next;
}

export async function appendBillEvent(input: AppendEventInput): Promise<Bill> {
  await reload();
  return withBillLock(input.billId, async () => {
    const cur = bills.get(input.billId);
    if (!cur) throw new Error(`bill ${input.billId} not found`);

    // 乐观锁校验
    if (input.expectedEventCount !== undefined && cur.events.length !== input.expectedEventCount) {
      throw new OptimisticLockError(input.expectedEventCount, cur.events.length);
    }

    const plain: BillEvent = {
      id: genId('evt'),
      billId: input.billId,
      type: input.type,
      actor: input.actor,
      ts: new Date().toISOString(),
      reason: input.reason,
      payload: input.payload,
    };

    // 加链：找上一帧（必是 ChainedEvent）
    const arr = eventsByBill.get(input.billId) ?? [];
    const prevEvent = arr[arr.length - 1] ?? null;
    const event = chain(
      prevEvent && isChained(prevEvent) ? (prevEvent as ChainedEvent) : null,
      plain,
    );

    // applyEvent 校验 FSM 合法性 · 不合法抛
    const next = applyEvent(cur, event);

    // 持久化（治理事件不可丢：超长 throw JsonlTooLongError 冒泡到 API）
    await safeAppend(STORE_PATH, JSON.stringify(event), { noTruncate: true });
    // 写后读校验 · 失败则 throw · 绝不更新内存（保持内存与磁盘一致 = 失败则不前进）
    await verifyWritten(input.billId, { id: event.id, type: event.type });

    // 校验通过后再更新内存 · 不可变更新（arr 仍为旧引用 · 仅 push 新事件副本）
    bills.set(next.id, next);
    const nextArr = [...arr, event];
    eventsByBill.set(next.id, nextArr);

    return next;
  });
}

/**
 * 内部 helper · 判定一组事件的链化状态
 *  · all-chained：全部带 prevHash · 正常 verifyChain
 *  · none-chained：全部无 prevHash（legacy v1.0 数据）· 不参与哈希链校验
 *  · partial：混合 · 真实异常 · 给出第一处未链化 index
 *  不导出 · 仅 verifyBillChain 用
 */
function classifyChainStatus(
  events: BillEvent[],
): { kind: 'all' } | { kind: 'none' } | { kind: 'partial'; firstUnchainedAt: number } {
  let chainedCount = 0;
  let firstUnchainedAt = -1;
  for (let i = 0; i < events.length; i++) {
    if (isChained(events[i]!)) {
      chainedCount++;
    } else if (firstUnchainedAt === -1) {
      firstUnchainedAt = i;
    }
  }
  if (chainedCount === events.length) return { kind: 'all' };
  if (chainedCount === 0) return { kind: 'none' };
  return { kind: 'partial', firstUnchainedAt };
}

/**
 * 验证某 bill 的 audit chain 是否被篡改
 *  · /api/governance/audit/verify 用
 *
 *  GOV-AUDIT-01：每次直接重读磁盘原始行再验 · 不取内存副本
 *    （否则改 jsonl 后只要不重启 · 审计永远 ok=true）
 */
export async function verifyBillChain(billId: string): Promise<{
  ok: boolean;
  totalChecked: number;
  firstTamperedAt: number;
  reason?: string;
}> {
  // 直接读盘（含所有 rotation .0/.1/.2）· 不走内存
  const lines = await readAllRotations(STORE_PATH);
  const events: BillEvent[] = [];
  let parseErrors = 0;
  for (const line of lines) {
    let e: BillEvent;
    try {
      e = JSON.parse(line) as BillEvent;
    } catch {
      parseErrors++;
      continue; // 单行损坏不污染 · 不 throw
    }
    if (e.billId === billId) events.push(e);
  }
  // 与 reload 一致 · 按 ts 排序 · 保证与写入顺序一致再喂给 verifyChain
  events.sort((a, b) => a.ts.localeCompare(b.ts));

  const parseNote = parseErrors > 0 ? ` · ${parseErrors} 行解析失败（已跳过）` : '';

  if (events.length === 0) {
    return {
      ok: true,
      totalChecked: 0,
      firstTamperedAt: -1,
      reason: `no events${parseNote}`,
    };
  }

  // GOV-AUDIT-03：按链化状态分流 · 避免「未链化旧事件被误报篡改」
  const status = classifyChainStatus(events);
  if (status.kind === 'none') {
    // legacy v1.0 数据（无 prevHash）· 不参与哈希链校验 · 不报篡改
    return {
      ok: true,
      totalChecked: events.length,
      firstTamperedAt: -1,
      reason: `legacy unchained events · 未参与哈希链校验${parseNote}`,
    };
  }
  if (status.kind === 'partial') {
    // 混合 = 真实异常
    return {
      ok: false,
      totalChecked: events.length,
      firstTamperedAt: status.firstUnchainedAt,
      reason: `partial chain · 第一处未链化在 index ${status.firstUnchainedAt}${parseNote}`,
    };
  }

  // all-chained · 正常验链
  const result = verifyChain(events as ChainedEvent[]);
  if (parseErrors > 0) {
    return { ...result, reason: `${result.reason ?? 'ok'}${parseNote}` };
  }
  return result;
}

export async function getBill(
  billId: string,
  opts?: { tenantId?: string | number | null },
): Promise<Bill | null> {
  await reload();
  const bill = bills.get(billId) ?? null;
  if (!bill) return null;
  // BL-07 · 租户隔离：调用方提供 tenantId 时，跨租户案不可见（返回 null = 等价 404）。
  //   legacy 案无 tenant（billTenant=null）→ 保持可见（向后兼容，与 billOwner 同策略）。
  if (opts?.tenantId != null) {
    const owner = billTenant(bill);
    // String 归一化比较：避免 tenant_slug "6"(字符串) 与 tenantId 6(数字) 因 === 误判
    // （安全复核 Finding 3：跨 dev/prod token 形状的 type-confusion → 误 404）。
    if (owner != null && String(owner) !== String(opts.tenantId)) return null;
  }
  return bill;
}

export async function listBills(filter?: {
  state?: Bill['state'];
  tenantId?: string | number | null;
}): Promise<Bill[]> {
  await reload();
  let all = Array.from(bills.values()).sort((a, b) =>
    b.lastTransitionAt.localeCompare(a.lastTransitionAt),
  );
  // BL-07 · 租户隔离：提供 tenantId 时仅保留本租户 + legacy(无 tenant) 案。
  if (filter?.tenantId != null) {
    const tid = String(filter.tenantId);
    all = all.filter((b) => {
      const owner = billTenant(b);
      return owner == null || String(owner) === tid; // String 归一化(同 getBill·Finding 3)
    });
  }
  if (filter?.state) return all.filter((b) => b.state === filter.state);
  return all;
}

/** Test-only · 完全清空内存 + 删文件 */
export async function _resetForTest(): Promise<void> {
  bills.clear();
  eventsByBill.clear();
  loaded = false;
  try {
    await fs.unlink(STORE_PATH);
  } catch {
    /* ignore */
  }
}
