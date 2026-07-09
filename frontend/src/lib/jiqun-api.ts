/**
 * jiqun_ai Flask backend client.
 * Frontend-owned BFF routes are retired. Browser requests go through the
 * transparent Next proxy at /api/*; server-side requests may still use the
 * backend absolute URL.
 */

import {
  backendFetch,
  backendRuntimeUrl,
} from '@/lib/backend-api';

/**
 * jiqun 后端开启 FENGQUN_AUTH 时只认 `Authorization: Bearer` 或 cookie `token`，
 * 而浏览器登录态只有 `courtos.access_token` cookie —— 通配 rewrite 不做转换，
 * 不带 Bearer 头的直连请求会全部 401（2026-06-11 实测：/swarm/sessions 轮询常年 401，
 * 蜂群会话永远回不到丞相栏）。这里统一从客户端会话取 token 拼 Bearer。
 */
async function jiqunAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const { getToken } = await import('@/lib/auth');
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function fetchLocalCourtApi(path: string, init: RequestInit = {}): Promise<Response> {
  const first = await backendFetch(path, init);
  if (first.status !== 401 || typeof window === 'undefined') return first;

  const { refreshAccessToken } = await import('@/lib/auth');
  const refreshed = await refreshAccessToken();
  if (!refreshed) return first;
  return fetch(backendRuntimeUrl(path), {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${refreshed}`,
    },
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store',
  });
}

export async function jiqunFetcher<T>(path: string): Promise<T> {
  const res = await fetch(backendRuntimeUrl(`/api${path}`), { headers: await jiqunAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

export async function jiqunPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(backendRuntimeUrl(`/api${path}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await jiqunAuthHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

interface JiqunEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
  message?: string | null;
}

function unwrapJiqunEnvelope<T>(envelope: JiqunEnvelope<T>, action: string): T {
  if (!envelope.success) throw new Error(envelope.message || envelope.error || `${action}失败`);
  return envelope.data;
}

async function throwLocalApiError(res: Response, action: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: string | null; message?: string | null } | null;
  if (res.status === 401 || body?.error === 'login_required') {
    throw new Error(`请先登录，再${action}。`);
  }
  if (res.status === 404 || body?.error === 'task_not_found') {
    throw new Error('任务不存在或不属于当前用户。');
  }
  throw new Error(body?.message || body?.error || `${res.status} ${res.statusText} — ${action}`);
}

/** Jiqun status → StatusPillButton SwarmStatus */
export function toSwarmStatus(status: string): string {
  switch (status) {
    case 'running': return 'running';
    case 'completed': return 'done';
    case 'failed': return 'blocked';
    case 'pass': return 'normal';
    case 'fail': return 'blocked';
    case 'partial': return 'warning';
    default: return 'idle';
  }
}

// ─── ShangShuFang Decision Loop ──────────────────────────────────────────────

export type ShangshufangSourceLabel = 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'FALLBACK' | 'DEMO';

export interface ShangshufangDraftEdict {
  schema_version?: 'DraftEdictV1';
  task_id?: string;
  original_question: string;
  refined_edict: string;
  decision_type: string;
  known_facts: string[];
  unknown_gaps: string[];
  suggested_perspectives: string[];
  recommended_departments: string[];
  risk_flags: string[];
  expected_output: string[];
  expected_memorial_format: string[];
  emperor_confirmation_question: string;
  source_label: ShangshufangSourceLabel;
}

export interface ShangshufangEvalResult {
  suite: string;
  passed: boolean;
  score: number;
  failed: string[];
}

export interface ShangshufangDraftResponse {
  task_id: string;
  loop_trace_id?: string;
  status: 'awaiting_emperor_confirm' | string;
  draft_edict: ShangshufangDraftEdict;
  eval_result: ShangshufangEvalResult;
  trace_id: string;
  archive_hints?: Array<{
    id: string;
    original_question: string;
    verdict?: string;
    source_label?: string;
    created_at: string;
    reusable_lessons: string[];
    retrospectiveStatus?: string;
  }>;
}

export interface ShangshufangTaskDecisionResult {
  task_id: string;
  loop_trace_id?: string;
  status: string;
  decision_id: string;
  archive_record?: {
    archive_id?: string;
    task_id?: string;
    created_at?: string;
    source_label?: ShangshufangSourceLabel | string;
    [key: string]: unknown;
  } | null;
  evomap_event?: unknown;
}

export interface ShangshufangAttachmentMeta {
  id?: string;
  name: string;
  size: number;
  type: string;
  last_modified?: number;
  knowledge_id?: string;
  source?: 'ima_knowledge' | string;
  content_excerpt?: string;
}

export interface ShangshufangRoutingPlan {
  schema_version?: 'ReviewPlanV1';
  task_id?: string;
  ministry_candidates: string[];
  selected_departments?: string[];
  selection_reasons?: Record<string, string>;
  review_depth?: 'shallow' | 'standard' | 'deep' | 'live_swarm';
  complexity_score?: number;
  complexity_reasons?: string[];
  swarm_required?: boolean;
  swarm_trace_required?: boolean;
  swarm_bundles?: string[];
  swarm_runtime_status?: 'skipped_not_required' | 'skipped_no_live_adapter' | 'completed' | 'blocked';
  swarm_missing_capabilities?: string[];
  swarm_trace_summary?: {
    schema_version: 'SwarmTraceV1';
    task_id: string;
    trace_id?: string;
    mode: 'not_required' | 'local_placeholder' | 'live_adapter';
    status: 'skipped_not_required' | 'skipped_no_live_adapter' | 'completed' | 'blocked';
    requested_bundles: string[];
    departments: string[];
    findings: string[];
    missing_capabilities: string[];
    user_visible_summary: string;
    source_label: ShangshufangSourceLabel;
  };
  swarm_plan: Array<{ department: string; focus: string; status: string }>;
  route_reason: string;
  source_label: ShangshufangSourceLabel;
}

export interface ShangshufangReviewMemorial {
  schema_version?: 'MemorialV1';
  task_id?: string;
  sacred_judgement?: '采纳' | '补证' | '复核' | '驳回' | '追问';
  executive_summary?: string;
  department_memorials?: Array<{
    schema_version: 'DepartmentOpinionV1';
    task_id: string;
    department_id: string;
    signal: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
    verdict: 'APPROVE' | 'NEED_EVIDENCE' | 'RECHECK' | 'REJECT';
    summary: string;
    evidence: Array<{
      schema_version: 'EvidenceItemV1';
      id: string;
      label: string;
      summary: string;
      reliability?: 'high' | 'medium' | 'low' | 'unknown';
      source_label: ShangshufangSourceLabel;
    }>;
    missing_evidence: string[];
    risks: string[];
    next_order: string;
    human_confirmation_required: boolean;
    source_label: ShangshufangSourceLabel;
  }>;
  evidence_chain?: Array<{
    schema_version: 'EvidenceItemV1';
    id: string;
    label: string;
    summary: string;
    reliability?: 'high' | 'medium' | 'low' | 'unknown';
    source_label: ShangshufangSourceLabel;
  }>;
  missing_evidence?: string[];
  risk_register?: string[];
  next_order?: string;
  review_depth?: 'shallow' | 'standard' | 'deep';
  complexity_score?: number;
  complexity_reasons?: string[];
  swarm_trace_summary?: ShangshufangRoutingPlan['swarm_trace_summary'];
  swarm_trace_id?: string;
  human_confirmation_required?: boolean;
  title: string;
  verdict: string;
  summary: string;
  draft_edict?: ShangshufangDraftEdict;
  ministry_outputs: Array<{
    department: string;
    focus: string;
    opinion: string;
    status: string;
    source_label: ShangshufangSourceLabel;
  }>;
  conflict_summary: Array<{
    type: string;
    summary: string;
    departments: string[];
    source_label: ShangshufangSourceLabel;
  }>;
  evidence_gaps: string[];
  risk_flags: string[];
  decision_options: Array<{
    action: 'request_evidence' | 'archive' | 'reject' | string;
    label: string;
    reason: string;
    enabled: boolean;
  }>;
  next_best_action: 'request_evidence' | 'archive' | string;
  source_label: ShangshufangSourceLabel;
  quality_gate: {
    schema_version?: 'QualityGateResultV1';
    task_id?: string;
    passed?: boolean;
    blocking_issues?: string[];
    warnings?: string[];
    gate_results?: Array<{ id: string; passed: boolean; message?: string }>;
    human_confirmation_required?: boolean;
    status: string;
    reasons: string[];
    human_signoff_required: boolean;
    source_label?: ShangshufangSourceLabel;
  };
  swarm_run_id?: string;
  swarm_brief_for_junjichu?: {
    executive_summary: string;
    department_sections: unknown[];
    evidence_chain: unknown[];
    risk_register: unknown[];
    missing_evidence: string[];
    conflict_summary: Array<{ summary?: string } | string>;
    recommended_next_action: string;
    questions_for_emperor: string[];
    source_label: ShangshufangSourceLabel;
  };
  swarm_quality_result?: {
    passed: boolean;
    blocking_reasons: string[];
    warnings: string[];
  };
}

export interface ShangshufangConfirmResponse {
  task_id: string;
  loop_trace_id?: string;
  status: 'awaiting_decision' | 'reviewing' | string;
  message: string;
  review_id: string;
  routing_plan: ShangshufangRoutingPlan;
  memorial: ShangshufangReviewMemorial;
  unified_loop?: {
    loop_id: string;
    task_id: string;
    loop_trace_id: string;
    source_label: ShangshufangSourceLabel;
    selected_departments: string[];
    states: string[];
  };
  review_status_url: string;
}

export interface ShangshufangSwarmDeepenResponse {
  task_id: string;
  loop_trace_id?: string;
  status: string;
  source_label: ShangshufangSourceLabel;
  adapter_result: {
    adapter_id: 'jiqun' | 'openclaw' | 'hermes' | 'legal_agent';
    ok: boolean;
    external_task_id?: string;
    external_session_id?: string;
    trace_id?: string;
    status: string;
    findings: string[];
    missing_capabilities: string[];
    user_visible_summary: string;
    source_label: ShangshufangSourceLabel;
  };
  swarm_trace_summary: NonNullable<ShangshufangRoutingPlan['swarm_trace_summary']>;
  memorial: ShangshufangReviewMemorial;
  routing_plan: ShangshufangRoutingPlan;
}

export interface ShangshufangPackSwarmLoopResponse {
  schema_version: 'PackSwarmLoopV1';
  task_id: string;
  loop_trace_id?: string;
  mode: 'order' | 'secret';
  command: string;
  entry_swarm: 'pack_rd';
  source_label: ShangshufangSourceLabel;
  departments: Array<{ id: string; label: string; role: string }>;
  collection_checklist: string[];
  data_schema: string[];
  scoring_rubric: string[];
  validation_methods: string[];
  evidence_bound_run: {
    schema_version: 'EvidenceBoundSwarmRunV1';
    entry_swarm: string;
    task_input: string;
    intelligence_pack_id: string;
    intelligence_pack: {
      schema_version: string;
      packId: string;
      sourceLabel: ShangshufangSourceLabel;
      sourceUrls?: string[];
      facts: string[];
      missingEvidence: string[];
      qualityGates: string[];
      [key: string]: unknown;
    };
    evidence_refs: string[];
    missing_evidence: string[];
    forbidden_outputs: string[];
    source_label: ShangshufangSourceLabel;
  };
  adapter_result: {
    adapter_id: 'jiqun' | 'openclaw' | 'hermes' | 'legal_agent';
    ok: boolean;
    external_task_id?: string;
    external_session_id?: string;
    trace_id?: string;
    status: string;
    findings: string[];
    missing_capabilities: string[];
    user_visible_summary: string;
    source_label: ShangshufangSourceLabel;
  };
  swarm_trace_summary: NonNullable<ShangshufangRoutingPlan['swarm_trace_summary']>;
  human_intervention_required: boolean;
  hubu_budget_project?: {
    id: string;
    title: string;
    status: string;
    requested_budget: string;
    estimated_roi: string;
    priority: string;
    risk_level: string;
  };
  final_recommendation: string;
  timeline: Array<{ stage: string; status: string; summary: string }>;
}

export interface ShangshufangFinanceReportingLoopResponse {
  schemaVersion: 'ShangShuFangFinanceReportingLoopV1';
  mode: 'order' | 'secret';
  command: string;
  stage: 'awaiting_jinyiwei_evidence' | 'report_ready' | string;
  done: boolean;
  sourceLabel: ShangshufangSourceLabel;
  departments: Array<{ id: string; label: string; role: string }>;
  requiredFactPackSections: string[];
  collectionChecklist: string[];
  preview: {
    previewOnly: boolean;
    executionAllowed: boolean;
    sideEffects: string;
    statements: {
      incomeStatement?: Record<string, unknown>;
      balanceSheet?: Record<string, unknown>;
      cashFlowStatement?: Record<string, unknown>;
    };
    bossBrief?: { verdict?: string; riskLevel?: string; oneSentence?: string; keyRisks?: string[]; nextActions?: string[] };
    auditFindings?: Array<{ severity?: string; title?: string; detail?: string }>;
    archiveDraft?: { archiveEligible?: boolean; archiveId?: string; archiveBlockedReasons?: string[] };
    decisionActions?: { primaryAction?: string; allowedActions?: string[]; buttonLabels?: Record<string, string> };
    formattedMemorial?: {
      section_order: string[];
      sections: Record<string, string>;
      text: string;
    };
  } | null;
  formattedMemorial: {
    section_order: string[];
    sections: Record<string, string>;
    text: string;
  };
  nextAction: string;
}

export interface ShangshufangTaskStatusResponse {
  task: {
    task_id: string;
    loop_trace_id?: string;
    status: string;
    raw_question: string;
    draft_edict: ShangshufangDraftEdict | null;
    source_label: ShangshufangSourceLabel;
    risk_flags: string[];
    known_facts: string[];
    unknown_gaps: string[];
    recommended_departments: string[];
    created_at: string;
    updated_at: string;
  };
  review: {
    review_id: string;
    loop_trace_id?: string;
    review_status: string;
    routing_plan: ShangshufangRoutingPlan | Record<string, unknown>;
    ministry_outputs: ShangshufangReviewMemorial['ministry_outputs'];
    conflict_summary: ShangshufangReviewMemorial['conflict_summary'];
    memorial: ShangshufangReviewMemorial | null;
    unified_loop?: {
      loop_id: string;
      task_id: string;
      loop_trace_id: string;
      source_label: ShangshufangSourceLabel;
      selected_departments: string[];
      states: string[];
    } | null;
    created_at: string;
    updated_at: string;
  } | null;
}

export interface ShangshufangDecisionTaskSummary {
  task_id: string;
  loop_trace_id?: string;
  status: string;
  raw_question: string;
  draft_edict: ShangshufangDraftEdict | null;
  source_label: ShangshufangSourceLabel;
  risk_flags: string[];
  known_facts: string[];
  unknown_gaps: string[];
  recommended_departments: string[];
  created_at: string;
  updated_at: string;
}

export interface ShangshufangHomeResponse {
  source_label: ShangshufangSourceLabel;
  today_issue: {
    title: string;
    why_now: string;
    urgency: string;
    recommended_action: string;
    evidence_basis: string[];
    missing_evidence: string[];
  };
  pending_decisions: ShangshufangDecisionTaskSummary[];
  pending_evidence_tasks: ShangshufangDecisionTaskSummary[];
  archive_hints: unknown[];
}

export async function shangshufangDraftEdict(
  rawQuestion: string,
  attachments: ShangshufangAttachmentMeta[] = [],
): Promise<ShangshufangDraftResponse> {
  const res = await fetchLocalCourtApi('/api/court/shangshufang/draft-edict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raw_question: rawQuestion,
      attachments,
      evidence_summary: attachments.length
        ? {
            user_evidence: true,
            attachment_count: attachments.length,
            attachment_names: attachments.map((item) => item.name),
            knowledge_ids: attachments.map((item) => item.knowledge_id).filter(Boolean),
          }
        : undefined,
    }),
  });
  if (!res.ok) await throwLocalApiError(res, '进入上书房下旨');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangDraftResponse>;
  return unwrapJiqunEnvelope(envelope, '丞相拟旨');
}

