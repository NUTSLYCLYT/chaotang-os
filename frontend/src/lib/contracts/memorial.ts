import type { AgentCode } from './agent';
import type { SourceLabel } from '@/core/courtos/types';

export interface MemorialBrief {
  id: string; title: string; sourceDepartment: string; agentCode: AgentCode;
  priority: string; status: string; summary: string; createdAt: string;
}

/**
 * Court Memorial Standard v1
 *
 * 统一奏折标准：
 * - 各部门只负责起草本部奏折，不替其它部门下结论。
 * - 丞相只负责多部门信息整理、冲突摘要和最终回奏行文，不伪造部门意见。
 * - 军机处负责会审、冲突处置和路线判断，可产出军机处结论奏折。
 * - 上书房展示最终回奏；用户只需要看到答案、缺证、风险、下一步和附件。
 */
export const COURT_MEMORIAL_SCHEMA_VERSION = 'CourtMemorialV1' as const;

export type CourtMemorialSchemaVersion = typeof COURT_MEMORIAL_SCHEMA_VERSION;

export type MemorialAuthorRole =
  | 'department'
  | 'chancellor'
  | 'grand_council'
  | 'shangshufang'
  | 'archive';

export type MemorialKind =
  | 'department_memorial'
  | 'chancellor_synthesis'
  | 'grand_council_conclusion'
  | 'imperial_return'
  | 'evidence_order'
  | 'archive_record';

export type MemorialDecisionPosture =
  | 'answer_ready'
  | 'needs_evidence'
  | 'needs_review'
  | 'blocked'
  | 'informational';

export type MemorialAttachmentKind =
  | 'department_report'
  | 'evidence_pack'
  | 'source_file'
  | 'calculation_sheet'
  | 'archive_record'
  | 'export_report';

export interface MemorialFact {
  id: string;
  claim: string;
  sourceLabel: SourceLabel;
  evidenceRef?: string;
  value?: string | number | null;
  unit?: string;
  period?: string;
  confidence?: number;
}

export interface MemorialGap {
  id: string;
  field: string;
  reason: string;
  ownerDept?: string;
  requiredEvidence?: string;
}

export interface MemorialRisk {
  id: string;
  level: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  title: string;
  detail: string;
  ownerDept?: string;
  mitigation?: string;
}

export interface MemorialAction {
  id: string;
  label: string;
  ownerDept: string;
  actionType:
    | 'answer'
    | 'collect_evidence'
    | 'review'
    | 'approve'
    | 'reject'
    | 'archive'
    | 'prepare_materials'
    | 'manual_confirm';
  target?: string;
  disabledReason?: string;
}

export interface MemorialAttachment {
  id: string;
  label: string;
  kind: MemorialAttachmentKind;
  ownerDept: string;
  sourceLabel: SourceLabel;
  href?: string;
  contentType?: string;
  disabledReason?: string;
}

export interface MemorialQualityGate {
  passed: boolean;
  sourceLabel: SourceLabel;
  hallucinationGuard: {
    noUnsupportedNumbers: boolean;
    missingFactsMarkedAsGaps: boolean;
    departmentClaimsSeparated: boolean;
  };
  blockingIssues: string[];
  warnings: string[];
}

export interface CourtMemorial {
  schemaVersion: CourtMemorialSchemaVersion;
  id: string;
  taskId: string;
  kind: MemorialKind;
  authorRole: MemorialAuthorRole;
  authorDept: string;
  title: string;
  userQuestion: string;
  oneSentenceAnswer: string;
  decisionPosture: MemorialDecisionPosture;
  sourceLabel: SourceLabel;
  facts: MemorialFact[];
  analysis: Array<{
    section: string;
    body: string;
    ownerDept?: string;
  }>;
  risks: MemorialRisk[];
  gaps: MemorialGap[];
  actions: MemorialAction[];
  attachments: MemorialAttachment[];
  qualityGate: MemorialQualityGate;
  createdAt: string;
  traceId?: string;
}

export interface DepartmentMemorial extends CourtMemorial {
  kind: 'department_memorial';
  authorRole: 'department';
}

export interface ChancellorSynthesisMemorial extends CourtMemorial {
  kind: 'chancellor_synthesis';
  authorRole: 'chancellor';
  sourceMemorialIds: string[];
}

