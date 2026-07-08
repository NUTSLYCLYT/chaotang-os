import type { AgentCode } from './agent';
import type { MemorialBrief } from './memorial';

// =========================================================================
// 部门契约 — 字段表来源: api-contracts.md §GET /api/chaotang/dept/{code}/overview
// =========================================================================

/** 部门状态(复用后端 aggregate_ministers 输出) */
export type DeptStatus = 'idle' | 'processing' | 'risk' | 'pending_review' | 'done';

export const DEPT_STATUS_LABEL: Record<DeptStatus, string> = {
  idle: '待命',
  processing: '处理中',
  risk: '风险',
  pending_review: '待审',
  done: '已完成',
};

export const DEPT_STATUS_COLOR: Record<DeptStatus, string> = {
  idle: '#6A7299',
  processing: '#6BA0FF',
  risk: '#F43F5E',
  pending_review: '#F0C66A',
  done: '#3DD68C',
};

/** 部门代号(6 个页面支持的) */
export type DeptCode = 'finance' | 'legal' | 'market' | 'guard' | 'ops' | 'physician';

/**
 * dept code → AgentCode 映射 ——【部门命名单一真相源 SSOT · 铁律2】。
 * 全仓任何 dept→agent/中文名 映射必须 import 这里,禁各自维护平行副本
 * (advisor-signal/dept-identity/decision-ledger/intentDetector 现有副本待逐步收敛到本表)。
 * 漂移由 dept-ssot.nodetest.ts 回归断言看守(改副本前先改本表)。来源: api-contracts.md §共享枚举。
 */
export const DEPT_TO_AGENT_CODE: Record<DeptCode, AgentCode> = {
  finance:   'hu_bu',
  legal:     'xing_bu',
  market:    'li_bu_rites',
  guard:     'jin_yi_wei',
  ops:       'bing_bu',
  physician: 'tai_yi_yuan',
};

/** 部门显示名(前端用) */
export const DEPT_DISPLAY: Record<DeptCode, { nameCn: string; nameEn: string; emoji: string; color: string }> = {
  finance:   { nameCn: '户部',  nameEn: 'Revenue',       emoji: '💰', color: '#F0C66A' },
  legal:     { nameCn: '刑部',  nameEn: 'Justice',       emoji: '⚖️', color: '#3DD68C' },
  market:    { nameCn: '礼部',  nameEn: 'Rites',         emoji: '🎨', color: '#C070D0' },
  guard:     { nameCn: '锦衣卫', nameEn: 'Imperial Guard', emoji: '🛰', color: '#FB923C' },
  ops:       { nameCn: '兵部',  nameEn: 'Operations',   emoji: '⚔️', color: '#6BA0FF' },
  physician: { nameCn: '太医院', nameEn: 'Physician',    emoji: '🩺', color: '#2DD4BF' },
};

/** 任务简报 */
export interface TaskBrief {
  taskId: string;
  title: string;
  progressPct: number;
}

/** 关键指标(可包含 mock 演示数据) */
export interface Metric {
  label: string;
  value: string;
  unit?: string;
}

/** 风险条目 */
export interface RiskItem {
  label: string;
  level: 'low' | 'medium' | 'high' | 'critical';
}

export const RISK_LEVEL_COLOR: Record<RiskItem['level'], string> = {
  low: '#3DD68C',
  medium: '#F0C66A',
  high: '#FB923C',
  critical: '#F43F5E',
};

/** 大臣元数据 */
export interface MinisterInfo {
  id: string;
  name: string;
  role: string;
  iconKey: string;
  description: string;
}

/** 部门详情聚合 */
export interface DeptOverview {
  code: string;
  agentCode: AgentCode;
  minister: MinisterInfo;
  status: DeptStatus;
  recentMemorials: MemorialBrief[];
  activeTasks: TaskBrief[];
  keyMetrics: Metric[];   // 部门特定,可含 [MOCK] 演示数据
  risks?: RiskItem[];
}
