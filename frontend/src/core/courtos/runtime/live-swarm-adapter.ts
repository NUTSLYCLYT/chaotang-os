import type { SourceLabel } from '../types.ts';
import { assertLiveSwarmTrace } from '../source-label.ts';
import type { CourtSwarmTraceV1, CourtSwarmRuntimeStatus } from './swarm-runtime.ts';
import type { EvidenceBoundSwarmRun } from './evidence-bound-swarm-run.ts';

export type CourtLiveAdapterId = 'jiqun' | 'openclaw' | 'hermes' | 'legal_agent';
export type CourtLiveAdapterState = 'ready' | 'disabled' | 'down' | 'not_configured';

export interface CourtLiveAdapterCapability {
  adapter_id: CourtLiveAdapterId;
  state: CourtLiveAdapterState;
  endpoint?: string;
  supports_dispatch: boolean;
  supports_status: boolean;
  supports_trace: boolean;
  user_visible_summary: string;
  missing_capabilities: string[];
}

export interface CourtLiveAdapterGateResult {
  adapter_id: CourtLiveAdapterId;
  can_dispatch: boolean;
  missing_capabilities: string[];
  user_visible_summary: string;
}

export interface CourtLiveAdapterDispatchInput {
  task_id: string;
  loop_trace_id?: string;
  original_question: string;
  selected_departments: string[];
  swarm_bundles: string[];
  source_label: SourceLabel;
  user_id?: string;
  entry_swarm?: string;
  evidence_bound_run?: EvidenceBoundSwarmRun;
}

export interface CourtLiveAdapterDispatchResult {
  adapter_id: CourtLiveAdapterId;
  ok: boolean;
  external_task_id?: string;
  external_session_id?: string;
  trace_id?: string;
  status: CourtSwarmRuntimeStatus;
  findings: string[];
  missing_capabilities: string[];
  user_visible_summary: string;
  source_label: SourceLabel;
}

export interface CourtLiveSwarmAdapter {
  id: CourtLiveAdapterId;
  capability(): Promise<CourtLiveAdapterCapability>;
  dispatch(input: CourtLiveAdapterDispatchInput): Promise<CourtLiveAdapterDispatchResult>;
}

function downgradeNonLiveSwarm(input: SourceLabel): SourceLabel {
  if (input === 'DEMO') return 'DEMO';
  if (input === 'FALLBACK') return 'FALLBACK';
  return 'MIXED';
}

export function gateLiveAdapterCapability(capability: CourtLiveAdapterCapability): CourtLiveAdapterGateResult {
  const missing = [...capability.missing_capabilities];
  if (capability.state !== 'ready') missing.push(`adapter_${capability.state}`);
  if (!capability.supports_dispatch) missing.push('live_dispatch_not_supported');
  if (!capability.supports_trace) missing.push('live_trace_not_supported');

  const uniqueMissing = [...new Set(missing)];
  const canDispatch = capability.state === 'ready' &&
    capability.supports_dispatch &&
    capability.supports_trace &&
    uniqueMissing.length === 0;

  return {
    adapter_id: capability.adapter_id,
    can_dispatch: canDispatch,
    missing_capabilities: uniqueMissing,
    user_visible_summary: canDispatch
      ? capability.user_visible_summary
      : `${capability.user_visible_summary}；不能进入 LIVE_SWARM。`,
  };
}

export function normalizeLiveAdapterTrace(params: {
  input: CourtLiveAdapterDispatchInput;
  result: CourtLiveAdapterDispatchResult;
}): CourtSwarmTraceV1 {
  const { input, result } = params;
  // 尊重 adapter 已定的 source_label:adapter 已做兑现核验(reverify),若它已降级(非 LIVE_SWARM),
  // normalize 绝不能凭 ok+trace_id 又升回 LIVE_SWARM(否则 reverify 承重墙形同虚设)。
  if (result.ok && result.trace_id && result.source_label === 'LIVE_SWARM') {
    assertLiveSwarmTrace('LIVE_SWARM', result.trace_id);
    return {
      schema_version: 'SwarmTraceV1',
      task_id: input.task_id,
      trace_id: result.trace_id,
      mode: 'live_adapter',
      status: 'completed',
      requested_bundles: input.swarm_bundles,
      departments: input.selected_departments,
      findings: result.findings,
      missing_capabilities: [],
      user_visible_summary: result.user_visible_summary,
      source_label: 'LIVE_SWARM',
    };
  }

  const missing = [
    ...result.missing_capabilities,
    ...(result.ok ? ['real_swarm_trace_id_missing'] : []),
  ];
  return {
    schema_version: 'SwarmTraceV1',
    task_id: input.task_id,
    mode: 'local_placeholder',
    status: result.status === 'completed' ? 'blocked' : result.status,
    requested_bundles: input.swarm_bundles,
    departments: input.selected_departments,
    findings: result.findings.length > 0
      ? result.findings
      : ['外部 live adapter 未产出可采信 trace，不能作为真实蜂群证据。'],
    missing_capabilities: [...new Set(missing)],
    user_visible_summary: `${result.user_visible_summary}；不得标记 LIVE_SWARM，不得作为最终确定性结论。`,
    source_label: downgradeNonLiveSwarm(input.source_label),
  };
}

export function createDisabledLiveSwarmAdapter(
  adapterId: CourtLiveAdapterId,
  reason: string,
): CourtLiveSwarmAdapter {
  const capability: CourtLiveAdapterCapability = {
    adapter_id: adapterId,
    state: 'disabled',
    supports_dispatch: false,
    supports_status: false,
    supports_trace: false,
    user_visible_summary: reason,
    missing_capabilities: ['live_adapter_disabled'],
  };
  return {
    id: adapterId,
    async capability() {
      return capability;
    },
    async dispatch(input) {
      return {
        adapter_id: adapterId,
        ok: false,
        status: 'skipped_no_live_adapter',
        findings: [`${adapterId} adapter 已禁用：${reason}`],
        missing_capabilities: ['live_adapter_disabled'],
        user_visible_summary: reason,
        source_label: downgradeNonLiveSwarm(input.source_label),
      };
    },
  };
}

export function createStaticLiveSwarmAdapter(params: {
  adapter_id: CourtLiveAdapterId;
  capability?: Partial<CourtLiveAdapterCapability>;
  result: Omit<CourtLiveAdapterDispatchResult, 'adapter_id'>;
}): CourtLiveSwarmAdapter {
  const capability: CourtLiveAdapterCapability = {
    adapter_id: params.adapter_id,
    state: 'ready',
    supports_dispatch: true,
    supports_status: true,
    supports_trace: true,
    user_visible_summary: `${params.adapter_id} adapter ready`,
    missing_capabilities: [],
    ...params.capability,
  };
  return {
    id: params.adapter_id,
    async capability() {
      return capability;
    },
    async dispatch() {
      return { adapter_id: params.adapter_id, ...params.result };
    },
  };
}
