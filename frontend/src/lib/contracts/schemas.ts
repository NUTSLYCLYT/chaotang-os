/**
 * 朝堂 OS · Zod 校验 Schema
 *
 * 与同目录 agent.ts / task.ts / swarm.ts / judgement.ts / events.ts / async-state.ts
 * 的 TypeScript 类型一一对应，提供 runtime 校验能力。
 *
 * 目标位置：apps/web/lib/contracts/schemas.ts
 *
 * 安装依赖（迁移时执行）：
 *   pnpm add zod
 *
 * 使用方式：
 *   import { ZSwarmUnit } from '@/lib/contracts/schemas';
 *   const result = ZSwarmUnit.safeParse(rawJson);
 *   if (!result.success) console.error(result.error);
 */

import { z } from 'zod';

/* ==========================================================================
   Agent
   ========================================================================== */

export const ZAgentCode = z.enum([
  'prime_minister',
  'scribe',
  'li_bu',
  'hu_bu',
  'li_bu_rites',
  'bing_bu',
  'xing_bu',
  'gong_bu',
  'qin_tian_jian',
  'jin_yi_wei',
  'tai_yi_yuan',
]);

export const ZAgentTier = z.enum(['core', 'ministry', 'special_bureau']);

// 收件箱待裁项(五源聚合 feed 契约)。origin 复用 11 部门码 + chancellor。
export const ZInboxOrigin = z.enum([...ZAgentCode.options, 'chancellor']);
export const ZInboxCitation = z.object({ source: z.string(), snippet: z.string() });
export const ZInboxItem = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  tag: z.string(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  origin: ZInboxOrigin,
  source: z.enum(['turso', 'primary', 'signal', 'ledger']),
  suggestedCommand: z.string().optional(),
  citations: z.array(ZInboxCitation).optional(),
  recommendedMinisters: z.array(z.string()).optional(),
  loopTraceId: z.string().optional(),
});

export const ZAgentState = z.enum([
  'idle',
  'assigned',
  'running',
  'waiting_dependency',
  'summarizing',
  'completed',
  'failed',
  'fallback_completed',
  'archived',
]);

export const ZRiskLevel = z.enum(['low', 'medium', 'high', 'critical']);

export const ZAgentMeta = z.object({
  code: ZAgentCode,
  nameCn: z.string(),
  nameEn: z.string(),
  tier: ZAgentTier,
  description: z.string(),
  emoji: z.string(),
  color: z.string(),
  responsibilities: z.array(z.string()),
  capabilities: z.array(z.string()),
  skills: z.array(z.string()),
  inputTypes: z.array(z.string()),
  outputTypes: z.array(z.string()),
  dataSources: z.array(z.string()),
  escalationTargets: z.array(ZAgentCode),
  fallbackStrategy: z.string(),
  typicalTasks: z.array(z.string()),
  confidenceBaseline: z.number().min(0).max(1),
  realDataConnected: z.boolean().optional(),
});

