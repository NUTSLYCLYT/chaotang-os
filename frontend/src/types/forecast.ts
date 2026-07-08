/**
 * 朝堂 OS V2 · 钦天监 / 预测沙盘类型
 */

export type ScenarioName = 'optimistic' | 'base' | 'pessimistic';

export interface RiskWindow {
  id: string;
  period: string;
  opportunity: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface TriggerCondition {
  id: string;
  description: string;
  probability: number;
  source: string;
}

export interface ForecastScenario {
  id: string;
  name: ScenarioName;
  label: string;
  /** 0-1 */
  probability: number;
  /** 0-1 */
  confidence: number;
  timeframe: {
    start: string;
    end: string;
  };
  riskWindows: RiskWindow[];
  triggerConditions: TriggerCondition[];
  preActions: string[];
  payoffDescription: string;
  evidenceIds: string[];
}
