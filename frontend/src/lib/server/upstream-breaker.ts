/**
 * 通用上游熔断器（2026-06-24 · 融合 · 所有跨进程上游统一熔断，取代 courtos 单点版）。
 *
 * 死/慢上游不再每调吃满超时:连续失败达阈值 → OPEN 一个冷却窗,期间 breakerFetch 立即抛
 * `<name>_breaker_open`,让调用方瞬时走兜底/诚实空,而不是再吃一次超时。
 *
 * timeoutMs 可配:courtos 代理类用默认短超时(快失败死链);jiqun 真蜂群 RUN 类传长超时
 * (真执行可达 20s)——熔断打开判定是瞬时的(不发请求),故长超时只在上游"活着但慢"时生效。
 */
const DEFAULT_TIMEOUT_MS = 1500;
const FAIL_THRESHOLD = 2;
const COOLDOWN_MS = 30_000;

interface BreakerState {
  fails: number;
  openUntil: number;
}
const states = new Map<string, BreakerState>();

function stateOf(name: string): BreakerState {
  let s = states.get(name);
  if (!s) {
    s = { fails: 0, openUntil: 0 };
    states.set(name, s);
  }
  return s;
}

export type BreakerStatus = 'closed' | 'open';

export function breakerStatus(name: string): BreakerStatus {
  return Date.now() < stateOf(name).openUntil ? 'open' : 'closed';
}

/** 仅供测试/诊断:复位某上游(或全部)熔断状态。 */
export function __resetBreaker(name?: string): void {
  if (name) states.delete(name);
  else states.clear();
}

export interface BreakerFetchOpts {
  /** 本次调用超时(ms)。默认 1500(快失败死链);真蜂群 RUN 类应传其 RUN_TIMEOUT_MS。 */
  timeoutMs?: number;
}

export async function breakerFetch(
  name: string,
  url: string,
  init?: RequestInit,
  opts?: BreakerFetchOpts,
): Promise<Response> {
  const s = stateOf(name);
  if (Date.now() < s.openUntil) {
    throw new Error(`${name}_breaker_open`);
  }
  // 超时优先级:显式 opts.timeoutMs > 调用方自带 init.signal(如 RUN 类的 20s) > 默认短超时。
  const signal =
    opts?.timeoutMs != null
      ? AbortSignal.timeout(opts.timeoutMs)
      : (init?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS));
  try {
    const res = await fetch(url, { ...init, signal });
    // 拿到响应(哪怕 4xx/5xx)= 上游活着,复位失败计数。
    s.fails = 0;
    return res;
  } catch (err) {
    s.fails += 1;
    if (s.fails >= FAIL_THRESHOLD) {
      s.openUntil = Date.now() + COOLDOWN_MS;
    }
    throw err;
  }
}

/** courtos 遗物代理:强制短超时(忽略调用方残留 signal),快失败死链。 */
export const courtosFetch = (url: string, init?: RequestInit): Promise<Response> =>
  breakerFetch('courtos', url, init, { timeoutMs: DEFAULT_TIMEOUT_MS });

/** jiqun 真蜂群:尊重调用方自带 signal(RUN 类 20s / RESULT 类 10s);jiqun DOWN 时 2 次失败后瞬时快失败。 */
export const jiqunFetch = (url: string, init?: RequestInit, opts?: BreakerFetchOpts): Promise<Response> =>
  breakerFetch('jiqun', url, init, opts);
