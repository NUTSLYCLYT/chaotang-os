/**
 * 朝堂 OS V2 · 锦衣卫 / 情报相关类型
 */

import type { AgentCode } from './agent';

export type IntelCategory = 'risk' | 'opportunity' | 'neutral';

export type IntelLevel = 'info' | 'watch' | 'warning' | 'critical';

export type IntelCredibility = 'low' | 'medium' | 'high' | 'verified';

export interface IntelSource {
  name: string;
  url?: string;
  publishedAt: string;
}

export interface IntelCoordinate {
  lat: number;
  lng: number;
}

export interface IntelSignal {
  id: string;
  category: IntelCategory;
  level: IntelLevel;
  title: string;
  summary: string;
  region: string;              // ISO-2 或自定义 region code
  regionLabel: string;
  industry: string;
  credibility: IntelCredibility;
  sources: IntelSource[];
  firstSeenAt: string;
  lastUpdatedAt: string;
  coordinates?: IntelCoordinate;
  /** 已转派给哪些 agent */
  routedTo?: AgentCode[];
  /** 用于前端风险等级着色 */
  impactScore?: number;        // 0-100
}

export interface IntelFilter {
  regions: string[];
  industries: string[];
  levels: IntelLevel[];
  categories: IntelCategory[];
  /** 时间窗口（小时） */
  lookbackHours?: number;
}

export interface IntelRouteRequest {
  signalId: string;
  targetAgents: AgentCode[];
  note?: string;
  createTask?: boolean;
}