export async function shangshufangConfirmEdict(
  taskId: string,
  editedEdict: ShangshufangDraftEdict | null = null,
): Promise<ShangshufangConfirmResponse> {
  const res = await fetchLocalCourtApi('/api/court/shangshufang/confirm-edict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      confirmed: true,
      edited_edict: editedEdict,
    }),
  });
  if (!res.ok) await throwLocalApiError(res, '确认拟旨');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangConfirmResponse>;
  return unwrapJiqunEnvelope(envelope, '确认下发军机处');
}

export async function shangshufangTaskStatus(taskId: string): Promise<ShangshufangTaskStatusResponse> {
  const res = await fetchLocalCourtApi(`/api/court/shangshufang/tasks/${encodeURIComponent(taskId)}/status`);
  if (!res.ok) await throwLocalApiError(res, '查看任务状态');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangTaskStatusResponse>;
  return unwrapJiqunEnvelope(envelope, '读取上书房任务状态');
}

export async function shangshufangSwarmDeepen(taskId: string): Promise<ShangshufangSwarmDeepenResponse> {
  const res = await fetchLocalCourtApi(`/api/court/shangshufang/tasks/${encodeURIComponent(taskId)}/swarm-deepen`, { method: 'POST' });
  if (!res.ok) await throwLocalApiError(res, '启动蜂群深挖');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangSwarmDeepenResponse>;
  return unwrapJiqunEnvelope(envelope, '蜂群深挖');
}