export interface GrandCouncilConclusionMemorial extends CourtMemorial {
  kind: 'grand_council_conclusion';
  authorRole: 'grand_council';
  sourceMemorialIds: string[];
  conflictSummary: Array<{
    between: string[];
    issue: string;
    proposedResolution: string;
  }>;
}

export interface ImperialReturnMemorial extends CourtMemorial {
  kind: 'imperial_return';
  authorRole: 'shangshufang';
  sourceMemorialIds: string[];
}

/**
 * 奏折 status → 中文标签（集中维护，所有展示 memorial.status 的地方从此取）
 *
 * MemorialStatus 值域（KP-7 全链路登记）:
 *   DB 可写 5 值（后端 ORM + 写入端 + 状态机均认识）:
 *     pending | running | approved | archived | rejected
 *   前端仅展示态（不落 DB，仅用于 UI label fallback）:
 *     reviewed  — 旧版本遗留字段别名，实际等价 approved/archived
 *     failed    — 任务执行失败的前端展示态（对应 tasks.task_status='error'）
 *     draft     — 草稿态（未进入 memorials 表，仅前端临时态）
 *
 * 新增 status 必须同步：① 后端 ORM + 写入端 + 消费状态机 ② 此处 label map ③ api-contracts 值域（KP-7）
 */
export const MEMORIAL_STATUS_LABEL: Record<string, string> = {
  // ── DB 可写 5 值 ──
  pending:    '待裁决',
  running:    '执行中',
  approved:   '已批准',
  rejected:   '已驳回',
  archived:   '已归档',
  // ── 前端仅展示态（不落 DB）──
  reviewed:   '已裁决',
  failed:     '执行失败',
  draft:      '草稿',
};

/**
 * 任务 status → 中文标签（上书房最近任务列等短文本展示用）
 *
 * TaskStatus 值域（api-contracts §GET /api/chaotang/tasks）:
 *   DB 持久值（后端 tasks.task_status 列）:
 *     running | report_ready | failed | archived
 *   前端仅展示态（内存/派生，不写 tasks 表）:
 *     draft/submitted/interpreting/planning/assigned/aggregating/reviewed
 */
export const TASK_STATUS_LABEL: Record<string, string> = {
  // ── 前端仅展示态 ──
  draft:        '草稿',
  submitted:    '已提交',
  interpreting: '研判中',
  planning:     '拟旨中',
  assigned:     '已分派',
  aggregating:  '汇总中',
  reviewed:     '已裁决',
  // ── DB 持久值 ──
  running:      '执行中',
  report_ready: '待裁决',
  failed:       '执行失败',
  archived:     '已归档',
};

/** 取奏折状态中文标签，无匹配时原样返回 */
export function memorialStatusLabel(status: string): string {
  return MEMORIAL_STATUS_LABEL[status] ?? status;
}

/** 取任务状态中文标签，无匹配时原样返回 */
export function taskStatusLabel(status: string): string {
  return TASK_STATUS_LABEL[status] ?? status;
}
export interface MemorialSections {
  background: string; objective: string;
  opinions: { agentCode: AgentCode; text: string }[];
  risks: string[]; recommendation: string;
  executionPath: { phase: string; task: string; owner: AgentCode; status: string }[];
  decisionsNeeded: string[]; nextSteps: string[];
  /**
   * 反事实奏折扩展（太子自主运营模式）：除"做了什么",再报"没做/待裁/若获准"。
   * 全部可选,向后兼容——既有奏折不传则不渲染该段。
   */
  notDone?: { objective: string; reason: string }[];                       // 按律拦下
  awaitingDecree?: { objective: string; reason: string; sla?: string }[];  // 伏候圣裁
  counterfactual?: { objective: string; estimatedGain: string }[];         // 若当时获准
}
export type ReviewActionType = 'approve' | 'reject' | 'inquire';
export interface ReviewAction {
  id: string; memorialId: string; action: ReviewActionType; comment: string;
  reviewerName: string; createdAt: string; taskStatus?: string;
}
export interface MemorialDetail extends MemorialBrief {
  qualityScore: number | null; memorial: MemorialSections;
  fullContent: Record<string, unknown>; review: ReviewAction | null;
}
