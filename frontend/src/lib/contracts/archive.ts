/**
 * 史馆契约 — ArchiveRecord / ArchiveStats / ShiguanAnalysis
 *
 * 数据来源：Turso tasks / decisions 表（BFF 聚合）
 * 所有展示历史档案的组件必须从此 import 类型。
 */

export type CaseOutcome = 'success' | 'blocked' | 'failed' | 'pending';

/** 单条档案记录（tasks 表 + decisions 表聚合） */
export interface ArchiveRecord {
  id: string;
  title: string;
  /** '蜂群任务' | '治理议题' | '情报信号' */
  type: string;
  outcome: CaseOutcome;
  /** 责任部门/大臣代码 */
  department: string;
  /** ISO8601 时间戳 */
  date: string;
  /** 关联报告/决策 ID，可选 */
  reportId?: string;
  /** 是否来自治理决策（decisions 表） */
  isGovernance?: boolean;
  /** Only set for shiguan_archives rows. Presence (≠ undefined) means this record supports retrospective updates. */
  retrospectiveStatus?: string;
}

/** 史馆统计聚合（/api/court/shiguan/stats 返回） */
export interface ArchiveStats {
  /** tasks 表总数 */
  totalTasks: number;
  /** archived / reviewed 已结案数 */
  totalCases: number;
  /** 综合成功率 0-100 */
  successRate: number;
}

/** 命令类型频率（PatternPanel 用） */
export interface CommandTypeFreq {
  type: string;
  count: number;
  pct: number;
}

/** 部门成功率（PatternPanel 用） */
export interface DeptSuccessRate {
  dept: string;
  total: number;
  success: number;
  rate: number;
}

/** LLM 分析结果（含 citations） */
export interface ShiguanAnalysis {
  /** 分析正文（Markdown） */
  analysis: string;
  /** 引用来源 */
  citations: AnalysisCitation[];
  /** 生成时间 ISO8601 */
  generatedAt: string;
}

export interface AnalysisCitation {
  /** 档案/奏折 ID */
  id: string;
  title: string;
  /** 引用原因 */
  relevance: string;
}

/** /api/court/shiguan/archive 路由返回体 */
export interface ArchivePayload {
  success: boolean;
  data: ArchiveRecord[];
  meta: {
    total: number;
    fromTurso: boolean;
  };
}
