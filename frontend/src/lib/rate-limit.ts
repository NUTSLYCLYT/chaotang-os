/**
 * rate-limit —— 极简内存滑动窗口限流（单节点，测试期保护烧 LLM 的端点）。
 *
 * Schneier/Charity：开给测试者前，给会烧 LLM 的路径加配额，别被打崩或烧爆 token。
 * 内存态、重启即清——足够测试期用；要跨节点/持久配额再换 Redis。
 */

const hits = new Map<string, number[]>();

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** 滑动窗口：key 在 windowMs 内最多 max 次。 */
export function rateLimit(key: string, max: number, windowMs: number): RateResult {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - arr[0]) };
  }
  arr.push(now);
  hits.set(key, arr);
  // 顺手清理过大的 map（测试期足够）
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return { ok: true, remaining: max - arr.length, retryAfterMs: 0 };
}
