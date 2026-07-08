import type { SourceLabel } from '../types.ts';
import { assertLiveSwarmTrace } from '../source-label.ts';
import type { CourtDepartmentRegistryEntry } from '../departments/registry.ts';

export type CourtSwarmRuntimeMode = 'not_required' | 'local_placeholder' | 'live_adapter';
export type CourtSwarmRuntimeStatus =
  | 'skipped_not_required'
  | 'skipped_no_live_adapter'
  | 'completed'
  | 'blocked';
export type CourtSwarmReviewDepth = 'shallow' | 'standard' | 'deep' | 'live_swarm';

export interface CourtSwarmTraceV1 {
  schema_version: 'SwarmTraceV1';
  task_id: string;
  trace_id?: string;
  mode: CourtSwarmRuntimeMode;
  status: CourtSwarmRuntimeStatus;
  requested_bundles: string[];
  departments: string[];
  findings: string[];
  missing_capabilities: string[];
  user_visible_summary: string;
  source_label: SourceLabel;
}

export interface CourtSwarmRuntimeResult {
  swarm_required: boolean;
  swarm_trace_required: boolean;
  swarm_bundles: string[];
  trace: CourtSwarmTraceV1;
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function bundleLabel(bundle: string): string {
  const labels: Record<string, string> = {
    jinyiwei_intelligence_office_v0: '锦衣卫情报深挖',
    hubu_cfo_office_v0: '户部财务与报价深挖',
    bingbu_cro_sales_office_v0: '兵部客户成交路径深挖',
    libu_chro_cao_office_v0: '吏部组织与责任承接深挖',
    xingbu_clo_cco_office_v0: '刑部法务与不可逆风险深挖',
    rites_brand_comms_office_v0: '礼部对外表达深挖',
    gongbu_cto_cpo_delivery_office_v0: '工部交付与供应链深挖',
  };
  return labels[bundle] ?? `${bundle} 深挖`;
}

function downgradedPlaceholderLabel(input: SourceLabel): SourceLabel {
  if (input === 'DEMO') return 'DEMO';
  if (input === 'FALLBACK') return 'FALLBACK';
  return 'MIXED';
}

export function resolveSwarmBundles(params: {
  selectedDepartments: string[];
  registry: CourtDepartmentRegistryEntry[];
}): string[] {
  const selected = new Set(params.selectedDepartments);
  return unique(
    params.registry
      .filter(
        (entry) =>
          entry.enabled &&
          entry.swarm_bundle &&
          (selected.has(entry.id) || selected.has(entry.protocol_id) || selected.has(entry.runtime_id)),
      )
      .map((entry) => entry.swarm_bundle ?? ''),
  );
}

export function runCourtSwarmRuntime(params: {
  taskId: string;
  reviewDepth: CourtSwarmReviewDepth;
  sourceLabel: SourceLabel;
  selectedDepartments: string[];
  registry: CourtDepartmentRegistryEntry[];
  liveTraceId?: string;
}): CourtSwarmRuntimeResult {
  const swarmRequired = params.reviewDepth === 'deep' || params.reviewDepth === 'live_swarm';
  const bundles = resolveSwarmBundles({
    selectedDepartments: params.selectedDepartments,
    registry: params.registry,
  });

  if (!swarmRequired) {
    return {
      swarm_required: false,
      swarm_trace_required: false,
      swarm_bundles: bundles,
      trace: {
        schema_version: 'SwarmTraceV1',
        task_id: params.taskId,
        mode: 'not_required',
        status: 'skipped_not_required',
        requested_bundles: bundles,
        departments: params.selectedDepartments,
        findings: ['当前复杂度未达到蜂群深挖阈值，走部门 registry 常规会审。'],
        missing_capabilities: [],
        user_visible_summary: '本案无需蜂群深挖。',
        source_label: params.sourceLabel,
      },
    };
  }

  if (params.liveTraceId) {
    assertLiveSwarmTrace('LIVE_SWARM', params.liveTraceId);
    return {
      swarm_required: true,
      swarm_trace_required: true,
      swarm_bundles: bundles,
      trace: {
        schema_version: 'SwarmTraceV1',
        task_id: params.taskId,
        trace_id: params.liveTraceId,
        mode: 'live_adapter',
        status: 'completed',
        requested_bundles: bundles,
        departments: params.selectedDepartments,
        findings: bundles.map((bundle) => `${bundleLabel(bundle)}已返回真实 trace。`),
        missing_capabilities: [],
        user_visible_summary: `蜂群深挖已完成，trace_id=${params.liveTraceId}。`,
        source_label: 'LIVE_SWARM',
      },
    };
  }

  return {
    swarm_required: true,
    swarm_trace_required: true,
    swarm_bundles: bundles,
    trace: {
      schema_version: 'SwarmTraceV1',
      task_id: params.taskId,
      mode: 'local_placeholder',
      status: 'skipped_no_live_adapter',
      requested_bundles: bundles,
      departments: params.selectedDepartments,
      findings: bundles.map((bundle) => `${bundleLabel(bundle)}需要真实蜂群适配器后才能作为证据。`),
      missing_capabilities: ['live_swarm_adapter_not_configured', 'real_swarm_trace_id_missing'],
      user_visible_summary: '本案达到蜂群深挖阈值，但本轮未接真实蜂群；不得标记 LIVE_SWARM，不得作为最终确定性结论。',
      source_label: downgradedPlaceholderLabel(params.sourceLabel),
    },
  };
}
