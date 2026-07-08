/**
 * 刑部 · 司法数据契约
 *
 * 案件 / 合规 / 风险 / 判词数据结构
 * Source of Truth — 不可随意增删字段
 */

export type LegalCaseStatus = 'pending_review' | 'reviewing' | 'closed' | 'appeal';
export type LegalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type LegalCasePriority = 'P0' | 'P1' | 'P2';

export const LEGAL_CASE_STATUS_LABEL: Record<LegalCaseStatus, string> = {
  pending_review: '待审',
  reviewing: '审理中',
  closed: '已结案',
  appeal: '上诉',
};

export const LEGAL_RISK_LABEL: Record<LegalRiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

/** 单个案件记录 */
export interface LegalCase {
  id: string;
  /** 案号 */
  caseNumber: string;
  title: string;
  /** 原告部门 */
  plaintiff: string;
  /** 被告部门 */
  defendant: string;
  status: LegalCaseStatus;
  /** 涉案金额/标的 */
  amount: string;
  /** 案件优先级 */
  priority: LegalCasePriority;
  /** 风险等级 */
  riskLevel: LegalRiskLevel;
  /** 合同/法规引用 */
  legalReferences: string[];
  /** 证据清单 */
  evidenceIds: string[];
  /** 审理摘要 */
  summary: string;
  /** 承办判官 */
  judge: string;
  createdAt: string;
  updatedAt: string;
}

/** 合规审查条目 */
export interface ComplianceItem {
  id: string;
  title: string;
  category: 'contract' | 'regulatory' | 'data_privacy' | 'ip' | 'employment';
  status: 'passed' | 'pending' | 'failed' | 'waived';
  riskLevel: LegalRiskLevel;
  /** 审查截止日期 */
  deadline: string;
  /** 审查清单数量 */
  checklistTotal: number;
  /** 已通过清单数量 */
  checklistPassed: number;
  assignedTo: string;
}

export const COMPLIANCE_CATEGORY_LABEL: Record<ComplianceItem['category'], string> = {
  contract: '合同',
  regulatory: '法规',
  data_privacy: '数据隐私',
  ip: '知识产权',
  employment: '用工',
};

export const COMPLIANCE_STATUS_LABEL: Record<ComplianceItem['status'], string> = {
  passed: '通过',
  pending: '待审',
  failed: '未通过',
  waived: '豁免',
};

/** 刑部运行概况 */
export interface LegalOverview {
  summary: {
    /** 在办案件总数 */
    totalCases: number;
    /** 待审案件数 */
    pendingCount: number;
    /** 本周结案数 */
    closedThisWeek: string;
    /** 审查积压数 */
    complianceBacklog: number;
    /** 平均审理周期 */
    avgCycleDays: number;
    /** 结案率 */
    closureRate: string;
    /** 判词摘要 */
    recommendation: string;
    /** 数据源 */
    source: 'turso' | 'fallback';
    generatedAt: string;
  };
  cases: LegalCase[];
  complianceItems: ComplianceItem[];
}

/** API 返回信封 */
export interface LegalApiResponse {
  success: boolean;
  data: LegalOverview;
  error?: string;
}
