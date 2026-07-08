/**
 * llm-budget —— 全局 LLM 调用预算(令牌桶,与 user 无关)。大神会审 risk#3 处方。
 *
 * 为什么需要它:per-user 限流的计费维度是"人头×次数",而攻击者的获益维度是"LLM token 烧钱"——
 * 换一个 userId 就是一份新配额。这道闸与 user 无关,按"本窗口内全系统 dept/ask 总调用数"计,
 * 是烧钱的硬总闸。orchestrate/all 一次扇出 7 路,即消耗 7 个令牌。
 *
 * ⚠ 现为单节点内存态:够单实例,但多副本部署下各副本各算各的(N 副本 = N×预算)。
 * 多副本需设 REDIS_URL 并换 Redis 实现——接口(consumeLlmBudget)已为此留 seam,
 * 届时只换内部存储、调用方零改。
 */

const WINDOW_MS = 60_000;
// 每分钟全系统 dept/ask 调用上限(默认 60 ≈ 8 道满编密旨/分)。可经 env 调。
const MAX_TOKENS = Math.max(1, Number(process.env.LLM_BUDGET_PER_MIN ?? 60));

let windowStart = 0;
let used = 0;

export interface BudgetResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * 尝试消耗 tokens 个 LLM 调用额度。ok=false 表示本窗口预算已尽,应 503 排队。
 * 单节点内存实现;多副本换 Redis(INCRBY + EXPIRE 原子)即可,签名不变。
 */
export function consumeLlmBudget(tokens: number): BudgetResult {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    used = 0;
  }
  if (used + tokens > MAX_TOKENS) {
    return { ok: false, remaining: Math.max(0, MAX_TOKENS - used), retryAfterMs: WINDOW_MS - (now - windowStart) };
  }
  used += tokens;
  return { ok: true, remaining: MAX_TOKENS - used, retryAfterMs: 0 };
}

/** 测试/诊断用:重置窗口。 */
export function __resetLlmBudget(): void {
  windowStart = 0;
  used = 0;
}
