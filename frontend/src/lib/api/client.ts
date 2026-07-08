/**
 * 朝堂 OS V2 · API Client（混合模式）
 *
 * 每个 endpoint group 可独立选择 mock / real：
 * - tasks / agents / reports → 可切换（V1 后端支持）
 * - intel / health / forecast → 只能 mock（V1 没有对应端点）
 *
 * 通过环境变量控制：
 *   NEXT_PUBLIC_API_MODE=mock | real | hybrid
 *   NEXT_PUBLIC_V1_API_URL=http://localhost:4000/api
 */

import type { Task, CreateTaskDto, TaskFilter } from '@/types/task';
import type { AgentRun, AgentMeta } from '@/types/agent';
import type { IntelSignal, IntelFilter } from '@/types/intel';
import type { HealthProfile } from '@/types/health';
import type { Report, ReportTemplate } from '@/types/report';
import type { ForecastScenario } from '@/types/forecast';
import { withBasePath } from '@/lib/base-path';
import {
  mockTasks,
  mockAgentRuns,
  mockIntelSignals,
  mockHealthProfile,
  mockReports,
  mockAgentMetaList,
  mockForecastScenarios,
  createMockTask,
} from '@/lib/mock/fixtures';
import {
  adaptV1Task,
  adaptV1FullTask,
  adaptV1Report,
  adaptV1DepartmentRuns,
  adaptV1NodeRuns,
  partitionValidTasks,
} from './adapters/v1-adapters';
import { backfillRetrospectives, synthesizeRetrospective } from './adapters/retrospective-synth';

/* ==========================================================================
   Config
   ========================================================================== */


async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    const auth = await import('@/lib/auth');
    token = auth.getToken();
  }
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(input.startsWith('/') ? withBasePath(input) : input, { ...init, headers });
}

export type ApiMode = 'mock' | 'real' | 'hybrid';

// #2 默认 'real'(原 'mock')：消除"prod 缺 .env.local 即静默整仓退化成假数据"的根因。
// NEXT_PUBLIC_* 在 build 时内联，改默认后须重新 build 生效；单 endpoint 失败仍有 safeReal→mock
// 兜底但会 console.warn 明示(不再静默全仓假)。构建门(scripts/next-with-base-path.mjs)另强制 prod=real。
export const API_MODE: ApiMode =
  (process.env.NEXT_PUBLIC_API_MODE as ApiMode) ?? 'real';

export const V1_API_URL =
  process.env.NEXT_PUBLIC_V1_API_URL ?? 'http://localhost:4000/api';

/** 是否对支持的 endpoint 使用真实后端 */
const USE_REAL = API_MODE === 'real' || API_MODE === 'hybrid';

/** 各领域的实际模式 */
export const ENDPOINT_MODE = {
  tasks: USE_REAL ? 'real' : 'mock',
  agents: USE_REAL ? 'real' : 'mock',
  departments: USE_REAL ? 'real' : 'mock',
  intel: USE_REAL ? 'real' : 'mock',
  health: USE_REAL ? 'real' : 'mock',
  forecast: USE_REAL ? 'real' : 'mock',
  reports: USE_REAL ? 'real' : 'mock',
} as const;

const MOCK_LATENCY_MS = 400;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ==========================================================================
   Error
   ========================================================================== */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ==========================================================================
   Real HTTP wrapper
   ========================================================================== */

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface ApiV1NodeRun {
  id: string;
  taskId: string;
  planId: string;
  department: string;
  status: string;
  subtaskId: string;
  description: string;
  assignedNodeId: string;
  assignedNode?: { id: string; node_type?: string; maturity?: string } | null;
  routingNodeIds: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  output?: string | Record<string, unknown> | null;
}

async function v1Request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Inject auth (lazy import to avoid SSR issues)
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    const auth = await import('@/lib/auth');
    token = auth.getToken();
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${V1_API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== 'undefined') {
    const auth = await import('@/lib/auth');
    auth.clearSession();
    if (!window.location.pathname.startsWith('/login')) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new ApiError(`V1 API ${res.status}`, res.status, detail);
  }

  // A NestJS uses { code, message, data }; legacy V1 used { success, data, error }.
  // Accept both envelopes.
  const json = (await res.json()) as Record<string, unknown>;
  if ('code' in json) {
    if (json.code !== 200 && json.code !== 201) {
      throw new ApiError(String(json.message ?? 'A API non-2xx envelope'), res.status);
    }
    return json.data as T;
  }
  if (json.success === false) {
    throw new ApiError(String(json.error ?? 'V1 API returned success=false'), res.status);
  }
  return json.data as T;
}

