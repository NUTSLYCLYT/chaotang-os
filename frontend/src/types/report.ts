/**
 * 朝堂 OS V2 · Report 相关类型
 */

import type { AgentCode } from './agent';

export type ReportTemplate =
  | 'executive_digest'    // 高管摘要
  | 'strategy_report'     // 战略报告
  | 'intel_brief'         // 情报简报
  | 'health_report'       // 健康报告
  | 'forecast_memo';      // 预测备忘

export type ReportSectionKind =
  | 'text'
  | 'markdown'
  | 'table'
  | 'chart'
  | 'list'
  | 'quote'
  | 'scenario'
  | 'metric_grid';

export interface ReportSection {
  id: string;
  title: string;
  kind: ReportSectionKind;
  /** 结构因 kind 而异，消费者按 kind narrow */
  content: unknown;
  order: number;
}

export interface ReportMetadata {
  author: string;
  audience: string;
  version: number;
  contributingAgents: AgentCode[];
}

export interface Report {
  id: string;
  taskId?: string;
  template: ReportTemplate;
  title: string;
  subtitle?: string;
  createdAt: string;
  sections: ReportSection[];
  metadata: ReportMetadata;
}

/* 6 段固定呈报结构（兼容 V1 Report 表） */
export interface ClassicReportSections {
  executiveSummary: string;
  coreRecommendations: string;
  departmentConclusions: DepartmentConclusion[];
  riskWarnings: string;
  observatoryForecast: string;
  reviewActions: string;
}

export interface DepartmentConclusion {
  agentCode: AgentCode;
  departmentName: string;
  summary: string;
  confidence: number;
  keyPoints: string[];
}
