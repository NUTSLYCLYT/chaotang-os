/**
 * courtos 上游熔断器 —— 兼容垫片（2026-06-24 · 实现已并入 upstream-breaker 通用熔断）。
 *
 * 历史:本文件曾是 courtos 单点熔断器。融合后统一到 `upstream-breaker`(所有上游一套引擎,per-name 状态)。
 * 保留这些导出以兼容既有 import(`@/lib/server/courtos-breaker`);新代码请直接用 `upstream-breaker`。
 */
import { breakerStatus, __resetBreaker, courtosFetch } from './upstream-breaker';

export type CourtosBreakerState = 'closed' | 'open';

export function courtosBreakerState(): CourtosBreakerState {
  return breakerStatus('courtos');
}

/** 仅供测试/诊断:复位 courtos 熔断状态。 */
export function __resetCourtosBreaker(): void {
  __resetBreaker('courtos');
}

export { courtosFetch };