async function bffRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    const auth = await import('@/lib/auth');
    token = auth.getToken();
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path.startsWith('/') ? withBasePath(path) : path, {
    cache: 'no-store',
    ...options,
    headers,
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const detail = json ?? (await res.text().catch(() => ''));
    throw new ApiError(`BFF ${res.status}`, res.status, detail);
  }

  return json as T;
}

async function bffEnvelopeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const json = await bffRequest<ApiEnvelope<T>>(path, options);
  if (!json.success) {
    throw new ApiError(json.error ?? 'BFF returned success=false', 502, json);
  }
  return json.data;
}

/**
 * 真假可见性登记表（DATA-TRUTH-01）。
 *
 * safeReal 每次因真实后端失败而回退 mock 时，都会在此登记：哪个域、为何失败、
 * 何时发生。这让"正在吃假数据"从藏在 console 里的 warn，变成任何 UI/调试面板
 * 都能读取的运行时信号。被消费方（如顶栏徽标、健康页）可据此显式提示用户。
 *
 * 设计原则：不删 fallback（避免后端不可用时整站白屏），但绝不让 mock 静默伪装
 * 成真数据。真就是真，假要标假。
 */
export interface MockFallbackRecord {
  domain: string;
  reason: string;
  /** epoch ms；调用方负责格式化展示 */
  at: number;
}

const MOCK_FALLBACK_REGISTRY = new Map<string, MockFallbackRecord>();

/** 读取当前所有处于 mock 降级态的域。空数组 = 全部走真实后端。 */
export function getMockFallbackState(): MockFallbackRecord[] {
  return [...MOCK_FALLBACK_REGISTRY.values()];
}

/** 某个域当前是否在吃 mock 兜底。 */
export function isDomainOnMock(domain: string): boolean {
  return MOCK_FALLBACK_REGISTRY.has(domain);
}

/** 真实调用成功后清除该域的降级标记（恢复真数据时调用）。 */
function clearMockFallback(domain: string): void {
  MOCK_FALLBACK_REGISTRY.delete(domain);
}

/**
 * real 失败时自动回退 mock —— 但回退是**可观测**的。
 *
 * 失败包括：
 * - 网络错误 / V1 后端进程不在
 * - V1 返回非 2xx
 * - V1ContractError（V1 schema 漂移到 V2 类型不再适配）
 *
 * 成功 → 清除该域降级标记；失败 → 登记到 MOCK_FALLBACK_REGISTRY + console.warn，
 * 然后回退 mock。UI 可通过 getMockFallbackState() / isDomainOnMock() 感知并提示。
 *
 * @param domain  领域标识（tasks/agents/intel/health/forecast/reports/departments）
 */
async function safeReal<T>(
  domain: string,
  fn: () => Promise<T>,
  mockFallback: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    clearMockFallback(domain);
    return result;
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'V1ContractError'
        ? `V1 契约不一致: ${err.message}`
        : err instanceof Error
          ? `真实后端失败: ${err.message}`
          : '真实后端失败: 未知错误';
    MOCK_FALLBACK_REGISTRY.set(domain, { domain, reason, at: Date.now() });
    console.warn(`[api:mock-fallback] domain=${domain} 回退假数据 — ${reason}`, err);
    return mockFallback();
  }
}

/* ==========================================================================
   Tasks
   ========================================================================== */

