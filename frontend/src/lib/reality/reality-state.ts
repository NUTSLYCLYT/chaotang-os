export type RealityState = 'real' | 'fallback' | 'mock' | 'degraded' | 'missing';

export interface RealitySignal {
  state: RealityState;
  label: string;
  detail: string;
  updatedAt?: string | null;
  evidencePath?: string | null;
}

export const REALITY_LABEL: Record<RealityState, string> = {
  real: 'REAL',
  fallback: 'FALLBACK',
  mock: 'MOCK',
  degraded: 'DEGRADED',
  missing: 'MISSING',
};

export const REALITY_TONE: Record<RealityState, 'success' | 'warn' | 'danger' | 'neutral'> = {
  real: 'success',
  fallback: 'warn',
  mock: 'warn',
  degraded: 'danger',
  missing: 'danger',
};

export function normalizeRealityState(value: unknown): RealityState {
  if (value === 'real' || value === 'ready' || value === 'LIVE' || value === 'LIVE_SWARM') return 'real';
  if (value === 'fallback' || value === 'FALLBACK' || value === 'MIXED') return 'fallback';
  if (value === 'mock' || value === 'DEMO') return 'mock';
  if (value === 'degraded' || value === 'needs_backend' || value === 'FIX') return 'degraded';
  return 'missing';
}

export function worstRealityState(states: RealityState[]): RealityState {
  const rank: Record<RealityState, number> = {
    real: 0,
    fallback: 1,
    mock: 2,
    degraded: 3,
    missing: 4,
  };
  return states.reduce<RealityState>((worst, state) => (rank[state] > rank[worst] ? state : worst), 'real');
}
