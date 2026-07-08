/**
 * SourceLabelGuard（PRD §11 真实性铁律）
 *
 * 产品面 5 标签的守门 + 合并。与 src/lib/reality/reality-state.ts 的关系：
 *   - reality-state = 内部 SSOT（real/fallback/mock/...）。
 *   - 本文件 = 产品面投影（LIVE/.../DEMO）+ 守门规则。
 *   - bridge 函数（toRealityState/fromRealityState）做唯一互转，禁别处再写映射。
 *
 * 合并语义（worst-wins，对应 PRD：只要有一路不实，整体降级）：
 *   LIVE+LIVE=LIVE · LIVE+LIVE_SWARM=LIVE_SWARM · LIVE+FALLBACK=MIXED
 *   LIVE+DEMO=MIXED · FALLBACK+FALLBACK=FALLBACK · DEMO+DEMO=DEMO
 */
import type { SourceLabel } from './types';

export const SOURCE_LABELS: readonly SourceLabel[] = [
  'LIVE',
  'LIVE_SWARM',
  'MIXED',
  'FALLBACK',
  'DEMO',
] as const;

export function isSourceLabel(value: unknown): value is SourceLabel {
  return typeof value === 'string' && (SOURCE_LABELS as readonly string[]).includes(value);
}

/** 缺失/非法 sourceLabel 一律报错（禁静默）。 */
export function assertSourceLabel(value: unknown): asserts value is SourceLabel {
  if (!isSourceLabel(value)) {
    throw new Error(`[SourceLabelGuard] 非法或缺失 sourceLabel: ${String(value)}`);
  }
}

export function isLiveLike(label: SourceLabel): boolean {
  return label === 'LIVE' || label === 'LIVE_SWARM';
}

export function isFallbackLike(label: SourceLabel): boolean {
  return label === 'FALLBACK' || label === 'DEMO';
}

/**
 * 真 jiqun swarm session_id 形状(2026-06-22 实跑 finance 蜂群探得):
 *   `20260622_085226_a15fb9` = `<YYYYMMDD>_<HHMMSS>_<hex hash>`
 * 这是廉价同步预闸,只能挡构造垃圾(如 adapter 返 {trace_id:'x'});
 * 真正的防伪承重墙是 reverifyLiveSwarmTrace() 的向后端往返核对(格式可仿、登记不可仿)。
 * 若 jiqun 改 session_id 格式,改这一处(单一真相源)。
 */
const JIQUN_SESSION_ID_RE = /^\d{8}_\d{6}_[a-z0-9]+$/i;

export function isGenuineSwarmTraceId(traceId: unknown): boolean {
  return typeof traceId === 'string' && JIQUN_SESSION_ID_RE.test(traceId.trim());
}

/**
 * 同步预闸:LIVE_SWARM 的 trace_id 必须长得像真 jiqun session_id,挡掉构造垃圾。
 * 这不是终极验真——一个格式合法但后端不存在的 session 仍能过这道闸,
 * 必须再经 reverifyLiveSwarmTrace() 往返核对才算"可向后端兑现"。会审 wy1tg27my C4。
 */
export function assertLiveSwarmTrace(label: SourceLabel, traceId: unknown): void {
  if (label !== 'LIVE_SWARM') return;
  if (typeof traceId !== 'string' || traceId.trim().length === 0) {
    throw new Error('[SourceLabelGuard] LIVE_SWARM requires a real swarm trace_id');
  }
  if (!isGenuineSwarmTraceId(traceId)) {
    throw new Error(
      `[SourceLabelGuard] LIVE_SWARM trace_id 不像真 jiqun session(疑似构造): ${traceId.slice(0, 40)}`,
    );
  }
}

export function assertDemoNotRealDecision(label: SourceLabel): void {
  if (label === 'DEMO') {
    throw new Error('[SourceLabelGuard] DEMO must not enter a real emperor decision');
  }
}

export function assertFallbackNotFinalCertainty(params: {
  sourceLabel: SourceLabel;
  verdict?: string;
  missingEvidence?: unknown[];
}): void {
  const approving = params.verdict === 'APPROVE' || params.verdict === '准奏' || params.verdict === 'adopt';
  if (params.sourceLabel === 'FALLBACK' && approving && (params.missingEvidence?.length ?? 0) === 0) {
    throw new Error('[SourceLabelGuard] FALLBACK must not be presented as final certainty');
  }
}

/**
 * 合并两个来源标签。worst-wins：任一不实则降级。
 * 全 live → 取更具体的（LIVE_SWARM > LIVE）；live 混 fallback/demo → MIXED；
 * 全不实 → 取更差的（DEMO > FALLBACK）。
 */
export function mergeTwo(a: SourceLabel, b: SourceLabel): SourceLabel {
  if (a === b) return a;
  const aLive = isLiveLike(a);
  const bLive = isLiveLike(b);
  if (aLive && bLive) return 'LIVE_SWARM'; // LIVE + LIVE_SWARM
  if (aLive !== bLive) return 'MIXED'; // 一实一不实
  return a === 'DEMO' || b === 'DEMO' ? 'DEMO' : 'FALLBACK'; // 都不实
}

export function mergeSourceLabels(labels: SourceLabel[]): SourceLabel {
  if (labels.length === 0) {
    throw new Error('[SourceLabelGuard] mergeSourceLabels 收到空数组');
  }
  return labels.reduce((acc, cur) => mergeTwo(acc, cur));
}
