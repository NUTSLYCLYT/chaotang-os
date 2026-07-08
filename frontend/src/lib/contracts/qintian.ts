/**
 * 朝堂 OS · 钦天监 数据契约
 *
 * 数据来源：Turso forecast_scenarios 表（lib/db/schema.ts）
 * 前端消费：features/qintian/hooks/use-forecast-scenarios.ts
 * BFF 层：  app/api/qintian/scenarios/route.ts
 */

/* -------------------------------------------------------------------------- */
/* 核心类型（与 types/forecast.ts 保持兼容）                                    */
/* -------------------------------------------------------------------------- */

export type QintianScenarioName = 'optimistic' | 'base' | 'pessimistic';

export interface QintianRiskWindow {
  id: string;
  period: string;
  opportunity: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface QintianTriggerCondition {
  id: string;
  description: string;
  probability: number;
  /** 来源引用（可作为 citation） */
  source: string;
}

/**
 * 钦天监单一情景，直接映射 forecast_scenarios 表行。
 * 字段严格匹配 src/types/forecast.ts ForecastScenario，确保现有组件零改动。
 */
export interface QintianScenario {
  id: string;
  name: QintianScenarioName;
  label: string;
  probability: number;
  confidence: number;
  timeframe: {
    start: string;
    end: string;
  };
  riskWindows: QintianRiskWindow[];
  triggerConditions: QintianTriggerCondition[];
  preActions: string[];
  payoffDescription: string;
  evidenceIds: string[];
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* LLM 引用（citation）                                                         */
/* -------------------------------------------------------------------------- */

export interface QintianCitation {
  /** 情景 id 或 "external" */
  sourceId: string;
  /** 引用文本摘录 */
  excerpt: string;
  /** 可选 URL（来自 Tavily / 触发条件 source） */
  url?: string;
}

/** Dock 对话返回的 LLM 增强响应 */
export interface QintianChatResponse {
  text: string;
  citations: QintianCitation[];
  toolsUsed: string[];
}

/* -------------------------------------------------------------------------- */
/* 钦天监学习路径 / 自我校准                                                    */
/* -------------------------------------------------------------------------- */

export type QintianLearningSource = 'rule_seed' | 'primary' | 'fallback';

export interface QintianLearningTriggerCard {
  id: string;
  rule: string;
  probability: number;
  source: string;
  timeWindow: string;
  departmentAction: string;
}

export interface QintianLearningRetrospective {
  archiveTaskId: string;
  title: string;
  status: 'archived' | 'pending_review';
  calibrationDelta: string;
  evidence: string[];
  nextReviewAt: string;
}

export interface QintianLearningPath {
  forecastId: string;
  scenarioLabel: string;
  userCapability: string;
  lessonTitle: string;
  lessonSummary: string;
  nextLesson: string;
  triggerCard: QintianLearningTriggerCard;
  retrospective: QintianLearningRetrospective;
  sourceLabel: 'RULE_SEED' | 'PRIMARY' | 'FALLBACK';
  source: QintianLearningSource;
  generatedAt: string;
}

export interface QintianLearningPathApiResponse {
  success: boolean;
  data: QintianLearningPath | null;
  meta: {
    source: QintianLearningSource;
    updatedAt: string;
  };
  error?: string;
}

export type QintianCalibrationVerdict = 'confirmed' | 'refuted' | 'unknown' | 'observing';

export interface QintianCalibrationRecord {
  taskId: string;
  forecastId: string;
  verdict: QintianCalibrationVerdict;
  due: boolean;
  calibrationDelta: string;
  nextLesson: string;
  updatedAt: string;
}

export interface QintianCalibrationApiResponse {
  success: boolean;
  data: {
    scanned: number;
    updated: number;
    records: QintianCalibrationRecord[];
  };
  meta: {
    source: 'primary';
    updatedAt: string;
    forced: boolean;
  };
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* BFF 响应信封                                                                  */
/* -------------------------------------------------------------------------- */

export interface QintianScenariosApiResponse {
  success: boolean;
  data: QintianScenario[];
  meta: {
    total: number;
    source: 'turso' | 'seed';
    updatedAt: string;
  };
  error?: string;
}

/* -------------------------------------------------------------------------- */
/* Turso 行 → QintianScenario 映射                                              */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToQintianScenario(row: Record<string, any>): QintianScenario {
  const parse = (field: unknown): unknown => {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return field ?? [];
  };

  return {
    id: String(row.id),
    name: row.name as QintianScenarioName,
    label: String(row.label),
    probability: Number(row.probability),
    confidence: Number(row.confidence),
    timeframe: {
      start: String(row.timeframe_start),
      end: String(row.timeframe_end),
    },
    payoffDescription: String(row.payoff_description),
    riskWindows: parse(row.risk_windows_json) as QintianRiskWindow[],
    triggerConditions: parse(row.trigger_conditions_json) as QintianTriggerCondition[],
    preActions: parse(row.pre_actions_json) as string[],
    evidenceIds: parse(row.evidence_ids_json) as string[],
    updatedAt: String(row.updated_at),
  };
}
