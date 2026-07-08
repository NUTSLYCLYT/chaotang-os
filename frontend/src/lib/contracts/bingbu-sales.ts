/**
 * 兵部 · 销售决策事项契约（2026-06-27）
 *
 * 镜像户部 `contracts/hubu.ts` 的 HubuProject/HubuOverview，但落在「销售决策」域：
 * 报价 / 谈判 / 商机 / 客户策略 / 渠道 / 续约。数据来源 (SoT):
 *   Turso 真任务（含销售语义）→ /api/court/bingbu/overview。
 *
 * 为什么新建而非复用世界A `contracts/bingbu.ts`（竞品情报 Competitor/SWOT）：
 *   两者域不同——世界A是「看竞品态势」，本文件是「待决销售事项队列」（户部同构）。
 *   非平行 SSOT（铁律2）：销售事项的唯一真相在本契约，竞品情报的唯一真相仍在 bingbu.ts。
 *
 * 诚实纪律（同户部）：金额/阶段只取用户命令里明示值，取不到一律 '—'，绝不编。
 */

export type SalesItemStatus = 'pending_review' | 'in_progress' | 'closed';
export type SalesRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const SALES_RISK_LABEL: Record<SalesRiskLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
};

export const SALES_STATUS_LABEL: Record<SalesItemStatus, string> = {
  pending_review: '待决',
  in_progress: '推进中',
  closed: '已了结',
};

/** 兵部待决销售事项（报价/谈判/商机/客户/渠道/续约） */
export interface BingbuSalesItem {
  id: string;
  /** 提炼后的销售问题标题 */
  title: string;
  /** 原始旨意命令（追问与引擎判断的输入文本） */
  command: string;
  status: SalesItemStatus;
  priority: 'P0' | 'P1' | 'P2';
  /** 客户 / 对手方；取不到 '—' */
  counterparty: string;
  /** 商机阶段；取不到 '—' */
  stage: string;
  /** 涉及金额（报价/订单/合同）；取不到 '—' */
  amount: string;
  risk_level: SalesRiskLevel;
  recommendation: string;
  /** 抽出的合同/条款（独家条款、违约金…）；无则空数组 */
  terms: string[];
  /** 行业线索（新能源、储能…）；取不到 '—' */
  industry: string;
  /** 交期（如 "30 天"）；取不到 '—' */
  delivery: string;
  /** 预付款（万元）；取不到 '—' */
  prepayment: string;
  /** 同一问题被下达次数（去重合并，≥1）。展示"已问 ×N"。 */
  asked_count: number;
  created_at: string;
  updated_at: string;
}

/** 兵部销售总览摘要（镜像 HubuSummary） */
export interface BingbuSalesSummary {
  total_items: number;
  pending_count: number;
  high_risk_count: number;
  recommendation: string;
  generated_at: string;
  source: 'turso' | 'fallback';
}

/** /api/court/bingbu/overview 的完整响应 */
export interface BingbuSalesOverview {
  summary: BingbuSalesSummary;
  items: BingbuSalesItem[];
}
