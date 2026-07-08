import { create } from 'zustand';

export interface SwarmOverview {
  total: number;
  online: number;
  busy: number;
  blocked: number;
  warning: number;
  completedToday: number;
  needsAttention: number;
}

export interface SwarmUnit {
  id: string;
  name: string;
  status: string;
  priority: string;
  currentTaskTitle?: string;
  needsAttention: boolean;
  progressOverview?: string;
  blockedReason?: string;
  riskSummary?: string;
  updatedAt: string;
}

interface SwarmStore {
  overview: SwarmOverview | null;
  units: SwarmUnit[];
  setOverview: (o: SwarmOverview) => void;
  setUnits: (u: SwarmUnit[]) => void;
  patchUnit: (id: string, patch: Partial<SwarmUnit>) => void;
}

export const useSwarmStore = create<SwarmStore>(set => ({
  overview: null,
  units: [],
  setOverview: overview => set({ overview }),
  setUnits: units => set({ units }),
  patchUnit: (id, patch) => set(s => ({ units: s.units.map(u => (u.id === id ? { ...u, ...patch } : u)) })),
}));
