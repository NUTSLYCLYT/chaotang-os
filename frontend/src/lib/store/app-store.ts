/**
 * 朝堂 OS V2 · 全局 App Store
 *
 * 单文件多 slice，按领域切分。各页面 agent 只追加自己的 slice，
 * 禁止修改其他 agent 的 slice 与 selector。
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Task } from '@/types/task';
import type { AgentCode, AgentRun } from '@/types/agent';
import type { IntelSignal, IntelFilter } from '@/types/intel';
import type { HealthProfile } from '@/types/health';
import type { Report } from '@/types/report';
import { emitAudit, registerAuditUserSource } from '@/lib/audit/audit-emitter';

/* ==========================================================================
   UI Slice
   ========================================================================== */

interface UiSlice {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeDrawer: string | null;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (v: boolean) => void;
  openDrawer: (key: string) => void;
  closeDrawer: () => void;
}

/* ==========================================================================
   Task Slice
   ========================================================================== */

interface TaskSlice {
  tasks: Task[];
  currentTaskId: string | null;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  selectTask: (id: string | null) => void;
  getTaskById: (id: string) => Task | undefined;
}

/* ==========================================================================
   Agent Slice
   ========================================================================== */

interface AgentSlice {
  agentRuns: AgentRun[];
  setAgentRuns: (runs: AgentRun[]) => void;
  upsertAgentRun: (run: AgentRun) => void;
  getAgentRunByCode: (code: AgentCode) => AgentRun | undefined;
}

/* ==========================================================================
   Intel Slice
   ========================================================================== */

interface IntelSlice {
  intelSignals: IntelSignal[];
  intelFilter: IntelFilter;
  selectedSignalId: string | null;
  setIntelSignals: (signals: IntelSignal[]) => void;
  updateIntelFilter: (patch: Partial<IntelFilter>) => void;
  selectSignal: (id: string | null) => void;
}

/* ==========================================================================
   Health Slice
   ========================================================================== */

interface HealthSlice {
  healthProfile: HealthProfile | null;
  setHealthProfile: (p: HealthProfile | null) => void;
}

/* ==========================================================================
   Report Slice
   ========================================================================== */

interface ReportSlice {
  reports: Report[];
  currentReport: Report | null;
  setReports: (reports: Report[]) => void;
  addReport: (report: Report) => void;
  setCurrentReport: (r: Report | null) => void;
  getReportById: (id: string) => Report | undefined;
}

/* ==========================================================================
   Review Slice
   ========================================================================== */

interface ReviewSlice {
  pendingReviewIds: string[];
  setPendingReviewIds: (ids: string[]) => void;
  removePendingReview: (id: string) => void;
}

/* ==========================================================================
   Demo Slice
   ========================================================================== */

interface DemoSlice {
  demoPlayingScriptId: string | null;
  setDemoPlayingScript: (id: string | null) => void;
}

/* ==========================================================================
   Command Prefill Slice
   ========================================================================== */

interface CommandPrefillSlice {
  pendingCommandText: string;
  setPendingCommandText: (text: string) => void;
  consumePendingCommandText: () => string;
}

/* ==========================================================================
   Auth Slice
   ========================================================================== */

const CURRENT_USER_KEY = 'courtos.currentUserId';

function readPersistedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CURRENT_USER_KEY);
}

interface AuthSlice {
  currentUserId: string | null;
  switchIdentity: (userId: string) => void;
  logout: () => void;
}

/* ==========================================================================
   Unified store type
   ========================================================================== */

export type AppStore = UiSlice &
  TaskSlice &
  AgentSlice &
  IntelSlice &
  HealthSlice &
  ReportSlice &
  ReviewSlice &
  DemoSlice &
  CommandPrefillSlice &
  AuthSlice;

