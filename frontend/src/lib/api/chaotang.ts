import type { DecreeDraft, DispatchBody, DispatchResult } from '@/lib/contracts/decree';
import type { MemorialBrief, MemorialDetail, ReviewAction, ReviewActionType } from '@/lib/contracts/memorial';
import type { ManorGroupDef, ManorOverview, Opportunity, SupplyItem, Advice, ManorProjectsData, PolicyFundsData, QuickCommandResult, GroupSubagents, ManorMinistryMetricsMap } from '@/lib/contracts/manor';
import type { DeptOverview } from '@/lib/contracts/dept';
import type { SwarmRosterEntry } from '@/lib/contracts/swarm';
import type { LegalOverview } from '@/lib/contracts/xingbu';
import type { CourtSessionLatest } from '@/lib/contracts/court-session';
import { backendFetch, backendRuntimeUrl } from '@/lib/backend-api';
import {
  adaptCanonicalCourtStreamEvent,
} from '@/lib/api/adapters/chaotang-canonical-stream';

const BASE = '/api/chaotang';

async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const { getToken } = await import('@/lib/auth');
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function get<T>(path: string): Promise<T> {
  const res = await backendFetch(`${BASE}${path}`, { headers: await authHeaders(), cache: 'no-store' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? `GET ${path} failed`);
  return json.data as T;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await backendFetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? `POST ${path} failed`);
  return json.data as T;
}

/** Per-minister live status returned by aggregate_ministers (additive fields safe to be undefined) */
export interface MinisterStatus {
  id: string;
  agentCode: string;
  name: string;
  role: string;
  department: string;
  status: string;
  pendingCount?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  lastAction?: string | null;
  lastRunId?: string | null;
  currentTaskTitle?: string | null;
  latestSummary?: string | null;
}

export interface ThroneOverview {
  ministers: MinisterStatus[]; pulse: Record<string, number>;
  memorialsToday: MemorialBrief[]; risks: Record<string, unknown>[];
  systemStatus: Record<string, string>; generatedAt: string;
}
export interface BriefingEvent { dept: string; agentCode: string; title: string; tag: string; priority: string; at: string }
export interface BriefingDecision { memorialId: string; dept: string; title: string; summary: string; priority: string; urgent: boolean }
export interface BriefingRec { icon?: string; title: string; detail: string; actionHref: string }
export interface BriefingTask { taskId: string; title: string; status: string; progressPct: number }
export interface StudyBriefing {
  dailyReport: Record<string, number>; importantEvents: BriefingEvent[];
  pendingDecisions: BriefingDecision[]; recommendations: BriefingRec[];
  recentMemorials: MemorialBrief[]; recentTasks: BriefingTask[];
}

export interface StudyEdictDepartment {
  dept: string;
  name: string;
  opinion: string;
  confidence: number;
  status: string;
  run_id: string;
}
export interface StudyEdictEvidence {
  label: string;
  value: string | number;
  source: string;
}
export interface StudyEdictNextAction {
  type: 'approve' | 'request_evidence' | 'ask_oracle' | 'archive' | 'dispatch' | string;
  label: string;
  target: string;
  owner: string;
}
/** live-only swarm 运行适配器（dry_run 响应不含）—— 形状见 src/lib/contracts/study-edict.ts ZStudyRunAdapter */
export interface StudyRunAdapter {
  name: string;
  session_id: string;
  entry_swarm: string;
  status: string;
  run_count: number;
  completed_count: number;
  replay_artifact: {
    kind: string;
    session_id: string;
    path: string;
    api_path: string;
    owner: string;
  };
}
/** zod SoT（E2E fixture 与真实后端契约共同校验）：src/lib/contracts/study-edict.ts —— ZStudyEdict / ZStudyEnvelope */
/** 异见的"凭何"——可点开的最强盲点出处。 */
export interface StudyEdictDissentIssue {
  field: string;
  problem: string;
  suggestion: string;
  severity: string;
  source_agent: string;
  run_id: string;
}

/** 圣旨异见(体验会审第一超预期动作):蜂群替陛下发现的单条最强盲点。null = 全员一致。 */
export interface StudyEdictDissent {
  headline: string;
  failed_checks: string[];
  top_issue: StudyEdictDissentIssue | null;
}

export interface StudyEdict {
  run_id: string;
  source_mode: 'LIVE' | 'MIXED' | 'FALLBACK' | 'DEMO' | 'LIVE_SWARM' | string;
  title: string;
  verdict: '准奏' | '需补证' | '需人工复核' | '驳回' | string;
  summary: string;
  departments: StudyEdictDepartment[];
  evidence: StudyEdictEvidence[];
  risks: string[];
  next_actions: StudyEdictNextAction[];
  quality_gate: {
    status: 'passed' | 'needs_review' | 'blocked' | string;
    score: number;
    reasons: string[];
    human_signoff_required: boolean;
  };
  created_at: string;
  run_adapter?: StudyRunAdapter;
  /** live 蜂群异见;null/缺省 = 无异见(全员一致)。 */
  dissent?: StudyEdictDissent | null;
}

