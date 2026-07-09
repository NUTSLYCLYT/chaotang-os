import type { JunjichuSourceLabel } from './types';

export function normalizeJunjichuSourceLabel(value: unknown, fallback: JunjichuSourceLabel = 'DEMO'): JunjichuSourceLabel {
  if (value === 'LIVE' || value === 'LIVE_SWARM' || value === 'MIXED' || value === 'FALLBACK' || value === 'DEMO') {
    return value;
  }
  return fallback;
}

export function sourceLabelTone(label: JunjichuSourceLabel): { text: string; border: string; background: string } {
  if (label === 'LIVE' || label === 'LIVE_SWARM') {
    return { text: '#8AE4B4', border: 'rgba(61,214,140,0.42)', background: 'rgba(61,214,140,0.08)' };
  }
  if (label === 'MIXED') {
    return { text: '#AFC0FF', border: 'rgba(138,164,255,0.42)', background: 'rgba(138,164,255,0.08)' };
  }
  if (label === 'FALLBACK') {
    return { text: '#F58B8B', border: 'rgba(245,139,139,0.42)', background: 'rgba(245,139,139,0.08)' };
  }
  return { text: '#F0C66A', border: 'rgba(240,198,106,0.38)', background: 'rgba(240,198,106,0.07)' };
}