export async function shangshufangPackSwarmLoop(
  command: string,
  mode: 'order' | 'secret',
  options: { sourceUrls?: string[] } = {},
): Promise<ShangshufangPackSwarmLoopResponse> {
  const res = await fetchLocalCourtApi('/api/court/shangshufang/pack-swarm-loop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      mode,
      source_urls: options.sourceUrls ?? [],
    }),
  });
  if (!res.ok) await throwLocalApiError(res, '启动 PACK 蜂群协同评估');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangPackSwarmLoopResponse>;
  return unwrapJiqunEnvelope(envelope, 'PACK 蜂群协同评估');
}

export async function shangshufangFinanceReportingLoop(
  command: string,
  mode: 'order' | 'secret',
  options: { factPack?: Record<string, unknown> | null } = {},
): Promise<ShangshufangFinanceReportingLoopResponse> {
  const envelope = await jiqunPost<JiqunEnvelope<ShangshufangFinanceReportingLoopResponse>>(
    '/shangshufang/finance-reporting-loop',
    {
      command,
      mode,
      fact_pack: options.factPack ?? null,
    },
  );
  return unwrapJiqunEnvelope(envelope, '户部财务报表');
}

export async function shangshufangHome(): Promise<ShangshufangHomeResponse> {
  const res = await fetchLocalCourtApi('/api/court/shangshufang/home');
  if (!res.ok) await throwLocalApiError(res, '查看上书房');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangHomeResponse>;
  return unwrapJiqunEnvelope(envelope, '读取上书房决策首页');
}