export const tasksApi = {
  async list(filter?: TaskFilter): Promise<Task[]> {
    if (ENDPOINT_MODE.tasks === 'real') {
      const params = new URLSearchParams();
      if (filter?.limit) params.set('limit', String(filter.limit));
      if (filter?.status?.[0]) params.set('status', filter.status[0]);
      const rawList = await bffEnvelopeRequest<unknown[]>(
        `/api/court/backend/tasks${params.size ? `?${params.toString()}` : ''}`,
      );
      const { valid, invalid } = partitionValidTasks(rawList);
      if (invalid.length > 0) {
        console.warn(
          `[api] tasks.list dropped ${invalid.length}/${rawList.length} backend records due to contract violations`,
          invalid.slice(0, 3),
        );
      }
      return backfillRetrospectives(valid.map(adaptV1Task));
    }
    await delay(MOCK_LATENCY_MS);
    let items = [...mockTasks];
    if (filter?.status?.length) items = items.filter((t) => filter.status!.includes(t.status));
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      items = items.filter((t) => t.title.toLowerCase().includes(q));
    }
    return backfillRetrospectives(items);
  },

  async getById(id: string): Promise<Task> {
    const ARCHIVED = ['archived', 'reviewed', 'report_ready'] as const;
    const withSynth = (t: Task): Task => {
      if (t.retrospective) return t;
      if (!ARCHIVED.includes(t.status as (typeof ARCHIVED)[number])) return t;
      return { ...t, retrospective: synthesizeRetrospective(t) };
    };
    if (ENDPOINT_MODE.tasks === 'real') {
      const full = await bffRequest<ReturnType<typeof adaptV1FullTask>>(
        `/api/court/backend/tasks/${encodeURIComponent(id)}`,
      );
      return withSynth(full.task);
    }
    await delay(MOCK_LATENCY_MS);
    const task = mockTasks.find((t) => t.id === id);
    if (!task) throw new ApiError(`Task ${id} not found`, 404);
    return withSynth(task);
  },

  async getCurrent(): Promise<Task | null> {
    if (ENDPOINT_MODE.tasks === 'real') {
      const tasks = await tasksApi.list({ limit: 1 });
      return tasks[0] ?? null;
    }
    await delay(MOCK_LATENCY_MS / 2);
    return mockTasks[0] ?? null;
  },

  async create(dto: CreateTaskDto): Promise<Task> {
    if (ENDPOINT_MODE.tasks === 'real') {
      const dispatch = await bffEnvelopeRequest<{
        taskId: string;
        status: string;
        acceptedAt: string;
        streamUrl: string;
      }>('/api/court/backend/command/dispatch', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      const full = await tasksApi.getFullTask(dispatch.taskId);
      return full.task;
    }
    await delay(MOCK_LATENCY_MS);
    return createMockTask(dto);
  },

  async getPendingReviews(): Promise<Task[]> {
    if (ENDPOINT_MODE.tasks === 'real') {
      return tasksApi.list({ status: ['report_ready'] });
    }
    await delay(MOCK_LATENCY_MS);
    return mockTasks.filter((t) => t.status === 'report_ready');
  },

  async getFullTask(id: string) {
    if (ENDPOINT_MODE.tasks === 'real') {
      return bffRequest<ReturnType<typeof adaptV1FullTask>>(
        `/api/court/backend/tasks/${encodeURIComponent(id)}`,
      );
    }
    const task = mockTasks.find((t) => t.id === id);
    if (!task) throw new ApiError(`Task ${id} not found`, 404);
    const runs = mockAgentRuns.filter((r) => r.taskId === id);
    return { task, runs, report: null };
  },
};

/* ==========================================================================
   Agents
   ========================================================================== */

export const agentsApi = {
  async listMeta(): Promise<AgentMeta[]> {
    await delay(100);
    return mockAgentMetaList;
  },

  async getStatusMatrix(): Promise<AgentRun[]> {
    if (ENDPOINT_MODE.agents === 'real') {
      return safeReal(
        'agents',
        async () => {
          const tasks = await v1Request<Array<Parameters<typeof adaptV1Task>[0]>>('/tasks');
          const recent = tasks[0];
          if (!recent) return mockAgentRuns;
          const nodeRuns = await v1Request<ApiV1NodeRun[]>(`/swarm-nodes/task/${recent.id}/runs`);
          if (nodeRuns.length > 0) return adaptV1NodeRuns(nodeRuns);
          const full = await v1Request<Parameters<typeof adaptV1FullTask>[0]>(`/tasks/${recent.id}`);
          if (!full.departmentRuns || full.departmentRuns.length === 0) return mockAgentRuns;
          return adaptV1DepartmentRuns(full.departmentRuns);
        },
        async () => mockAgentRuns,
      );
    }
    await delay(MOCK_LATENCY_MS / 2);
    return mockAgentRuns;
  },
};

/* ==========================================================================
   Intel
   ========================================================================== */

