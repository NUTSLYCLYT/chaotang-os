/**
 * 朝堂 OS · Per-User Budget Gate
 *
 * 防止单用户月烧超预算。
 *   - 双窗口：daily + monthly USD ceiling
 *   - 软限：超 daily → 强制走 cheap model · 不拒
 *   - 硬限：超 monthly → 拒（HTTP 429 由 router 决定 · 此层只 report）
 *
 * 持久化：内存 + jsonl 追加 · 进程重启从最近 30 天 jsonl 重建
 *   生产换 postgres ledger · 本层接口不变
 *
 * Race-safe：用 Map<userId, ledger> + 串行写文件 · 同 user 并发先后入账
 */

import { promises as fs } from 'fs';

// 极简内嵌 logger · 避免依赖 @/lib/logger（让测试能 raw node 跑）
const logger = {
  info: (msg: string, fields?: Record<string, unknown>) =>
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg, ...fields })),
  warn: (msg: string, fields?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg, ...fields })),
};

// 内嵌的"安全 append"· 与 safe-jsonl.ts 同语义 · 但避免跨文件 .ts 导入坑
// 单条 < 3500B 时 POSIX O_APPEND 原子（PIPE_BUF 4096 留余量）
const PIPE_BUF_SAFE = 3500;
async function safeAppendInline(path: string, line: string): Promise<void> {
  let payload = line;
  if (payload.length > PIPE_BUF_SAFE) {
    payload = payload.slice(0, PIPE_BUF_SAFE - 50) + `…<truncated@${payload.length}B>`;
  }
  if (!payload.endsWith('\n')) payload += '\n';
  const fh = await fs.open(path, 'a');
  try {
    await fh.appendFile(payload, 'utf-8');
  } finally {
    await fh.close();
  }
}

export interface BudgetLimit {
  dailyUsd: number;
  monthlyUsd: number;
}

export interface BudgetSnapshot {
  userId: string;
  dayKey: string;
  monthKey: string;
  spentToday: number;
  spentMonth: number;
  limit: BudgetLimit;
}

export type BudgetVerdict =
  | { ok: true; remaining: { day: number; month: number } }
  | { ok: false; reason: 'over_daily' | 'over_monthly'; soft: boolean; snapshot: BudgetSnapshot };

const DEFAULT_LIMITS: BudgetLimit = {
  dailyUsd: Number(process.env.LLM_BUDGET_DAILY_USD ?? 5),
  monthlyUsd: Number(process.env.LLM_BUDGET_MONTHLY_USD ?? 50),
};

const LEDGER_PATH = process.env.LLM_LEDGER_PATH ?? '/tmp/courtos-llm-ledger.jsonl';
const ledger = new Map<string, BudgetSnapshot>();
let ledgerLoaded = false;
let writeQueue: Promise<void> = Promise.resolve();

/* ------------------------------------------------------------------ *
 * LLM-BUDGET-03 · 预扣账（in-flight reservations）
 *
 * 为消除 checkBudget 的 check-then-act 竞态：并发请求在真正 recordSpend
 * 落账前，先在内存里"预扣"估算成本，使彼此可见。checkBudget 的判定改为
 * `spentMonth + reserved + estimatedCost > limit`，让并发请求看到彼此占用。
 *
 * 预扣量独立于 BudgetSnapshot 持久化（不进 jsonl），故单独存 Map，
 * 不污染 BudgetSnapshot 形状（getBudgetSnapshot / verdict.snapshot 不变）。
 * ------------------------------------------------------------------ */
interface Reservation {
  resToday: number;
  resMonth: number;
  dayKey: string;
  monthKey: string;
}
const reservations = new Map<string, Reservation>();

/* 同一 user 的 reserve→settle 临界区串行化 · per-user mutex（Map<userId,Promise>）*/
const userLocks = new Map<string, Promise<void>>();

function getReservation(userId: string): Reservation {
  const today = dayKey();
  const month = monthKey();
  let res = reservations.get(userId);
  if (!res) {
    res = { resToday: 0, resMonth: 0, dayKey: today, monthKey: month };
    reservations.set(userId, res);
    return res;
  }
  // 跨日 / 跨月 · 与 snapshot 同步重置预扣窗口（与 getOrInit 同口径）
  if (res.dayKey !== today) {
    res.dayKey = today;
    res.resToday = 0;
  }
  if (res.monthKey !== month) {
    res.monthKey = month;
    res.resMonth = 0;
  }
  return res;
}