export async function shangshufangTaskDecision(
  taskId: string,
  action: 'adopt' | 'request_evidence' | 'recheck' | 'reject' | 'followup',
  reason: string,
  options: { human_confirmation_note?: string; followup_question?: string } = {},
): Promise<ShangshufangTaskDecisionResult> {
  const res = await fetchLocalCourtApi(
    `/api/court/shangshufang/tasks/${encodeURIComponent(taskId)}/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reason,
        human_confirmation_note: options.human_confirmation_note,
        followup_question: options.followup_question,
      }),
    },
  );
  if (!res.ok) await throwLocalApiError(res, '提交裁决');
  const envelope = (await res.json()) as JiqunEnvelope<ShangshufangTaskDecisionResult>;
  return unwrapJiqunEnvelope(envelope, '皇上裁决');
}

// ─── Swarm Orchestrator ───────────────────────────────────────────────────────

export interface JiqunSwarmDef {
  id: string;
  name: string;
  qa_version?: string;
  config?: string;
}

export interface JiqunBinding {
  enabled: boolean;
  topic: string;
  target_swarm: string;
  min_quality_score?: number;
  transform?: string;
}

export interface JiqunConfig {
  swarms: JiqunSwarmDef[];
  bindings?: JiqunBinding[];
}

export interface JiqunSessionSummary {
  session_id: string;
  task_input: string;
  status: string;
  release_gate?: 'blocked' | 'clear' | string;
  synthetic?: boolean;
  session_type?: string;
  swarm_count: number;
  completed_count: number;
  start_time: string;
  end_time?: string;
  duration?: string;
}

export interface JiqunSwarmRun {
  swarm_id: string;
  run_id: string;
  status: string;
  quality_score?: number | null;
  qa_result?: Record<string, unknown> | null;
  final_output?: unknown;
  triggered_by: string;
  task_input?: string;
  error?: string;
}

export interface JiqunGraphNode {
  id: string;
  swarm_id: string;
  run_id: string;
  status: string;
  quality_score?: number | null;
  triggered_by: string;
  error?: string;
}

export interface JiqunGraphEdge {
  source: string;
  target: string;
  topic: string;
}

export interface JiqunEvent {
  event_id: string;
  topic: string;
  [key: string]: unknown;
}

export interface JiqunSessionDetail extends JiqunSessionSummary {
  swarm_runs: JiqunSwarmRun[];
  graph: { nodes: JiqunGraphNode[]; edges: JiqunGraphEdge[] };
  events: JiqunEvent[];
  finance_intel_loop?: Record<string, unknown> | null;
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export interface RunMeta {
  run_id: string;
  task_input: string;
  flow_name: string;
  created_at: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  run_status: string;
  run_type: string;
  grade?: string;
  total_score?: number;
  issues_count: number;
  step_count: number;
  has_final_output: boolean;
  total_tokens?: number;
}

export interface AsyncRunResponse {
  task_id: string;
  status: string;
}

export interface QualityScore {
  total_score?: number;
  grade?: string;
  scores?: Record<string, number>;
  issues?: Array<{ dimension: string; severity: string; field: string; problem: string; suggestion: string }>;
}

export interface StepLog {
  step_index: number;
  step_id: string;
  agent_name: string;
  timestamp: string;
  model: string;
  status: string;
  source: string;
  duration_seconds?: number | null;
  output_length?: number;
  prompt_version?: string;
  quality_score?: QualityScore | null;
}

export interface RunLog {
  run_id: string;
  task_input: string;
  flow_name: string;
  run_status: string;
  run_type: string;
  steps: StepLog[];
  quality_score?: QualityScore | null;
  final_output?: Record<string, string>;
  qa_result?: Record<string, unknown>;
}

// ─── Flows ────────────────────────────────────────────────────────────────────

export interface FlowMeta {
  filename: string;
  flow_name: string;
  steps_count: number;
  default_model: string;
  qa_version: string;
}

export interface FlowStep {
  id: string;
  name: string;
  description?: string;
  prompt_key?: string;
  prompt_inline?: string;
  model?: string;
  step_type?: string;
  /** DAG 依赖：未设则视为顺序（前一步 → 当前步） */
  depends_on?: string[];
  edge_labels?: Record<string, string>;
  visual_back_edges?: Array<{ to: string; label?: string }>;
  output_pattern_repair?: { pattern: string; restart_from_id: string; display_label?: string };
}

export interface FlowConfig {
  flow_name: string;
  default_model: string;
  steps: FlowStep[];
  output_fields?: string[];
  qa_version?: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface DailyRun {
  date: string;
  count: number;
  pass_count: number;
  avg_score?: number | null;
}

export interface AnalyticsSummary {
  total_runs: number;
  pass_rate: number;
  avg_score?: number | null;
  avg_tokens_per_run?: number;
}

export interface FlowStat {
  runs: number;
  pass_rate: number;
  avg_score?: number | null;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  daily_runs: DailyRun[];
  grade_distribution: Record<string, number>;
  dimension_avg?: Record<string, number>;
  flow_stats?: Record<string, FlowStat>;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export interface SwarmAgentRef {
  key: string;
  display_name: string;
}

export interface SwarmGroup {
  id: string;
  name: string;
  agents: SwarmAgentRef[];
}

export interface GroupedPrompts {
  swarms: SwarmGroup[];
  ungrouped: SwarmAgentRef[];
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export interface KnowledgeDataset {
  id: string;
  name: string;
  doc_count?: number;
}

export interface KnowledgeSourceInfo {
  type: string;
  description: string;
  configured: boolean;
  datasets: KnowledgeDataset[];
}

export type KnowledgeSources = Record<string, KnowledgeSourceInfo>;

export interface KnowledgeHealth {
  ok: boolean;
  latency_ms?: number;
  error?: string | null;
}

// ─── AB Tests ─────────────────────────────────────────────────────────────────

export interface AbTestResult {
  id: string;
  task: string;
  config_a: string;
  config_b: string;
  run_id_a?: string;
  run_id_b?: string;
  winner?: 'A' | 'B' | 'tie' | null;
  score_a?: number | null;
  score_b?: number | null;
  grade_a?: string | null;
  grade_b?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  session_id: string;
  config: string;
  created_at: string;
  turn_count: number;
  last_input?: string;
}
