/**
 * 朝堂 OS · 锦衣卫情报数据契约（SoT）
 *
 * 所有情报信号相关类型在此定义；下游组件从此处 import。
 * src/types/intel.ts 中的类型已迁移至此；旧文件保留向后兼容 re-export。
 */

import type { AgentCode } from './agent';
import type { CredTier } from '@/core/courtos/primitives/credibility';

/* ==========================================================================
   基础枚举
   ========================================================================== */

export type IntelCategory = 'risk' | 'opportunity' | 'neutral';

export type IntelLevel = 'info' | 'watch' | 'warning' | 'critical';

export type IntelCredibility = 'low' | 'medium' | 'high' | 'verified';

/* ==========================================================================
   情报来源
   ========================================================================== */

export interface IntelSource {
  name: string;
  url?: string;
  publishedAt: string;
  /** 该信源历史可信度分级（锦衣卫 credibilityWeight 加权，见 src/lib/intel/source-credibility.ts）。
   *  新信源/样本不足时为 'unproven'，这是诚实现状，不是缺省错误。 */
  credibilityTier?: CredTier;
}

/* ==========================================================================
   地理坐标
   ========================================================================== */

export interface IntelCoordinate {
  lat: number;
  lng: number;
}

/* ==========================================================================
   领先度原料（仙狐后端填 · 前端不臆造）
   ========================================================================== */

/**
 * 领先度 = 我方比市场早多少。由仙狐分级采集提供两个时间戳；
 * 缺 edgeFirstSeenAt → 领先度不可算，前端必须空态、禁写死数字（铁律4 回归断言守）。
 */
export interface IntelLeadTime {
  /** 边缘 / 非主流源首次捕获（ISO）。 */
  edgeFirstSeenAt: string;
  /** 主流媒体首次命中（ISO）；缺省=尚未被主流跟进=仍领先。 */
  mainstreamHitAt?: string;
}

/* ==========================================================================
   情报信号（核心数据结构）
   ========================================================================== */

export interface IntelSignal {
  id: string;
  category: IntelCategory;
  level: IntelLevel;
  title: string;
  summary: string;
  /** ISO-2 或自定义 region code */
  region: string;
  regionLabel: string;
  industry: string;
  credibility: IntelCredibility;
  sources: IntelSource[];
  firstSeenAt: string;
  lastUpdatedAt: string;
  coordinates?: IntelCoordinate;
  /** 已转派给哪些 agent */
  routedTo?: AgentCode[];
  /** 风险等级着色用（0-100） */
  impactScore?: number;
  /** 领先度原料（仙狐后端填）；缺则领先度不可算、前端空态。 */
  leadTime?: IntelLeadTime;
  /** 一句话「对我们=?」（编排/后端填）；缺则不显示，不臆造。 */
  soWhat?: string;
}

/* ==========================================================================
   过滤条件
   ========================================================================== */

export interface IntelFilter {
  regions: string[];
  industries: string[];
  levels: IntelLevel[];
  categories: IntelCategory[];
  /** 时间窗口（小时） */
  lookbackHours?: number;
}

/* ==========================================================================
   转派请求
   ========================================================================== */

export interface IntelRouteRequest {
  signalId: string;
  targetAgents: AgentCode[];
  note?: string;
  createTask?: boolean;
}

/* ==========================================================================
   API 响应
   ========================================================================== */

export interface IntelSignalsResponse {
  success: boolean;
  data: IntelSignal[];
  meta: {
    total: number;
    source: 'turso' | 'fallback';
    fetchedAt: string;
  };
}

/* ==========================================================================
   Turso intel_signals 行格式（Server-side 内部用）
   ========================================================================== */

export interface IntelSignalRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  region: string | null;
  impact_score: number | null;
  sources_json: string | null;
  created_at: string;
}