/**
 * per-user 串行化：把 fn 排在该 user 的锁链尾部执行 · 复用 writeQueue 思路。
 * 保证同一 user 的 reserve→settle 临界区不交错，避免并发预扣读写竞态。
 *
 * 实现：每个 user 维护一条 promise 链。新调用 await 当前链尾，执行完释放
 * 自己的环节。若执行完后该 user 的链尾正好是自己（无后继等待者），清理
 * Map 项避免内存泄漏。
 */
async function withUserLock<T>(userId: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  userLocks.set(userId, mine);
  try {
    await prev;
  } catch {
    // 上游环节即便抛错也不阻塞后续 · 锁链不被毒化
  }
  try {
    return await fn();
  } finally {
    release();
    // 若链尾仍是自己 · 说明无后继等待者 · 清理避免内存泄漏
    if (userLocks.get(userId) === mine) {
      userLocks.delete(userId);
    }
  }
}

function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

function getLimit(_userId: string): BudgetLimit {
  // 现在所有用户用默认 · 后续接 user table 时改这里
  return DEFAULT_LIMITS;
}

function getOrInit(userId: string): BudgetSnapshot {
  const today = dayKey();
  const month = monthKey();
  let snap = ledger.get(userId);
  if (!snap) {
    snap = {
      userId,
      dayKey: today,
      monthKey: month,
      spentToday: 0,
      spentMonth: 0,
      limit: getLimit(userId),
    };
    ledger.set(userId, snap);
    return snap;
  }
  // 跨日 · 重置 daily
  if (snap.dayKey !== today) {
    snap.dayKey = today;
    snap.spentToday = 0;
  }
  // 跨月 · 重置 monthly
  if (snap.monthKey !== month) {
    snap.monthKey = month;
    snap.spentMonth = 0;
  }
  return snap;
}

/* ==========================================================================
 * 持久化 · jsonl 追加 + 启动时 reload
 * ========================================================================== */