export const ZAgentRun = z.object({
  id: z.string(),
  taskId: z.string(),
  subtaskId: z.string(),
  agentCode: ZAgentCode,
  assignedNodeId: z.string().optional(),
  routingNodeIds: z.array(z.string()).optional(),
  nodeType: z.string().optional(),
  nodeMaturity: z.string().optional(),
  state: ZAgentState,
  progressPct: z.number().min(0).max(100),
  currentTaskTitle: z.string().optional(),
  latestSummary: z.string().optional(),
  riskLevel: ZRiskLevel.optional(),
  isWaitingDependency: z.boolean(),
  hasReported: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

/* ==========================================================================
   Task
   ========================================================================== */

export const ZTaskStatus = z.enum([
  'draft',
  'submitted',
  'interpreting',
  'planning',
  'assigned',
  'running',
  'aggregating',
  'report_ready',
  'reviewed',
  'archived',
  'failed',
]);

export const ZExecutionMode = z.enum(['scripted', 'hybrid', 'live']);

export const ZTaskType = z.enum([
  'strategy',
  'analysis',
  'execution',
  'creative',
  'compliance',
  'forecast',
  'intel',
  'health',
  'general',
]);

export const ZAggregationStrategy = z.enum(['merge', 'weighted_merge', 'sequential']);

export const ZTaskRetrospective = z.object({
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  successes: z.array(z.string()),
  failures: z.array(z.string()),
  lessons: z.array(z.string()),
  playbook: z.string().optional(),
  authoredBy: z.string().optional(),
  authoredAt: z.string(),
  synthetic: z.boolean().optional(),
});

export const ZTaskPlan = z.object({
  id: z.string(),
  taskId: z.string(),
  intent: z.string(),
  taskType: ZTaskType,
  assignedAgents: z.array(ZAgentCode),
  assignedNodeIds: z.array(z.string()).optional(),
  executionNodeIds: z.array(z.string()).optional(),
  governanceNodeIds: z.array(z.string()).optional(),
  runtimeNodeIds: z.array(z.string()).optional(),
  humanNodeIds: z.array(z.string()).optional(),
  dependencyGraph: z.record(z.string(), z.array(z.string())),
  aggregationStrategy: ZAggregationStrategy,
  escalationFlags: z.array(z.string()),
  clarificationNeeded: z.boolean(),
  createdAt: z.string(),
});

export const ZSubtask = z.object({
  id: z.string(),
  taskId: z.string(),
  description: z.string(),
  assignedAgent: ZAgentCode,
  dependsOn: z.array(z.string()),
  priority: z.number(),
  progressPct: z.number().min(0).max(100),
});

export const ZTask = z.object({
  id: z.string(),
  title: z.string(),
  rawCommand: z.string(),
  description: z.string().optional(),
  status: ZTaskStatus,
  mode: ZExecutionMode,
  createdAt: z.string(),
  updatedAt: z.string(),
  ownerUserId: z.string().optional(),
  plan: ZTaskPlan.optional(),
  subtasks: z.array(ZSubtask).optional(),
  finalReportId: z.string().optional(),
  retrospective: ZTaskRetrospective.optional(),
});

/* ==========================================================================
   Swarm
   ========================================================================== */

export const ZSwarmStatus = z.enum(['offline', 'normal', 'busy', 'blocked', 'warning', 'done']);
export const ZSwarmPriority = z.enum(['P0', 'P1', 'P2']);

export const ZSwarmUnit = z.object({
  id: z.string(),
  name: z.string(),
  status: ZSwarmStatus,
  priority: ZSwarmPriority,
  currentTaskTitle: z.string().nullable().optional(),
  currentTaskId: z.string().nullable().optional(),
  needsAttention: z.boolean(),
  progressOverview: z.string().nullable().optional(),
  riskSummary: z.string().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  missingInput: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ZSwarmOverview = z.object({
  total: z.number(),
  online: z.number(),
  busy: z.number(),
  blocked: z.number(),
  warning: z.number(),
  completedToday: z.number(),
  needsAttention: z.number(),
});

export const ZAgentMemberStatus = z.enum(['idle', 'running', 'blocked', 'done']);

export const ZSwarmMember = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  status: ZAgentMemberStatus,
  swarmId: z.string(),
  recentSummary: z.string().nullable().optional(),
  isBlocked: z.boolean(),
  hasReturnedResult: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ZSwarmOutput = z.object({
  summary: z.string().nullable().optional(),
  keyFindings: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  pendingConfirmations: z.array(z.string()).optional(),
  executableNextSteps: z.array(z.string()).optional(),
});

export const ZSwarmOutputArchive = ZSwarmOutput.extend({
  id: z.string(),
  swarmId: z.string(),
  swarmName: z.string().optional(),
  swarmStatus: ZSwarmStatus.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ZInteractionType = z.enum(['instruction', 'followup', 'material', 'result-update']);

export const ZInteraction = z.object({
  id: z.string(),
  swarmId: z.string(),
  actor: z.string(),
  type: ZInteractionType,
  content: z.string(),
  timestamp: z.string(),
});

export const ZDeptStatus = z.object({
  id: z.string(),
  name: z.string(),
  status: ZSwarmStatus,
  priority: ZSwarmPriority,
  currentTaskTitle: z.string().nullable().optional(),
  needsAttention: z.boolean(),
  progressOverview: z.string().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  isBlocked: z.boolean().optional(),
  neededInput: z.string().nullable().optional(),
});

/* ==========================================================================
   Judgement
   ========================================================================== */

export const ZGlobalStatusTag = z.enum(['normal', 'warning', 'critical', 'done']);

export const ZJudgementItem = z.object({
  label: z.string(),
  object: z.string(),
  actionHref: z.string(),
});

export const ZJudgement = z.object({
  id: z.string(),
  firstPriority: z.string(),
  systemJudgement: z.string(),
  globalStatusTag: ZGlobalStatusTag,
  judgementItems: z.array(ZJudgementItem).optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

/* ==========================================================================
   WebSocket Events
   ========================================================================== */

export const ZSwarmStatusUpdateEvent = z.object({
  swarmId: z.string(),
  status: ZSwarmStatus,
  timestamp: z.string(),
});

export const ZSwarmOutputUpdateEvent = z.object({
  swarmId: z.string(),
  output: z.union([ZSwarmOutput, z.record(z.string(), z.unknown())]),
  timestamp: z.string(),
});

export const ZSwarmOverviewUpdateEvent = z.object({
  overview: ZSwarmOverview,
  timestamp: z.string(),
});

export const ZCommandCallbackEvent = z.object({
  commandId: z.string(),
  result: z.unknown(),
  timestamp: z.string(),
});

export const ZAgentStatusUpdateEvent = z.object({
  agentId: z.string(),
  swarmId: z.string(),
  status: ZAgentMemberStatus,
  timestamp: z.string(),
});

/* ==========================================================================
   API Envelope（A 后端统一响应格式）
   ========================================================================== */

export const ZApiEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    code: z.number(),
    message: z.string(),
    data,
  });
