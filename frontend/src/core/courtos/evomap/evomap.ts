import type { SourceLabel } from '../types';
import { loopTraceIdForTask } from '../loop-trace.ts';

export type EvoMapUserAction = 'adopt' | 'reject' | 'request_evidence' | 'request_recheck' | 'follow_up';

export interface EvoMapEventV1 {
  schema_version: 'EvoMapEventV1';
  event_id: string;
  task_id: string;
  loop_trace_id: string;
  loop_id: 'court_unified_decision_loop_v1';
  user_action: EvoMapUserAction;
  learned_preference: string;
  failure_mode?: string;
  recommended_change: string;
  archive_id?: string;
  quality_gate_status?: 'passed' | 'blocked' | 'unknown';
  evidence_gap_count?: number;
  department_ids?: string[];
  swarm_runtime_status?: 'skipped_not_required' | 'skipped_no_live_adapter' | 'completed' | 'blocked' | 'unknown';
  reusable_lessons?: string[];
  auto_apply: false;
  source_label: SourceLabel;
  created_at: string;
}

export interface EvoMapBuildInput {
  taskId: string;
  loopTraceId?: string;
  originalQuestion: string;
  userAction: EvoMapUserAction;
  sourceLabel: SourceLabel;
  createdAt: string;
  archiveId?: string;
  qualityGateStatus?: 'passed' | 'blocked' | 'unknown';
  blockingIssues?: string[];
  missingEvidence?: string[];
  riskRegister?: string[];
  departmentIds?: string[];
  swarmRuntimeStatus?: 'skipped_not_required' | 'skipped_no_live_adapter' | 'completed' | 'blocked' | 'unknown';
  reusableLessons?: string[];
}

function compact(items: Array<string | undefined | null>): string[] {
  return items.filter((item): item is string => Boolean(item?.trim()));
}

function failureMode(input: EvoMapBuildInput): string | undefined {
  if (input.userAction === 'reject') return 'emperor_rejected_memorial';
  if ((input.missingEvidence?.length ?? 0) > 0) return 'missing_evidence';
  if ((input.blockingIssues?.length ?? 0) > 0) return 'quality_gate_blocked';
  if (input.swarmRuntimeStatus === 'skipped_no_live_adapter') return 'missing_live_swarm_trace';
  if ((input.riskRegister?.length ?? 0) > 0 && input.userAction === 'request_recheck') return 'risk_recheck';
  return undefined;
}

function learnedPreference(input: EvoMapBuildInput): string {
  if (input.userAction === 'request_evidence') {
    return `同类问题先补证再裁决：${(input.missingEvidence ?? []).slice(0, 5).join('、') || '证据链'}`;
  }
  if (input.userAction === 'request_recheck') {
    return `同类问题需复核风险与冲突：${(input.riskRegister ?? []).slice(0, 4).join('、') || '风险边界'}`;
  }
  if (input.userAction === 'follow_up') {
    return '用户倾向在当前案卷上下文内追问，后续必须继承原问题、缺证和风险。';
  }
  if (input.userAction === 'reject') {
    return '同类奏折若证据、风险或下一步不足，可能被直接驳回。';
  }
  return input.qualityGateStatus === 'blocked'
    ? '用户采纳的是受质门约束的下一步，不代表采纳最终确定性结论。'
    : '同类问题可复用本案后令、证据结构和责任边界。';
}

function recommendedChange(input: EvoMapBuildInput): string {
  const recommendations = compact([
    (input.missingEvidence?.length ?? 0) > 0
      ? `下次同类问题在拟旨阶段提前索要：${(input.missingEvidence ?? []).slice(0, 6).join('、')}`
      : undefined,
    input.swarmRuntimeStatus === 'skipped_no_live_adapter'
      ? '若要输出 LIVE_SWARM，必须接入真实蜂群 adapter 并记录 trace_id；否则继续透明降级。'
      : undefined,
    (input.blockingIssues?.length ?? 0) > 0
      ? `把质门阻断项加入下次检查清单：${(input.blockingIssues ?? []).slice(0, 4).join('、')}`
      : undefined,
    input.userAction === 'reject' ? '记录驳回原因，并在下一版奏折中优先修复。' : undefined,
    input.userAction === 'follow_up' ? '追问必须继承上下文，不得重新开空白案卷。' : undefined,
  ]);
  return recommendations.join('；') || '保留本案经验为下次同类问题的参考，不自动修改系统或自动裁决。';
}

export function buildEvoMapEventV1(input: EvoMapBuildInput): EvoMapEventV1 {
  const eventId = `evomap_${input.taskId}_${input.createdAt.replace(/[^0-9A-Za-z]/g, '')}`;
  const loopTraceId = input.loopTraceId ?? loopTraceIdForTask(input.taskId);
  return {
    schema_version: 'EvoMapEventV1',
    event_id: eventId,
    task_id: input.taskId,
    loop_trace_id: loopTraceId,
    loop_id: 'court_unified_decision_loop_v1',
    user_action: input.userAction,
    learned_preference: learnedPreference(input),
    failure_mode: failureMode(input),
    recommended_change: recommendedChange(input),
    archive_id: input.archiveId,
    quality_gate_status: input.qualityGateStatus ?? 'unknown',
    evidence_gap_count: input.missingEvidence?.length ?? 0,
    department_ids: input.departmentIds ?? [],
    swarm_runtime_status: input.swarmRuntimeStatus ?? 'unknown',
    reusable_lessons: input.reusableLessons ?? [],
    auto_apply: false,
    source_label: input.sourceLabel,
    created_at: input.createdAt,
  };
}
