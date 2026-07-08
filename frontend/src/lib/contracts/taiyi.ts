/**
 * 太医院 · 数据契约
 *
 * 本文件是太医院（Health Center）数据结构的单一真相来源。
 * - PhysicianSummary: Turso health_profiles 表的前端投影
 * - TaiyiDashboard: 太医院 BFF /api/court/taiyi/dashboard 的响应契约
 * - PhysicianCitation: LLM 增强返回的引用来源
 * - MedicalNewsItem: 太医院医讯数据结构
 *
 * 数据来源：Turso health_profiles 表 + /api/orchestration/run SSE
 */

import type { HealthProfile, HealthAlert, HealthMetric, InterventionPlan, HealthRiskLevel } from "@/types/health";

// =========================================================================
// 太医院 LLM 回答引用来源
// =========================================================================

export interface PhysicianCitation {
  /** 引用来源标题 */
  title: string;
  /** 来源 URL（可选） */
  url?: string;
  /** 来源类型 */
  type: "guideline" | "research" | "database" | "history";
  /** 发布时间（ISO 日期） */
  publishedAt?: string;
  /** 简短摘要 */
  excerpt?: string;
}

// =========================================================================
// 太医院仪表板数据
// =========================================================================

/** Turso 存储的健康档案快照（供前端 useSWR 消费） */
export interface TaiyiDashboard {
  profile: HealthProfile;
  /** 末次更新来源说明 */
  dataSource: "turso" | "upstream" | "fallback";
  /** 末次同步时间 */
  syncedAt: string;
}

// =========================================================================
// 医讯数据结构（供 Turso medical_news 表）
// =========================================================================

export type MedicalNewsCategory = "breakthrough" | "trial" | "ai" | "policy";

export interface MedicalNewsItem {
  id: string;
  category: MedicalNewsCategory;
  headline: string;
  excerpt: string;
  source: string;
  /** 重要性评分 0-100 */
  importance: number;
  /** ISO datetime */
  publishedAt: string;
  /** 是否与用户关注疾病相关 */
  relevant: boolean;
  /** 关联标签 */
  tags: string[];
  /** 引用来源 */
  citations: PhysicianCitation[];
}

// =========================================================================
// 太医院 BFF 响应信封
// =========================================================================

export interface TaiyiDashboardResponse {
  success: boolean;
  data: TaiyiDashboard | null;
  error?: string;
}

export interface MedicalNewsResponse {
  success: boolean;
  data: MedicalNewsItem[];
  error?: string;
}

// =========================================================================
// LLM 工具调用：查询健康档案（给 court-tools 扩展用）
// =========================================================================

export interface QueryHealthProfileInput {
  /** 查询维度 */
  aspect: "overview" | "metrics" | "alerts" | "interventions" | "news";
  /** 可选：指标代码过滤，如 ["LDL", "BP_S"] */
  metric_codes?: string[];
}

export interface QueryHealthProfileOutput {
  totalScore: number;
  riskLevel: HealthRiskLevel;
  summary: string;
  alerts: Pick<HealthAlert, "title" | "level" | "actionRequired">[];
  keyMetrics: Pick<HealthMetric, "code" | "name" | "value" | "unit" | "status">[];
  activeInterventions: Pick<InterventionPlan, "id" | "title" | "durationDays">[];
  citations: PhysicianCitation[];
  updatedAt: string;
}
