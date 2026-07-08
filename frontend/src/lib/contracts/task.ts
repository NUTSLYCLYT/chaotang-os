/**
 * 朝堂 OS · Task 数据契约（Tier 1）
 *
 * 来源：court-console/apps/web-v2/src/types/task.ts
 * 目标位置：apps/web/lib/contracts/task.ts
 *
 * 11 状态固定流转（含 failed 终态），冻结 Tier 1（领域实体）。
 * 修改需通知 Command Center / Overview Page Agent。
 *
 * A 后端当前 gap：A 现有 5 状态（pending/in-progress/blocked/awaiting-decision/done），
 * 需要 phase 5 数据迁移把旧 enum 映射到 11 态体系：
 *   pending          → submitted
 *   in-progress      → running
 *   blocked          → waiting_dependency
 *   awaiting-decision → report_ready
 *   done             → archived
 */

import type { AgentCode } from './agent';

/** 任务生命周期状态 —— 11 状态固定流转（含 failed 终态） */
export type TaskStatus =
  | 'draft'
  | 'submitted'
  | 'interpreting'
  | 'planning'
  | 'assigned'
  | 'running'
  | 'aggregating'
  | 'report_ready'
  | 'reviewed'
  | 'archived'
  | 'failed';

/** 执行模式 */
export type ExecutionMode = 'scripted' | 'hybrid' | 'live';

/** 任务类型（丞相研判结果） */
export type TaskType =
  | 'strategy'
  | 'analysis'
  | 'execution'
  | 'creative'
  | 'compliance'
  | 'forecast'
  | 'intel'
  | 'health'
  | 'general';

/** 聚合策略 */
export type AggregationStrategy = 'merge' | 'weighted_merge' | 'sequential';

/* ==========================================================================
   Task 主对象
   ========================================================================== */

export interface Task {
  id: string;
  title: string;
  rawCommand: string;
  description?: string;
  status: TaskStatus;
  mode: ExecutionMode;
  createdAt: string;
  updatedAt: string;
  ownerUserId?: string;

  /** 丞相编排后产生 */
  plan?: TaskPlan;
  /** 执行期间产生 */
  subtasks?: Subtask[];
  /** 最终呈报 id */
  finalReportId?: string;
  /** 归档后的结构化复盘（可选，旧任务可无） */
  retrospective?: TaskRetrospective;
  /** 后端任务结果原文。用于透传 CourtOS 统一 Loop、奏折、source_label 等结构化结果。 */
  result?: Record<string, unknown>;
}

/* ==========================================================================
   Retrospective · 复盘（史馆核心数据）
   ========================================================================== */

/**
 * 任务归档后的结构化复盘数据。
 *
 * 设计原则：
 * - 全部字段可选或有默认，向后兼容旧归档任务
 * - lessons 字段作为 success_template 的种子数据
 */
export interface TaskRetrospective {
  /** 任务总体评分 1-5 */
  score: 1 | 2 | 3 | 4 | 5;
  /** 成功因素 */
  successes: string[];
  /** 失败因素 / 需要改进 */
  failures: string[];
  /** 可复用经验（沉淀为成功模板的种子） */
  lessons: string[];
  /** 下次类似任务的 playbook 摘要 */
  playbook?: string;
  /** 复盘作者 */
  authoredBy?: string;
  /** 复盘时间 ISO8601 */
  authoredAt: string;
  /**
   * 是否为合成数据（adapter 层基于任务属性合成的占位复盘）。
   * UI 应在 synthetic=true 时显示"演示数据"标识。
   */
  synthetic?: boolean;
}

/* ==========================================================================
   Task Plan · 编排计划
   ========================================================================== */

export interface TaskPlan {
  id: string;
  taskId: string;
  intent: string;
  taskType: TaskType;
  assignedAgents: AgentCode[];
  assignedNodeIds?: string[];
  executionNodeIds?: string[];
  governanceNodeIds?: string[];
  runtimeNodeIds?: string[];
  humanNodeIds?: string[];
  dependencyGraph: Record<string, string[]>;
  aggregationStrategy: AggregationStrategy;
  escalationFlags: string[];
  clarificationNeeded: boolean;
  createdAt: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  description: string;
  assignedAgent: AgentCode;
  dependsOn: string[];
  priority: number;
  progressPct: number;
}

/* ==========================================================================
   Review · 批示
   ========================================================================== */

export type ReviewActionType = 'approve' | 'reject' | 'inquire';

export interface ReviewAction {
  id: string;
  taskId: string;
  action: ReviewActionType;
  comment: string;
  reviewerName?: string;
  createdAt: string;
}

/* ==========================================================================
   Create DTO + Filter
   ========================================================================== */

export interface CreateTaskDto {
  rawCommand: string;
  title?: string;
  description?: string;
  mode?: ExecutionMode;
  targetAgents?: AgentCode[];
}

export interface TaskFilter {
  status?: TaskStatus[];
  mode?: ExecutionMode[];
  limit?: number;
  offset?: number;
  search?: string;
}

/* ==========================================================================
   状态机映射（Phase 5 数据迁移用）
   ========================================================================== */

/** A 旧 5 态 → B 11 态映射
 *
 * 注：A 的 blocked 是 task 卡在依赖未就绪。B 的 11 态中没有专门的 blocked
 * （waiting_dependency 是 AgentState 不是 TaskStatus）。任务本身仍是 running，
 * 依赖图侧由 AgentRun.isWaitingDependency 标记。
 */
export const LEGACY_TASK_STATUS_MAP: Record<string, TaskStatus> = {
  pending: 'submitted',
  'in-progress': 'running',
  blocked: 'running',
  'awaiting-decision': 'report_ready',
  done: 'archived',
};

/** 状态可达图（哪些状态可以转到哪些状态，用于前端 PATCH 校验） */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ['submitted', 'failed'],
  submitted: ['interpreting', 'failed'],
  interpreting: ['planning', 'failed'],
  planning: ['assigned', 'failed'],
  assigned: ['running', 'failed'],
  running: ['aggregating', 'failed'],
  aggregating: ['report_ready', 'failed'],
  report_ready: ['reviewed', 'failed'],
  reviewed: ['archived', 'failed'],
  archived: [],
  failed: [],
};