async function persistEntry(entry: { userId: string; ts: string; costUsd: number }) {
  // 用 inline safe-append · 多进程下原子（< PIPE_BUF）
  // 单进程内的串行化由 writeQueue 保证 race
  writeQueue = writeQueue.then(async () => {
    try {
      await safeAppendInline(LEDGER_PATH, JSON.stringify(entry));
    } catch (err) {
      logger.warn('budget ledger write failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  });
  return writeQueue;
}

/**
 * LLM-BUDGET-02 · 双重计费根因与单实例正确性约定
 *
 * 唯一真相：reload **一次** → 运行期内存累加（recordSpend）→ 异步落 jsonl。
 *   - reload 只在 ledgerLoaded=false 时执行一次（下方守卫），把历史 jsonl
 *     累加进 snap.spentMonth/spentToday，作为进程启动时的内存初值。
 *   - recordSpend 运行期只累加内存 + 异步追加 jsonl，**绝不触发 reload**，
 *     因此同一笔花费不会被「reload 一次 + recordSpend 一次」双算。
 *   - ledgerLoaded 守卫确保 reload 不会重复执行 → 内存与磁盘对单实例一致。
 *
 * 已知局限（deferred）：多实例部署下各进程持有独立内存账，reload 守卫使
 *   各自内存与共享 jsonl 发散。集中式原子计数（Postgres / Redis ledger）
 *   见 docs/CHAOTANG_FLOW_AUDIT.md，本层接口不变可平滑替换。
 */
async function reloadFromLedger() {
  if (ledgerLoaded) return;
  ledgerLoaded = true;
  try {
    const txt = await fs.readFile(LEDGER_PATH, 'utf-8');
    const today = dayKey();
    const month = monthKey();
    for (const line of txt.split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as { userId: string; ts: string; costUsd: number };
        const d = new Date(e.ts);
        const eDay = dayKey(d);
        const eMonth = monthKey(d);
        if (eMonth !== month) continue;
        const snap = getOrInit(e.userId);
        snap.spentMonth += e.costUsd;
        if (eDay === today) snap.spentToday += e.costUsd;
      } catch {
        // skip bad lines
      }
    }
    logger.info('budget ledger reloaded', {
      users: ledger.size,
      file: LEDGER_PATH,
    });
  } catch {
    // file 不存在 · 全新启动
  }
}

/* ==========================================================================
 * 公开 API
 * ========================================================================== */

export async function checkBudget(
  userId: string,
  estimatedCostUsd: number,
): Promise<BudgetVerdict> {
  await reloadFromLedger();
  const snap = getOrInit(userId);
  // LLM-BUDGET-03 · 把 in-flight 预扣计入判定 · 让并发请求看到彼此占用
  const res = getReservation(userId);

  if (snap.spentMonth + res.resMonth + estimatedCostUsd > snap.limit.monthlyUsd) {
    return { ok: false, reason: 'over_monthly', soft: false, snapshot: { ...snap } };
  }
  if (snap.spentToday + res.resToday + estimatedCostUsd > snap.limit.dailyUsd) {
    // 软限：返回 ok=false 但 soft=true · router 自己决定降级
    return { ok: false, reason: 'over_daily', soft: true, snapshot: { ...snap } };
  }
  return {
    ok: true,
    remaining: {
      day: snap.limit.dailyUsd - snap.spentToday - res.resToday,
      month: snap.limit.monthlyUsd - snap.spentMonth - res.resMonth,
    },
  };
}

/**
 * LLM-BUDGET-02 · 运行期记账（唯一内存累加点 + 异步落 jsonl）
 *
 * 只累加内存 + 异步追加 jsonl，**不触发 reload**（reload 仅启动一次，
 * 见 reloadFromLedger 注释）。故同一笔花费不会被双算。
 */
export async function recordSpend(userId: string, costUsd: number): Promise<void> {
  if (costUsd <= 0) return;
  const snap = getOrInit(userId);
  snap.spentToday += costUsd;
  snap.spentMonth += costUsd;
  await persistEntry({
    userId,
    ts: new Date().toISOString(),
    costUsd,
  });
}

/* ==========================================================================
 * LLM-BUDGET-03 · 预扣 / 结算 API（附加 · 不改现有导出）
 *
 * 用法（消除 check-then-act 竞态的推荐路径）：
 *   1. checkBudget(userId, est)        // 判定（已含其它请求的预扣）
 *   2. const r = await reserveSpend(userId, est)  // 占住额度
 *   3. ...真正调用 LLM，拿到 actualUsd...
 *   4. await settleSpend(userId, r, actualUsd)    // 释放预扣 + 按实际落账
 *
 * 老调用方仍可只用 checkBudget + recordSpend，行为不变（向后兼容）。
 * ========================================================================== */

/**
 * 预扣额度（in-flight）· 返回本次预扣的 USD（= estCostUsd，clamp 非负）。
 * 把该额度计入内存预扣账，使并发的 checkBudget 看到占用。必须配对 settleSpend。
 */
export async function reserveSpend(userId: string, estCostUsd: number): Promise<number> {
  const reserved = estCostUsd > 0 ? estCostUsd : 0;
  if (reserved === 0) return 0;
  return withUserLock(userId, () => {
    const res = getReservation(userId);
    res.resToday += reserved;
    res.resMonth += reserved;
    return reserved;
  });
}

/**
 * 结算：先减去之前 reserveSpend 返回的预扣额，再按 actualUsd 实扣并落 jsonl。
 * @param reservedUsd reserveSpend 的返回值（本次预扣的额度）
 * @param actualUsd   实际花费 USD（可为 0 · 表示调用失败仅释放预扣）
 */
export async function settleSpend(
  userId: string,
  reservedUsd: number,
  actualUsd: number,
): Promise<void> {
  await withUserLock(userId, async () => {
    if (reservedUsd > 0) {
      const res = getReservation(userId);
      res.resToday = Math.max(0, res.resToday - reservedUsd);
      res.resMonth = Math.max(0, res.resMonth - reservedUsd);
    }
    if (actualUsd > 0) {
      const snap = getOrInit(userId);
      snap.spentToday += actualUsd;
      snap.spentMonth += actualUsd;
      await persistEntry({
        userId,
        ts: new Date().toISOString(),
        costUsd: actualUsd,
      });
    }
  });
}

export function getBudgetSnapshot(userId: string): BudgetSnapshot {
  return { ...getOrInit(userId) };
}

/** Test-only · 重置内存 · jsonl 不动 */
export function _resetForTest() {
  ledger.clear();
  reservations.clear();
  userLocks.clear();
  ledgerLoaded = false;
}
