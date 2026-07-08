/**
 * 朝堂 OS · Judgement 数据契约
 *
 * 来源：A 实测 GET /api/v1/judgements/current + /panel + /status-digest
 * 目标位置：apps/web/lib/contracts/judgement.ts
 */

/** 全局状态标签（与蜂群 SwarmStatus 部分共用） */
export type GlobalStatusTag = 'normal' | 'warning' | 'critical' | 'done';

/* ==========================================================================
   Judgement · 御座当前总判断
   ========================================================================== */

export interface Judgement {
  id: string;
  /** 头版头条优先级描述 */
  firstPriority: string;
  /** 系统总判断（一段话） */
  systemJudgement: string;
  /** 全局状态标签 */
  globalStatusTag: GlobalStatusTag;
  /** 关联条目 */
  judgementItems?: JudgementItem[];
  /** 是否当前激活 */
  isActive: boolean;
  /** 创建时间 ISO8601 */
  createdAt: string;
}

export interface JudgementItem {
  /** 显示标签（"工部蜂群"） */
  label: string;
  /** 业务对象 ID（"swarm-gong-bu"） */
  object: string;
  /** 跳转链接 */
  actionHref: string;
}

/* ==========================================================================
   JudgementPanel · ThroneJudgementPanel（3 条摘要）
   ========================================================================== */

export interface JudgementPanelEntry {
  firstPriority: string;
  systemJudgement: string;
  globalStatusTag: GlobalStatusTag;
}

export type JudgementPanel = JudgementPanelEntry[];

/* ==========================================================================
   StatusDigest · ThroneStatusDigest（4-6 条）
   ========================================================================== */

export type StatusDigest = JudgementItem[];