export const intelApi = {
  async getSignals(filter?: IntelFilter): Promise<IntelSignal[]> {
    if (ENDPOINT_MODE.intel === 'real') {
      return safeReal(
        'intel',
        async () => {
          const params = new URLSearchParams({ limit: '30' });
          if (filter?.categories?.length && filter.categories[0]) params.set('domain', filter.categories[0]);
          const res = await authedFetch(`/api/court/intel?${params}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`intel bff ${res.status}`);
          const payload = await res.json() as { success: boolean; data: IntelSignal[] };
          if (!payload.success) throw new Error('intel bff failed');
          let items = payload.data;
          if (filter?.levels?.length) items = items.filter((s) => filter.levels!.includes(s.level as never));
          return items;
        },
        async () => {
          let items = [...mockIntelSignals];
          if (filter?.categories?.length) items = items.filter((s) => filter.categories!.includes(s.category));
          if (filter?.levels?.length) items = items.filter((s) => filter.levels!.includes(s.level));
          return items;
        },
      );
    }
    await delay(MOCK_LATENCY_MS);
    let items = [...mockIntelSignals];
    if (filter?.categories?.length) items = items.filter((s) => filter.categories!.includes(s.category));
    if (filter?.levels?.length) items = items.filter((s) => filter.levels!.includes(s.level));
    return items;
  },
  async getTopSignals(count: number): Promise<IntelSignal[]> {
    const all = await intelApi.getSignals();
    return all.slice(0, count);
  },
};

/* ==========================================================================
   Health
   ========================================================================== */

export const healthApi = {
  /**
   * 获取健康档案。
   * 优先级：/api/court/taiyi/dashboard（Turso → 上游 → mock 三层降级）
   */
  async getProfile(): Promise<HealthProfile> {
    return safeReal(
      'health',
      async () => {
        const res = await authedFetch('/api/court/taiyi/dashboard', { cache: 'no-store' });
        if (!res.ok) throw new Error(`taiyi/dashboard bff ${res.status}`);
        const payload = (await res.json()) as {
          success: boolean;
          data: { profile: HealthProfile } | null;
        };
        if (!payload.success || !payload.data) throw new Error('taiyi/dashboard returned no data');
        return payload.data.profile;
      },
      async () => mockHealthProfile,
    );
  },
};

/* ==========================================================================
   Forecast
   ========================================================================== */

export const forecastApi = {
  async getAllScenarios(): Promise<ForecastScenario[]> {
    if (ENDPOINT_MODE.forecast === 'real') {
      return safeReal(
        'forecast',
        async () => {
          const res = await authedFetch('/api/court/forecast?limit=10', { cache: 'no-store' });
          if (!res.ok) throw new Error(`forecast bff ${res.status}`);
          const payload = await res.json() as { success: boolean; data: ForecastScenario[] };
          if (!payload.success) throw new Error('forecast bff failed');
          return payload.data;
        },
        async () => mockForecastScenarios,
      );
    }
    await delay(MOCK_LATENCY_MS);
    return mockForecastScenarios;
  },
};

/* ==========================================================================
   Reports
   ========================================================================== */

export const reportsApi = {
  async list(): Promise<Report[]> {
    if (ENDPOINT_MODE.reports === 'real') {
      return safeReal(
        'reports',
        async () => {
          const rawTasks = await v1Request<Array<Parameters<typeof adaptV1FullTask>[0]>>('/tasks');
          const result: Report[] = [];
          for (const raw of rawTasks) {
            if (raw.report) result.push(adaptV1Report(raw.report, raw.title));
          }
          return [...result, ...mockReports];
        },
        async () => mockReports,
      );
    }
    await delay(MOCK_LATENCY_MS);
    return mockReports;
  },

  async getById(id: string): Promise<Report> {
    if (ENDPOINT_MODE.reports === 'real') {
      return safeReal(
        'reports',
        async () => {
          const all = await reportsApi.list();
          const r = all.find((x) => x.id === id);
          if (!r) throw new ApiError(`Report ${id} not found`, 404);
          return r;
        },
        async () => {
          const r = mockReports.find((x) => x.id === id);
          if (!r) throw new ApiError(`Report ${id} not found`, 404);
          return r;
        },
      );
    }
    await delay(MOCK_LATENCY_MS);
    const r = mockReports.find((x) => x.id === id);
    if (!r) throw new ApiError(`Report ${id} not found`, 404);
    return r;
  },

  async generate(_template: ReportTemplate, _taskId?: string): Promise<Report> {
    await delay(MOCK_LATENCY_MS * 2);
    return mockReports[0]!;
  },
};

/* ==========================================================================
   System API —— 对接 V1 /api/health 获取系统/LLM/DB 状态
   ========================================================================== */

export interface SystemStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: 'connected' | 'disconnected';
    llm: {
      provider: 'mock' | 'openai';
      configured: boolean;
    };
  };
  stats: {
    totalTasks: number;
    archivedTasks: number;
  };
  uptime: number;
}

export const systemApi = {
  async getStatus(): Promise<SystemStatus> {
    if (USE_REAL) {
      try {
        // A NestJS /health uses Terminus shape: { status, info: { database: { status: 'up' } } }
        // Adapt to B's SystemStatus shape.
        const raw = await v1Request<{
          status?: string;
          info?: Record<string, { status?: string }>;
          services?: SystemStatus['services'];
        }>('/health');
        if (raw.services) return raw as SystemStatus;
        const dbUp = raw.info?.database?.status === 'up';
        return {
          status: dbUp ? 'ok' : 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            database: dbUp ? 'connected' : 'disconnected',
            llm: { provider: 'mock', configured: false },
          },
          stats: { totalTasks: 0, archivedTasks: 0 },
          uptime: 0,
        };
      } catch {
        // fallback
      }
    }
    // mock
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        llm: { provider: 'mock', configured: false },
      },
      stats: { totalTasks: 0, archivedTasks: 0 },
      uptime: 0,
    };
  },
};

/* ==========================================================================
   Department Runtime API —— 对接 V1 /api/department-runtime/stats
   ========================================================================== */

export interface DepartmentRuntimeStat {
  code: string;
  name: string;
  description: string;
  stats: {
    totalRuns: number;
    completedRuns: number;
    fallbackRuns: number;
    runningRuns: number;
    successRate: number;
  };
  recent: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    status: string;
    summary: string;
    confidence: number | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

export const departmentRuntimeApi = {
  async getAllStats(): Promise<DepartmentRuntimeStat[]> {
    if (ENDPOINT_MODE.departments === 'real') {
      return safeReal(
        'departments',
        async () => v1Request<DepartmentRuntimeStat[]>('/department-runtime/stats'),
        async () => mockDepartmentStats(),
      );
    }
    await delay(MOCK_LATENCY_MS);
    return mockDepartmentStats();
  },

  async getStatByCode(code: string): Promise<DepartmentRuntimeStat | null> {
    const all = await departmentRuntimeApi.getAllStats();
    return all.find((s) => s.code === code) ?? null;
  },
};

/** mock 版本：从 mockAgentRuns 派生 */
function mockDepartmentStats(): DepartmentRuntimeStat[] {
  const byCode = new Map<string, typeof mockAgentRuns>();
  for (const run of mockAgentRuns) {
    const arr = byCode.get(run.agentCode) ?? [];
    arr.push(run);
    byCode.set(run.agentCode, arr);
  }

  return Array.from(byCode.entries()).map(([code, runs]) => {
    const completed = runs.filter((r) => r.state === 'completed').length;
    const fallback = runs.filter((r) => r.state === 'fallback_completed').length;
    const running = runs.filter((r) => r.state === 'running').length;
    return {
      code,
      name: code,
      description: '',
      stats: {
        totalRuns: runs.length,
        completedRuns: completed,
        fallbackRuns: fallback,
        runningRuns: running,
        successRate: runs.length > 0 ? Math.round((completed / runs.length) * 100) : 0,
      },
      recent: runs.slice(0, 5).map((r) => ({
        id: r.id,
        taskId: r.taskId,
        taskTitle: r.currentTaskTitle ?? '',
        status: r.state,
        summary: r.latestSummary ?? '',
        confidence: r.confidence ?? null,
        startedAt: r.startedAt ?? null,
        completedAt: r.completedAt ?? null,
      })),
    };
  });
}

/* ==========================================================================
   Barrel
   ========================================================================== */

export const api = {
  tasks: tasksApi,
  agents: agentsApi,
  departments: departmentRuntimeApi,
  intel: intelApi,
  health: healthApi,
  forecast: forecastApi,
  reports: reportsApi,
  system: systemApi,
};