/* ==========================================================================
   Store implementation
   ========================================================================== */

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
  /* ---- UI ---- */
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  activeDrawer: null,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  openDrawer: (key) => set({ activeDrawer: key }),
  closeDrawer: () => set({ activeDrawer: null }),

  /* ---- Tasks ---- */
  tasks: [],
  currentTaskId: null,
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  selectTask: (id) => set({ currentTaskId: id }),
  getTaskById: (id) => get().tasks.find((t) => t.id === id),

  /* ---- Agents ---- */
  agentRuns: [],
  setAgentRuns: (runs) => set({ agentRuns: runs }),
  upsertAgentRun: (run) =>
    set((s) => {
      const existing = s.agentRuns.findIndex((r) => r.id === run.id);
      if (existing >= 0) {
        const next = [...s.agentRuns];
        next[existing] = run;
        return { agentRuns: next };
      }
      return { agentRuns: [...s.agentRuns, run] };
    }),
  getAgentRunByCode: (code) => get().agentRuns.find((r) => r.agentCode === code),

  /* ---- Intel ---- */
  intelSignals: [],
  intelFilter: {
    regions: [],
    industries: [],
    levels: ['info', 'watch', 'warning', 'critical'],
    categories: ['risk', 'opportunity', 'neutral'],
  },
  selectedSignalId: null,
  setIntelSignals: (signals) => set({ intelSignals: signals }),
  updateIntelFilter: (patch) =>
    set((s) => ({ intelFilter: { ...s.intelFilter, ...patch } })),
  selectSignal: (id) => set({ selectedSignalId: id }),

  /* ---- Health ---- */
  healthProfile: null,
  setHealthProfile: (p) => set({ healthProfile: p }),

  /* ---- Report ---- */
  reports: [],
  currentReport: null,
  setReports: (reports) => set({ reports }),
  addReport: (report) =>
    set((s) => ({
      reports: s.reports.some((r) => r.id === report.id)
        ? s.reports.map((r) => (r.id === report.id ? report : r))
        : [report, ...s.reports],
      currentReport: report,
    })),
  setCurrentReport: (r) => set({ currentReport: r }),
  getReportById: (id) => get().reports.find((r) => r.id === id),

  /* ---- Demo ---- */
  demoPlayingScriptId: null,
  setDemoPlayingScript: (id) => set({ demoPlayingScriptId: id }),

  /* ---- Review ---- */
  pendingReviewIds: [],
  setPendingReviewIds: (ids) => set({ pendingReviewIds: ids }),
  removePendingReview: (id) =>
    set((s) => ({
      pendingReviewIds: s.pendingReviewIds.filter((x) => x !== id),
    })),

  /* ---- Command Prefill ---- */
  pendingCommandText: '',
  setPendingCommandText: (text) => set({ pendingCommandText: text }),
  consumePendingCommandText: () => {
    const text = get().pendingCommandText;
    set({ pendingCommandText: '' });
    return text;
  },

  /* ---- Auth ---- */
  currentUserId: readPersistedUserId(),
  switchIdentity: (userId) => {
    const prev = get().currentUserId;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CURRENT_USER_KEY, userId);
    }
    set({
      currentUserId: userId,
      currentTaskId: null,
      tasks: get().tasks,
    });
    emitAudit('switch_account', {
      userId,
      metadata: { from: prev ?? 'none', to: userId },
    });
  },
  logout: () => {
    const userId = get().currentUserId;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    }
    if (userId) emitAudit('logout', { userId });
    set({ currentUserId: null, currentTaskId: null });
  },
    }),
    {
      name: 'courtos-app-store-v1',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : (undefined as unknown as Storage))),
      partialize: (state) => ({
        tasks: state.tasks,
        currentTaskId: state.currentTaskId,
        currentUserId: state.currentUserId,
        agentRuns: state.agentRuns,
      }),
    },
  ),
);

// Wire audit user source so emitAudit can resolve userId without importing store
registerAuditUserSource(() => useAppStore.getState().currentUserId);

/* ==========================================================================
   Typed selectors —— 避免每个组件都手写 useAppStore((s) => ...)
   ========================================================================== */

export const useCurrentTask = () =>
  useAppStore((s) => {
    if (!s.currentTaskId) return null;
    return s.tasks.find((t) => t.id === s.currentTaskId) ?? null;
  });

export const useAgentRunsByCode = () => {
  const runs = useAppStore((s) => s.agentRuns);
  const map = new Map<AgentCode, AgentRun>();
  for (const run of runs) {
    map.set(run.agentCode, run);
  }
  return map;
};
