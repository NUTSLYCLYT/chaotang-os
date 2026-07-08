/**
 * SourceLabel ↔ RealityState 唯一互转桥（铁律2：禁别处重写映射）。
 * 隔离 @/lib/reality 运行时依赖，让 source-label.ts 保持纯函数可单测。
 */
import { normalizeRealityState, type RealityState } from '@/lib/reality/reality-state';
import type { SourceLabel } from './types';

const REALITY_TO_LABEL: Record<RealityState, SourceLabel> = {
  real: 'LIVE',
  fallback: 'FALLBACK',
  mock: 'DEMO',
  degraded: 'FALLBACK',
  missing: 'FALLBACK',
};

export function fromRealityState(state: RealityState): SourceLabel {
  return REALITY_TO_LABEL[state];
}

export function toRealityState(label: SourceLabel): RealityState {
  return normalizeRealityState(label);
}
