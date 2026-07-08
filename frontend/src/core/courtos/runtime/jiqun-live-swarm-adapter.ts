import type {
  CourtLiveAdapterCapability,
  CourtLiveAdapterDispatchInput,
  CourtLiveAdapterDispatchResult,
  CourtLiveSwarmAdapter,
} from './live-swarm-adapter.ts';
import { reverifyLiveSwarmTrace } from './reverify-swarm-trace.ts';

type FetchLike = typeof fetch;

interface JiqunLiveSwarmAdapterOptions {
  baseUrl?: string;
  adminToken?: string;
  configPath?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

interface JiqunRunResponse {
  ok?: boolean;
  success?: boolean;
  task_id?: string;
  taskId?: string;
  session_id?: string;
  sessionId?: string;
  trace_id?: string;
  traceId?: string;
  message?: string;
  error?: string;
  detail?: string;
  data?: {
    task_id?: string;
    taskId?: string;
    session_id?: string;
    sessionId?: string;
    trace_id?: string;
    traceId?: string;
  };
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? process.env.JIQUN_API_URL ?? process.env.JIQUN_BASE_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function pickTaskId(json: JiqunRunResponse): string | undefined {
  return text(json.task_id) ?? text(json.taskId) ?? text(json.data?.task_id) ?? text(json.data?.taskId);
}

function pickSessionId(json: JiqunRunResponse): string | undefined {
  return text(json.session_id) ?? text(json.sessionId) ?? text(json.data?.session_id) ?? text(json.data?.sessionId);
}

function pickTraceId(json: JiqunRunResponse): string | undefined {
  return text(json.trace_id) ?? text(json.traceId) ?? text(json.data?.trace_id) ?? text(json.data?.traceId);
}

function selectEntrySwarm(question: string): string | null {
  const normalized = question.toLowerCase();
  if (
    normalized.includes('pack') ||
    question.includes('电池') ||
    question.includes('电芯') ||
    question.includes('BMS') ||
    question.includes('模组')
  ) return 'pack_rd';
  if (question.includes('报价') || question.includes('成本核算')) return 'quotation';
  if (question.includes('合同') || question.includes('合规') || question.includes('法律')) return 'legal';
  if (question.includes('财务') || question.includes('预算') || question.includes('现金流')) return 'finance';
  if (question.includes('开发') || question.includes('代码') || question.includes('软件')) return 'sdlc';
  return null;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function authHeaders(adminToken: string | undefined): Record<string, string> {
  return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
}

export function createJiqunLiveSwarmAdapter(options: JiqunLiveSwarmAdapterOptions = {}): CourtLiveSwarmAdapter {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const configPath = options.configPath ?? process.env.JIQUN_SWARM_CONFIG ?? 'config/swarm_orchestrator.yaml';
  const adminToken = options.adminToken ?? process.env.JIQUN_ADMIN_TOKEN;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const fetchImpl = options.fetchImpl ?? fetch;

  const capability: CourtLiveAdapterCapability = {
    adapter_id: 'jiqun',
    state: baseUrl ? 'ready' : 'not_configured',
    endpoint: baseUrl,
    supports_dispatch: true,
    supports_status: true,
    supports_trace: true,
    user_visible_summary: `jiqun live swarm adapter configured for ${baseUrl}`,
    missing_capabilities: baseUrl ? [] : ['jiqun_base_url_missing'],
  };

  return {
    id: 'jiqun',
    async capability() {
      return capability;
    },
    async dispatch(input: CourtLiveAdapterDispatchInput): Promise<CourtLiveAdapterDispatchResult> {
      const entrySwarm = input.entry_swarm ?? selectEntrySwarm(input.original_question);
      const evidenceBoundRun = input.evidence_bound_run;
      try {
        const runRes = await fetchImpl(`${baseUrl}/api/swarm/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // HTTP header 仅允许 ByteString(Latin-1)：task_id 含中文会崩，encode 兜底(根因修 2026-06-29)。
            'X-CourtOS-Task-Id': encodeURIComponent(input.task_id),
            ...authHeaders(adminToken),
          },
          body: JSON.stringify({
            task_input: input.original_question,
            config_path: configPath,
            entry_swarm: entrySwarm,
            courtos_task_id: input.task_id,
            courtos_loop_trace_id: input.loop_trace_id,
            courtos_user_id: input.user_id,
            courtos_departments: input.selected_departments,
            courtos_swarm_bundles: input.swarm_bundles,
            intelligence_pack_id: evidenceBoundRun?.intelligence_pack_id,
            intelligence_pack: evidenceBoundRun?.intelligence_pack,
            evidence_refs: evidenceBoundRun?.evidence_refs ?? [],
            missing_evidence: evidenceBoundRun?.missing_evidence ?? [],
            forbidden_outputs: evidenceBoundRun?.forbidden_outputs ?? [],
            source_label: evidenceBoundRun?.source_label ?? input.source_label,
            evidence_bound_run: evidenceBoundRun,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const runJson = await readJson<JiqunRunResponse>(runRes);
        const upstreamRejected = runJson.success === false || runJson.ok === false;
        const externalTaskId = pickTaskId(runJson);
        const externalSessionId = pickSessionId(runJson);
        const upstreamTraceId = pickTraceId(runJson);
        const message = text(runJson.message);
        const error = text(runJson.error) ?? text(runJson.detail) ?? message;

        if (!runRes.ok || upstreamRejected || !externalSessionId) {
          return {
            adapter_id: 'jiqun',
            ok: false,
            external_task_id: externalTaskId,
            external_session_id: externalSessionId,
            status: 'blocked',
            findings: [error ?? `jiqun /api/swarm/run failed: ${runRes.status}`],
            missing_capabilities: externalSessionId ? [] : ['jiqun_session_id_missing'],
            user_visible_summary: error ?? 'jiqun 未返回可追踪 session_id，不能进入 LIVE_SWARM。',
            source_label: input.source_label === 'FALLBACK' ? 'FALLBACK' : 'MIXED',
          };
        }

        const traceId = upstreamTraceId ?? externalSessionId;
        // 兑现核验承重墙(P4 并入 · 2026-07-01):GET /api/swarm/sessions/{id} 真登记才盖 LIVE_SWARM。
        // 替掉旧 /api/tasks 核验(那是 running 池,libu/finance session 不进 → "真链永远降级"的错端点);
        // 且旧逻辑只拿 session_id 就盖帝金章、不看核验——本改为 fail-closed:未兑现即降 MIXED,不伪造 LIVE。
        const reverify = await reverifyLiveSwarmTrace(traceId, { baseUrl, fetchImpl, adminToken, timeoutMs: Math.min(timeoutMs, 6_000) });

        return {
          adapter_id: 'jiqun',
          ok: true,
          external_task_id: externalTaskId,
          external_session_id: externalSessionId,
          trace_id: traceId,
          status: 'completed',
          findings: [
            `jiqun 已启动 ${entrySwarm ?? 'auto'} 流程，session_id=${externalSessionId}。`,
            reverify.verified
              ? 'jiqun /api/swarm/sessions 已兑现核验该 session(真链)。'
              : `session 兑现待核,暂不盖 LIVE_SWARM:${reverify.reason}`,
          ],
          missing_capabilities: [],
          user_visible_summary: `jiqun live swarm dispatched,trace_id=${traceId}。`,
          // 承重墙:未兑现核验 → 不盖 LIVE_SWARM,诚实降 MIXED(入参本就 FALLBACK 则保持)。
          source_label: reverify.verified ? 'LIVE_SWARM' : input.source_label === 'FALLBACK' ? 'FALLBACK' : 'MIXED',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          adapter_id: 'jiqun',
          ok: false,
          status: 'blocked',
          findings: [`jiqun adapter 调用失败：${message}`],
          missing_capabilities: ['jiqun_dispatch_failed'],
          user_visible_summary: 'jiqun live adapter 不可用，本轮不能进入 LIVE_SWARM。',
          source_label: input.source_label === 'FALLBACK' ? 'FALLBACK' : 'MIXED',
        };
      }
    },
  };
}
