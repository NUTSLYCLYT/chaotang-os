import { z } from 'zod';

/**
 * 超级丞相路由核心契约(阶段0·冻结版)，镜像后端
 * backend/src/chancellor/contracts.py。前端只消费，不在本地重新生成同名结构。
 * 见 docs/super-chancellor-routing-implementation-plan-2026-07-10.md 第7节。
 */

export const ZSourceLabel = z.enum(['LIVE', 'MIXED', 'FALLBACK', 'DEMO']);
export const ZRouteMode = z.enum(['direct', 'council']);
export const ZRouteStrategy = z.enum([
  'single_agent',
  'parallel_review',
  'serial_review',
  'evidence_first',
]);
export const ZParticipantRole = z.enum(['primary', 'reviewer', 'evidence_collector']);
export const ZParticipantStatus = z.enum(['planned', 'unavailable']);
export const ZDepartmentAssignmentStatus = z.enum([
  'planned',
  'accepted',
  'executing',
  'reported',
  'blocked',
  'skipped',
]);

export const ZRouteParticipant = z.object({
  department: z.string(),
  agent_id: z.string().nullable(),
  role: ZParticipantRole,
  reason: z.string(),
  required: z.boolean(),
  status: ZParticipantStatus,
});

export const ZRouteDecisionV2 = z.object({
  schema_version: z.literal('RouteDecisionV2'),
  decision_id: z.string(),
  task_id: z.string(),
  mode: ZRouteMode,
  strategy: ZRouteStrategy,
  decided_by: z.literal('chancellor'),
  primary_department: z.string(),
  primary_agent: z.string().nullable(),
  participants: z.array(ZRouteParticipant),
  reason_summary: z.string(),
  complexity_score: z.number().min(0).max(1),
  complexity_reasons: z.array(z.string()),
  risk_flags: z.array(z.string()),
  evidence_gaps: z.array(z.string()),
  assumptions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  policy_hits: z.array(z.string()),
  human_confirmation_required: z.boolean(),
  capability_snapshot_version: z.string(),
  prompt_version: z.string().nullable(),
  source_label: ZSourceLabel,
  created_at: z.string(),
  supersedes_decision_id: z.string().nullable(),
});

export const ZDepartmentAssignment = z.object({
  department: z.string(),
  agent_id: z.string().nullable(),
  status: ZDepartmentAssignmentStatus,
  latest_message: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

export const ZTimelineEvent = z.object({
  event_id: z.string(),
  stage: z.string(),
  actor: z.string(),
  message: z.string(),
  occurred_at: z.string(),
  sequence: z.number(),
});

export const ZDecreeExecutionStatusV1 = z.object({
  schema_version: z.literal('DecreeExecutionStatusV1'),
  task_id: z.string(),
  execution_state: z.enum([
    'queued',
    'running',
    'receipt_only',
    'completed',
    'failed',
    'inconsistent',
  ]),
  execution_quarantined: z.boolean(),
  execution_state_reason: z.string(),
  execution_attempt: z.number().int().positive().nullable(),
  current_stage: z.string(),
  current_owner: z.string(),
  latest_message: z.string(),
  next_stage: z.string().nullable(),
  blocked_reason: z.string().nullable(),
  route_decision: ZRouteDecisionV2,
  departments: z.array(ZDepartmentAssignment),
  timeline: z.array(ZTimelineEvent),
});

export const ZChancellorAdviceOption = z.object({
  id: z.string(),
  title: z.string(),
  benefits: z.array(z.string()),
  risks: z.array(z.string()),
  conditions: z.array(z.string()),
  next_actions: z.array(z.string()),
  evidence_refs: z.array(z.string()),
});

export const ZChancellorAdviceV1 = z.object({
  schema_version: z.literal('ChancellorAdviceV1'),
  task_id: z.string(),
  analysis: z.string(),
  options: z.array(ZChancellorAdviceOption).min(3).max(5),
  recommended_option_id: z.string(),
  recommendation_reason: z.string(),
  dissent: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  human_confirmation_required: z.boolean(),
  source_label: ZSourceLabel,
});

export type RouteParticipant = z.infer<typeof ZRouteParticipant>;
export type RouteDecisionV2 = z.infer<typeof ZRouteDecisionV2>;
export type DepartmentAssignment = z.infer<typeof ZDepartmentAssignment>;
export type TimelineEvent = z.infer<typeof ZTimelineEvent>;
export type DecreeExecutionStatusV1 = z.infer<typeof ZDecreeExecutionStatusV1>;
export type ChancellorAdviceOption = z.infer<typeof ZChancellorAdviceOption>;
export type ChancellorAdviceV1 = z.infer<typeof ZChancellorAdviceV1>;
