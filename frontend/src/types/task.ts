/**
 * 朝堂 OS V2 · Task 相关类型
 *
 * 冻结层级：Tier 1（领域实体），修改需通知 Command Center / Overview Page Agent
 */

import type { AgentCode } from './agent';
import type { ManorAnalyzeResult } from './manor';

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
  /** 庄园研判报告（manor analysis 完成后写入） */
  manorReport?: ManorAnalyzeResult;
  /** 后端任务结果原文。上书房/军机处用它透传 unifiedLoop、memorial、source_label 等结构化结果。 */
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
 * - 本阶段 (Q3=D) 只做数据模型 + Mock，不做录入 UI
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
   * 是否为合成数据（adapter 层基于任务属性合成的占位复盘，
   * 用于 V1 后端尚未提供 retrospective 字段时的演示与开发）。
   * UI 应在 synthetic=true 时显示"演示数据"标识。
   */
  synthetic?: boolean;
}

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
   Review / 批示
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
   Create DTO
   ========================================================================== */

export interface CreateTaskDto {
  rawCommand: string;
  title?: string;
  description?: string;
  mode?: ExecutionMode;
  targetAgents?: AgentCode[];
}

/* ==========================================================================
   Filters
   ========================================================================== */

export interface TaskFilter {
  status?: TaskStatus[];
  mode?: ExecutionMode[];
  limit?: number;
  offset?: number;
  search?: string;
}