export interface LaunchLoopCase {
  case_id: string;
  schemaVersion: 'launch_loop_case.v1' | string;
  source: 'shangshufang' | string;
  sourceId: string;
  title: string;
  command: string;
  owner: string;
  targetDept: string;
  evidenceIds: string[];
  evidence: StudyEdictEvidence[];
  taskId: string | null;
  runId: string;
  decisionId: string | null;
  status: 'draft' | 'evidence_ready' | 'swarm_running' | 'decision_ready' | 'archived' | 'learning_applied' | string;
  sourceMode: StudyEdict['source_mode'];
  qualityGate: {
    status: string;
    score: number;
    reasons: string[];
    humanSignoffRequired: boolean;
  };
  nextAction: {
    type: string;
    label: string;
    target: string;
    owner: string;
  };
  archive: {
    owner: string;
    store: string;
    replayApiPath: string;
    retrospectiveApiPath: string;
    artifactPath: string | null;
  };
  learning: {
    owner: string;
    target: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LaunchLoopGate {
  passed: boolean;
  reasons: string[];
  case_id: string;
}

export interface LaunchLoopArchive {
  archivePath: string;
  case_id: string;
}

export interface StudyRunResult {
  edict: StudyEdict;
  launchLoopCase?: LaunchLoopCase;
  launchLoopGate?: LaunchLoopGate;
  launchLoopArchive?: LaunchLoopArchive;
}

export interface DecreeProceedResult {
  proceeded: boolean;
  taskId: string;
}

/** 群臣会审(/api/court/orchestrate)返回结构 —— 直返 {ok,...},不走 /chaotang BFF 封套 */
export interface OrchestrateContribution {
  dept: string;
  name: string;
  answer: string;
  confidence: number;
  grounded: boolean;
  groundingRate: number;
  conflicts: string;
}
export interface OrchestrateConflict {
  depts: string[]; // applyPriors 后历史偏好方排首位(默认高亮)
  detail: string;
  prior?: { lead: string | null; leadCount: number; total: number }; // 老板历史偏好(只读建议)
}
export interface OrchestrateMerge {
  verdict: string;
  escalateToBoss: boolean;
  grounded: boolean;
  leadDept: string | null;
  contributors: OrchestrateContribution[];
  conflicts: OrchestrateConflict[];
}
export interface PrimePromptGuidance {
  shouldGuide: boolean;
  trigger: 'none' | 'too_short' | 'vague' | 'brain_fog' | 'all_in' | 'release' | 'high_risk';
  contextBasis: string[];
  gaps: string[];
  suggestedPrompt: string | null;
}
export interface OrchestrateResult {
  ok: boolean;
  command: string;
  taskId?: string;
  decisionId: number | null;
  called: string[];
  promptGuidance?: PrimePromptGuidance;
  /** /orchestrate(关键词路由)有;/orchestrate/all(全蜂群,无路由)无 */
  route?: { departments: string[]; source: string; matched: Record<string, string[]> };
  /** 全蜂群密旨专属:哪些司应奏 / 缺席(测所有蜂群看覆盖)。覆盖率以"真司"计:
   *  种子缺席(kind:'seed')是结构性的不算残缺;真司缺席(http/down)才算。 */
  coverage?: {
    responded: string[];
    absent: { dept: string; status: number; kind: 'seed' | 'http' | 'down' }[];
    realExpected: number;
    realResponded: number;
  };
  secret?: boolean;
  jiqunSwarm?: {
    ok: boolean;
    status: number;
    taskId: string | null;
    sessionId: string | null;
    entrySwarm: string | null;
    streamUrl?: string | null;
    message: string | null;
    error?: string;
  };
  merge: OrchestrateMerge;
}

export const chaotang = {
  throneOverview: () => get<ThroneOverview>('/throne/overview'),
  studyBriefing: () => get<StudyBriefing>('/study/briefing'),
  manorGroups: () => get<ManorGroupDef[]>('/manor/groups'),
  systemStatus: () => get<Record<string, string>>('/system/status'),
  // ⚠️ 守门(2026-06-08 对齐审计):真实 live 蜂群约 51s，但 BFF 代理硬超时 20s
  //（src/app/api/court/chaotang/[...path]/route.ts:34，刻意保留为 fail-fast tripwire）。
  // 故 mode:'live' 经此同步代理必 502。当前全仓仅 dry_run 调用(ShangshufangPage)。
  // 若未来要做 live「深度参审」：必须走 async（先拿 session_id，再用已存在的
  // /api/chaotang/stream/{task_id} SSE 推进度 / 轮询 replay artifact），不要直接同步调 live。
  studyRun: (command: string, mode: 'dry_run' | 'live' = 'dry_run', taskId?: string) =>
    post<StudyRunResult>('/study/run', { command, mode, taskId }),
  launchLoopCases: (limit = 50) =>
    get<{ count: number; cases: LaunchLoopCase[]; latest: LaunchLoopCase | null }>(
      `/launch-loop/cases?limit=${encodeURIComponent(String(limit))}`,
    ),
  decreeDraft: (rawCommand: string) => post<DecreeDraft>('/decree/draft', { rawCommand }),
  decreeDispatch: (b: DispatchBody) => post<DispatchResult>('/decree/dispatch', b),
  decreeProceed: (taskId: string) =>
    post<DecreeProceedResult>(`/decree/${encodeURIComponent(taskId)}/proceed`, {}),
  tasks: () => get<Record<string, unknown>[]>('/tasks'),
  taskDetail: (id: string) => get<Record<string, unknown>>(`/tasks/${encodeURIComponent(id)}`),
  memorials: () => get<MemorialBrief[]>('/memorials'),
  memorialDetail: (id: string) => get<MemorialDetail>(`/memorials/${encodeURIComponent(id)}`),
  review: (id: string, action: ReviewActionType, comment: string) =>
    post<ReviewAction>(`/memorials/${encodeURIComponent(id)}/review`, { action, comment }),
  archive: () => get<{ memorials: MemorialBrief[]; decisions: ReviewAction[] }>('/archive'),
  retrospective: (taskId: string) => get<Record<string, unknown>>(`/archive/${encodeURIComponent(taskId)}/retrospective`),
  saveRetrospective: (taskId: string, body: Record<string, unknown>) =>
    post<Record<string, unknown>>(`/archive/${encodeURIComponent(taskId)}/retrospective`, body),

  // ---- 庄园经营地图(新增,走 BFF /api/court/chaotang/...) ----
  manorOverview: () => get<ManorOverview>('/manor/overview'),
  manorOpportunities: () => get<Opportunity[]>('/manor/opportunities'),
  manorSupplyChain: () => get<SupplyItem[]>('/manor/supply-chain'),
  manorAiAdvice: () => get<Advice[]>('/manor/ai-advice'),

  // ---- 部门详情(新增) ----
  deptOverview: (code: string) => get<DeptOverview>(`/dept/${encodeURIComponent(code)}/overview`),

  // ---- 史馆知识沉淀(T-be7 / CL-2 / P1-4) ----
  /** P1-4: 取史馆已沉淀知识条目数 */
  knowledgeCount: () => get<{ count: number }>('/archive/knowledge/count'),
  /** CL-2: 触发批量反哺丞相(幂等) */
  feedbackToKnowledge: () =>
    post<{ processed: number; succeeded: number; totalKnowledgeCount: number }>(
      '/archive/knowledge/feedback',
      {},
    ),

  // ---- P0-2: 项目经营盘 ----
  manorProjects: () => get<ManorProjectsData>('/manor/projects'),

  // ---- P0-3: 政策/资金池 ----
  manorPolicyFunds: () => get<PolicyFundsData>('/manor/policy-funds'),

  // ---- P0-1: 快捷下旨 ----
  quickCommand: (rawCommand: string) =>
    post<QuickCommandResult>('/study/quick-command', { rawCommand }),

  // ---- 群臣会审(蜂群):确定性路由→并行召部门 live agent→确定性 merge。
  //      直连 /api/court/orchestrate(返回 {ok,merge,...}),不经 /chaotang BFF 封套。----
  orchestrate: async (command: string): Promise<OrchestrateResult> => {
    const res = await backendFetch('/api/court/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ command }),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<OrchestrateResult> & {
      error?: string;
    };
    if (!res.ok || !json.ok) throw new Error(json.error ?? '丞相会审失败,请重试');
    return json as OrchestrateResult;
  },

  // orchestrateAll()(POST /api/court/orchestrate/all)已随"统一决策任务生命
  // 周期"阶段2移除——密旨现在并入 draft-edict/confirm-edict 真实管线(见
  // shangshufangDraftEdict/shangshufangConfirmEdict)，不再调用这个命中后端
  // 兼容占位端点(court_compat.py::orchestrate_all)的独立入口。见
  // /home/ubuntu/.claude/plans/valiant-crunching-candy.md。

  // ---- Bezos 判断飞轮闭环:陛下对一次群臣会审的最终圣裁(准/驳),焊入哈希链 + 累积偏好。
  //      chosenDept 须为 prime-minister 部门代号(hu_bu/bing_bu...);需管理员身份。----
  signOff: async (
    decisionId: number,
    action: 'signed' | 'rejected' | 'edited',
    chosenDept?: string | null,
    note?: string,
  ): Promise<{ ok: true; outcomeHash?: string }> => {
    const res = await backendFetch('/api/court/orchestrate/sign-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ decisionId, action, chosenDept: chosenDept ?? undefined, note }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; outcomeHash?: string; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error ?? '御批回写失败');
    return { ok: true, outcomeHash: json.outcomeHash };
  },

  // ---- P1-3: 一键召集 ----
  quickSummon: (mode: string, topic?: string) =>
    post<{ mode: string; modeLabel: string; ministers: string[]; groups: string[]; suggestedCommand: string }>(
      '/throne/quick-summon', { mode, topic: topic || '' }),

  // ---- P1-1: 史馆搜索 ----
  archiveSearch: (query: string) =>
    get<{ results: Record<string, unknown>[]; query: string; total: number }>(
      `/archive/search?q=${encodeURIComponent(query)}`),

  // ---- D19: 蜂群集群 subagent（功能组真实实例）----
  groupSubagents: (groupId: string) =>
    get<GroupSubagents>(`/manor/groups/${encodeURIComponent(groupId)}/subagents`),

  // ---- 蜂群聚集地全名册（GET /api/court/swarm/roster → 后端 :8081/api/swarm/roster）。
  //      后端已 join 全 21 蜂群 + 最近 run 状态/质量分/标题;前端只渲染,不在前端 join。
  //      走专用 BFF 路由(不经 /chaotang 封套,因后端路径在 /api/swarm/* 而非 /api/chaotang/*)。----
  swarmRoster: async (): Promise<SwarmRosterEntry[]> => {
    const res = await backendFetch('/api/court/swarm/roster', {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: SwarmRosterEntry[];
      error?: string;
    };
    if (!res.ok || !json.success) throw new Error(json.error ?? '蜂群名册读取失败');
    return json.data ?? [];
  },

  // ---- 刑部司法实况（GET /api/court/legal/overview → 后端 :8081/api/legal/overview）。
  //      后端 join 出真实天和合同案件 + 合规项 + 汇总({success,data:LegalOverview});
  //      BFF 不可达/非法时退本地 fallback,保证不白屏。走专用 BFF(不经 /chaotang 封套)。----
  legalOverview: async (): Promise<LegalOverview> => {
    const res = await backendFetch('/api/court/legal/overview', {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: LegalOverview;
      error?: string;
    };
    if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? '刑部司法实况读取失败');
    return json.data;
  },

  // ---- 今日朝报 · 每日朝会自转（GET /api/court/court-session/latest → 后端 :8081/api/court-session/latest）。
  //      后端每日自转：八部 grounded 上奏 → 御史核真库 → 军机处矛盾 → 可信度章({success,data:CourtSessionLatest})；
  //      BFF 不可达/非法时退 available:false 空态，保证不白屏。走专用 BFF(不经 /chaotang 封套)。----
  courtSession: async (): Promise<CourtSessionLatest> => {
    const res = await backendFetch('/api/court/court-session/latest', {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: CourtSessionLatest;
      error?: string;
    };
    if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? '今日朝报读取失败');
    return json.data;
  },

  // ---- 庄园六部指标（Turso manor_metrics 表，直接走 BFF，不经 jiqun）----
  manorMinistryMetrics: async (): Promise<ManorMinistryMetricsMap> => {
    const res = await backendFetch('/api/court/zhuangyuan/ministry-metrics', {
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      success: boolean;
      data: ManorMinistryMetricsMap;
      error?: string;
    };
    if (!json.success) throw new Error(json.error ?? 'manor-metrics failed');
    return json.data;
  },
};

/** SSE:订阅军机处作战流。返回取消函数。fetch+ReadableStream(可带 auth)。 */
export function subscribeCourtStream(
  taskId: string,
  onEvent: (ev: Record<string, unknown>) => void,
  onError?: (e: unknown) => void,
): () => void {
  const ac = new AbortController();
  (async () => {
    try {
      const res = await fetch(backendRuntimeUrl(`${BASE}/stream/${encodeURIComponent(taskId)}`),
        { headers: { Accept: 'text/event-stream', ...(await authHeaders()) }, signal: ac.signal });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data:')) {
              try {
                const event = adaptCanonicalCourtStreamEvent(
                  JSON.parse(line.slice(5).trim()),
                );
                if (event) onEvent(event);
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') onError?.(e);
    }
  })();
  return () => ac.abort();
}
