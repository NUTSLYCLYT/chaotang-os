export type ShiguanSourceLabel = 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO';

const SOURCE_LABELS: Record<ShiguanSourceLabel, string> = {
  LIVE: '真实归档',
  MIXED: '混合来源',
  FALLBACK: '降级空态',
  DEMO: '演示数据',
};

export function normalizeSourceLabel(value: unknown): ShiguanSourceLabel {
  if (value === 'LIVE' || value === 'LIVE_SWARM') return 'LIVE';
  if (value === 'MIXED') return 'MIXED';
  if (value === 'DEMO') return 'DEMO';
  return 'FALLBACK';
}

export function sourceLabelText(sourceLabel: ShiguanSourceLabel): string {
  return SOURCE_LABELS[sourceLabel];
}

export function isTruthySource(sourceLabel: ShiguanSourceLabel): boolean {
  return sourceLabel === 'LIVE' || sourceLabel === 'MIXED';
}
