/**
 * 朝堂 OS V2 · 太医院 / 健康相关类型
 */

export type HealthRiskLevel = 'normal' | 'watch' | 'warning' | 'danger';

export const HEALTH_RISK_LABELS: Record<HealthRiskLevel, string> = {
  normal: '平稳',
  watch: '关注级',
  warning: '预警级',
  danger: '高危级',
};

export function formatHealthRiskLevel(level: HealthRiskLevel): string {
  return HEALTH_RISK_LABELS[level];
}

export type MetricStatus =
  | 'normal'
  | 'abnormal_high'
  | 'abnormal_low'
  | 'borderline';

export type MetricTrend = 'up' | 'down' | 'stable';

export interface HealthMetric {
  code: string;
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: MetricStatus;
  trend?: MetricTrend;
  trendSeries?: number[];
}

export interface HealthAlert {
  id: string;
  level: HealthRiskLevel;
  title: string;
  description: string;
  createdAt: string;
  actionRequired: boolean;
}

export type InterventionCategory =
  | 'medication'
  | 'exercise'
  | 'diet'
  | 'checkup'
  | 'lifestyle'
  | 'consult';

export interface InterventionAction {
  id: string;
  description: string;
  category: InterventionCategory;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
}

export interface InterventionPlan {
  id: string;
  title: string;
  scheduledAt: string;
  durationDays: number;
  ownerAgent: 'tai_yi_yuan';
  actions: InterventionAction[];
}

export interface VisitRecommendation {
  id: string;
  department: string;
  specialty: string;
  urgency: HealthRiskLevel;
  reason: string;
  suggestedWithinDays: number;
}

export interface FollowupReminder {
  id: string;
  title: string;
  dueAt: string;
  completed: boolean;
}

export interface HealthProfile {
  id: string;
  subjectName: string;
  /** 健康总分 0-100 */
  totalScore: number;
  riskLevel: HealthRiskLevel;
  updatedAt: string;
  metrics: HealthMetric[];
  alerts: HealthAlert[];
  interventions: InterventionPlan[];
  visitRecommendations: VisitRecommendation[];
  followups: FollowupReminder[];
}

/* 医疗信息查询 */
export interface MedicalInfoQueryResult {
  query: string;
  answer: string;
  confidence: number;
  sources: Array<{
    title: string;
    url?: string;
    publishedAt?: string;
  }>;
  disclaimers: string[];
}
