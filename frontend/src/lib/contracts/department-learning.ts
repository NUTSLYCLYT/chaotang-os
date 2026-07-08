import type { AgentCode } from './agent';

export type DepartmentLearningVerdict = 'confirmed' | 'refuted' | 'unknown' | 'observing';

export interface DepartmentLearningRecord {
  id: string;
  agentCode: AgentCode;
  agentName: string;
  calibrationTarget: string;
  metricName: string;
  sourceLabel: 'PRIMARY' | 'RULE_SEED' | 'FALLBACK';
  verdict: DepartmentLearningVerdict;
  dueAt: string;
  nextLesson: string;
  calibrationDelta: string;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
  /**
   * 样本量闸门(2026-07-03 P2修)：累计双证据(签核链+史馆归档)confirmed/refuted 真实样本数。
   * 可选字段——旧存量记录(该字段落地前写入的)读到时按 0 处理，不是硬迁移，见 real-source.ts。
   */
  confirmedCount?: number;
  refutedCount?: number;
  /**
   * 钦天监事件预测溯源(2026-07-04)：本条学习记录若源自 forecastPriceTrend/forecastNewEnergyTopic
   * 的一次预测，这里记录被引用的锦衣卫 IntelSignal id(供按信号来源做可靠度回溯)。
   * 可选字段——非钦天监预测触发的记录(旧存量/其他部门)不写，读到时按 [] 处理。
   */
  citedSignalIds?: string[];
}

export interface DepartmentLearningRecordsResponse {
  success: boolean;
  data: {
    records: DepartmentLearningRecord[];
  };
  meta: {
    total: number;
    source: 'primary';
    updatedAt: string;
  };
  error?: string;
}

export interface DepartmentLearningMetrics {
  total: number;
  confirmed: number;
  refuted: number;
  unknown: number;
  observing: number;
  /** 已过 dueAt 但仍未 confirmed/refuted 的记录数（飞轮空转信号） */
  dueUnresolved: number;
  /** confirmed / total */
  confirmedRate: number;
  /** unknown / total */
  stillUnknownRate: number;
  /** dueUnresolved>0 且 confirmed===0：真实结果源从未接入，学习底座在空转 */
  resultSourceStale: boolean;
}

export interface DepartmentLearningCalibrationResponse {
  success: boolean;
  data: {
    scanned: number;
    updated: number;
    metrics: DepartmentLearningMetrics;
    records: DepartmentLearningRecord[];
  };
  meta: {
    source: 'primary';
    updatedAt: string;
    forced: boolean;
  };
  error?: string;
}

export interface DepartmentLearningAdvisorSignal {
  agentCode: AgentCode;
  agentName: string;
  weight: number;
  caution: string;
  nudge: string;
  verdict: DepartmentLearningVerdict;
  sourceLabel: DepartmentLearningRecord['sourceLabel'];
  metricName: string;
  updatedAt: string;
}

export interface DepartmentLearningAdvisorSignalResponse {
  success: boolean;
  data: {
    signals: DepartmentLearningAdvisorSignal[];
  };
  meta: {
    total: number;
    source: 'primary';
    updatedAt: string;
  };
  error?: string;
}

export type DepartmentLearningRealSourceKind = 'boss_signoff';
export type DepartmentLearningRealSourceAction = 'signed' | 'edited' | 'rejected';

export interface DepartmentLearningRealSourceInput {
  source: DepartmentLearningRealSourceKind;
  action: DepartmentLearningRealSourceAction;
  agentCode?: AgentCode;
  dept?: string;
  evidenceId?: string;
  archiveId?: string;
  note?: string;
  /**
   * 会审HIGH修复(2026-07-03)：调用方(如archive-backfill.ts)已知"当前正在处理的归档属于哪个
   * taskId"，把它传进来后 real-source.ts 才能验证"这次归档真的是这条签核在等的那次"，而不是
   * "任意一个归档存在就算数"——后者曾导致陈旧pending签核被不相关新归档误配对反复计数。
   */
  expectedTaskId?: string;
}

export interface DepartmentLearningRealSourceResponse {
  success: boolean;
  data: {
    applied: boolean;
    record: DepartmentLearningRecord | null;
  };
  meta: {
    source: 'primary';
    updatedAt: string;
  };
  error?: string;
}
