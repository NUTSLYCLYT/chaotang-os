import type { FlywheelConfig, RaiseDraft } from './types';

export function capPerRun(drafts: RaiseDraft[], cfg: FlywheelConfig): RaiseDraft[] {
  const rank = (p: number | null) => (p === null ? -1 : p);
  return [...drafts].sort((a, b) => rank(b.priority) - rank(a.priority)).slice(0, Math.max(0, cfg.maxPerRun));
}
