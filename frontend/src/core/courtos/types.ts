/**
 * CourtOS Loop + Harness · 核心类型（2026-06-17）
 *
 * 适配原则（AGENTS.md §13.1 / 铁律2 SSOT）：
 *   - 不重定义已有原语。RealityState / TaskStatus 等从现有契约 import type。
 *   - 本文件只补"产品决策层"缺的类型：DecisionState（PRD §8.10 产品态）、
 *     DecisionAction、Harness IO、奏折质量形状。
 *
 * SourceLabel（产品面 5 值，PRD §11）与内部 RealityState 是两套词汇：
 *   产品标签 = 给用户看的 LIVE/MIXED/DEMO；RealityState = 内部 real/mock/...
 *   两者经 source-label.ts 的 bridge 互转，禁各自维护排序逻辑。
 */
import type { RealityState } from '@/lib/reality/reality-state';
import type { TaskStatus } from '@/lib/contracts/task';

/** 产品面来源标签（PRD §11）。内部 SSOT 仍是 RealityState，本类型是其产品投影。 */
export type SourceLabel = 'LIVE' | 'LIVE_SWARM' | 'MIXED' | 'FALLBACK' | 'DEMO';

/** 风险级别。high → 触发人工确认门。 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * CourtOS Core 协议任务态（Goal 1）。
 * 保留下面的 DecisionState 旧 runtime 状态，避免破坏现有运行时代码；
 * 新协议态通过 adapter 映射到旧 runtime / TaskStatus。
 */
export type CourtCoreTaskState =
  | 'draft'
  | 'awaiting_confirm'
  | 'reviewing'
  | 'awaiting_evidence'
  | 'awaiting_decision'
  | 'followuping'
  | 'rechecking'
  | 'adopted'
  | 'rejected'
  | 'archived'
  | 'failed_with_recovery';

export const COURT_CORE_TASK_STATES: readonly CourtCoreTaskState[] = [
  'draft',
  'awaiting_confirm',
  'reviewing',
  'awaiting_evidence',
  'awaiting_decision',
  'followuping',
  'rechecking',
  'adopted',
  'rejected',
  'archived',
  'failed_with_recovery',
] as const;

/**
 * 产品决策态（PRD §8.10 主状态模型）。
 * 注意：这是"用户裁决层"，区别于 `TaskStatus`（后端执行管线层）。
 * 两层经 runtime adapter 关联，不互相覆盖。
 */
export type DecisionState =
  | 'draft' // 草稿
  | 'intent_refined' // 待确认（已拟旨）
  | 'evidence_checking' // 缺证检查中
  | 'waiting_for_evidence' // 待补证
  | 'reviewing' // 会审中
  | 'report_ready' // 奏折已生成
  | 'waiting_for_decision' // 待裁决
  | 'accepted' // 已采纳
  | 'rejected' // 已驳回
  | 'following_up' // 追问中
  | 'rechecking' // 复核中
  | 'archived' // 已归档
  | 'failed'; // 失败（任务不丢）

/** 决策动作（驱动状态迁移）。 */
export type DecisionAction =
  | 'refine_intent'
  | 'check_evidence'
  | 'request_evidence'
  | 'start_review'
  | 'generate_report'
  | 'ask_decision'
  | 'accept'
  | 'reject'
  | 'follow_up'
  | 'request_recheck'
  | 'archive'
  | 'fail';

/** 一次 Loop 迁移的描述（状态 + 动作 + 下一步）。 */
export interface LoopStep {
  from: DecisionState;
  action: DecisionAction;
  to: DecisionState;
}

/** AgentHarness 输入。executor 注入真实/mock 执行体，harness 只管壳。 */
export interface AgentHarnessInput<TInput = unknown> {
  taskId: string;
  agentName: string;
  input: TInput;
  /** 期望来源标签（执行成功时采用）。 */
  sourceLabel: SourceLabel;
  /** 审批策略：是否对高风险强制人工确认。 */
  approvalPolicy?: 'auto' | 'require_human_on_high_risk';
}

/** AgentHarness 统一输出。无论成败都带 sourceLabel + needsHumanConfirmation。 */
export interface AgentHarnessOutput<TOutput = unknown> {
  ok: boolean;
  output?: TOutput;
  error?: string;
  sourceLabel: SourceLabel;
  /** 内部真实态（SSOT），用于审计/聚合。 */
  reality: RealityState;
  auditId: string;
  needsHumanConfirmation: boolean;
  fallbackUsed: boolean;
}

/** 奏折质量形状（ReportQualityGate 校验对象）。字段缺失即非法。 */
export interface CourtReportShape {
  verdict?: string; // 圣裁
  summary?: string;
  perspectives?: unknown[]; // 分奏
  evidence?: unknown[];
  missingEvidence?: string[]; // 缺证
  risks?: unknown[];
  nextAction?: string; // 后令
  qualityGate?: { trustLevel?: 'fully_trusted' | 'conditional' | 'untrusted'; warnings?: string[] }; // 质门
  sourceLabel?: SourceLabel;
  needsHumanConfirmation?: boolean;
}

export type { RealityState, TaskStatus };
