import { normalizeRealityState } from './reality-state.ts';

export type CourtSourceLabel = 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';

/**
 * 诚实合并多步 sourceLabel(2026-06-29 · 真验证挖出:丞相超时离线却整体标 LIVE)。
 *
 * 铁律13.2.3:FALLBACK/DEMO 禁伪装 LIVE。决策由多步组成(拟旨 refine + 奏折 report),
 * 任一步降级 → 整体不得标 LIVE,否则骗裁决者"这是真 AI 判断"。
 *   全真 → LIVE / 部分真部分降级 → MIXED / 全离线兜底 → FALLBACK / 全演示 → DEMO。
 *   未知(空)一律 FALLBACK —— 诚实降级,绝不默认 LIVE(旧 `?? 'LIVE'` 正是骗人的根)。
 */
export function mergeHonestSource(labels: Array<string | undefined | null>): CourtSourceLabel {
  const states = labels
    .filter((l): l is string => Boolean(l))
    .map(normalizeRealityState);
  if (states.length === 0) return 'FALLBACK';
  if (states.every((s) => s === 'real')) return 'LIVE';
  if (states.some((s) => s === 'real')) return 'MIXED';
  return states.every((s) => s === 'mock') ? 'DEMO' : 'FALLBACK';
}
