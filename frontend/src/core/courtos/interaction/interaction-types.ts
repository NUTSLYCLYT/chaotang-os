/**
 * CourtOS 交互智能层类型（V3 Prompt 4，阶段 A）。
 * 目标：让上书房像"已准备好的经营参谋系统"，而不是聊天框。
 * 本层只做纯函数 + mock 输入，不接真实 AI、不碰 UI、不改既有 Loop（原则 1/2/3）。
 */
import type { SourceLabel } from '../types.ts';

/** 决策阶段（与 V3 DecisionState 对齐；本层先用字面量，后续接 decision-loop 的真实状态）。 */
export type DecisionPhase =
  | 'DRAFT'
  | 'INTENT_REFINED'
  | 'EVIDENCE_CHECKING'
  | 'WAITING_FOR_EVIDENCE'
  | 'REVIEWING'
  | 'REPORT_READY'
  | 'WAITING_FOR_DECISION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'FOLLOWING_UP'
  | 'RECHECKING'
  | 'ARCHIVED'
  | 'FAILED';

export type PrimaryActionId =
  | 'confirm_and_start'
  | 'upload_evidence'
  | 'make_decision'
  | 'human_confirm'
  | 'archive_or_track'
  | 'record_reject_reason'
  | 'retry_or_save_draft'
  | 'view_demo_only'
  | 'review_report'
  | 'continue_followup';

/** 任何页面/状态都只给一个最重要主动作（原则 8）。 */
export interface NextBestAction {
  actionId: PrimaryActionId;
  label: string;
  reason: string;
}

export interface PendingTaskSnapshot {
  id: string;
  title: string;
  phase: DecisionPhase;
  sourceLabel: SourceLabel;
  needsHumanConfirmation: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  updatedAt?: string;
}

export interface BriefingItem {
  id: string;
  title: string;
  /** 为什么是现在处理它——whyNow 必填，没有理由不上简报。 */
  whyNow: string;
  primaryAction: NextBestAction;
  sourceLabel: SourceLabel;
}

export interface ProactiveBriefing {
  /** 今日一号决策；无可处理事项时为 null（不伪造）。 */
  topDecision: BriefingItem | null;
  pendingDecisions: BriefingItem[];
  pendingEvidence: BriefingItem[];
  risingRisks: BriefingItem[];
  historicalMirrors: BriefingItem[];
  /** 是否有真实(LIVE/LIVE_SWARM)数据；无则不伪装成真实洞察。 */
  hasRealData: boolean;
  sourceLabel: SourceLabel;
}
