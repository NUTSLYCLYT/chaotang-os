/**
 * 六部双核蜂群 · 核心类型（2026-06-17）
 *
 * 适配（铁律2）：现有部门枚举有两套且不一致——
 *   contracts/dept.ts DeptCode = 户/刑/礼/锦衣卫/兵/太医院；
 *   swarm/router KEYWORDS = 户/兵/刑/工/吏。
 * 两者都不是用户要的"六部"(吏户礼兵刑工)。故此处定义一个干净的 MinistryId 作本特性 SSOT，
 * 经 ministry-bridge.ts 唯一映射到 router(选部) / dept-registry(尚书) / dept.ts(显示)。
 *
 * 红蓝对抗简化为「主手 A × 副手 B」两 agent（用户定调：不堆蜂群，省 token）：
 *   A = 主手(尚书视角)提推进主张；B = 副手(侍郎视角)提挑战与风险；再综合 → 尚书裁断。
 */
import type { SourceLabel, RiskLevel } from '../types';
import {
  MINISTRY_IDS as CONTRACT_MINISTRY_IDS,
  type MinistryId as ContractMinistryId,
} from '@/lib/contracts/dept';

/** 六部 ID 由 contracts/dept.ts 派生；本文件只拥有会审行为契约。 */
export type MinistryId = ContractMinistryId;
export const MINISTRY_IDS: readonly MinistryId[] = CONTRACT_MINISTRY_IDS;

/** 红黄绿灰灯。 */
export type MinistrySignal = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

/** 本部裁断。 */
export type MinistryVerdict = 'APPROVE' | 'NEED_EVIDENCE' | 'RECHECK' | 'REJECT';

/** 双核 + 综合角色（精简：主手 A / 副手 B / 综合）。 */
export type AgentRole = 'MAIN_A' | 'DEPUTY_B' | 'SYNTHESIS' | 'YUSHITAI';

export interface MinistryMeta {
  id: MinistryId;
  nameCn: string; // 吏部…
  nameEn: string;
  modernRole: string; // COO / CFO …
  mission: string;
  /** 可否对推进行使否决（红灯硬拦）。 */
  vetoPower: boolean;
  riskKeywords: string[];
  /**
   * 必查缺证清单(2026-07-03 评测驱动新增)：户部黄金评测跑出真实基线后发现，通用"缺证"指令
   * 太笼统——LLM 广度覆盖很好(法务/市场/技术都提到)，但连续4/5案例都漏掉本部职责核心的
   * 纪律性提问(止损点/ROI假设/现金影响)，即便 mission 里已提过 ROI/现金流。本字段把
   * "这个部门每次审议都不能漏问的具体项"显式列出，供 real-ministry-card.ts 的 prompt 注入，
   * 不靠 mission 里的笼统提及自然涌现。
   */
  mustCheckGaps?: string[];
}

/** 红蓝对抗卡（主手 A × 副手 B → 综合 → 裁断）。 */
export interface RedBlueCard {
  ministryId: MinistryId;
  taskId: string;
  /** 主手 A：推进主张 + 方案。 */
  mainThesis: string;
  mainPlan: string;
  /** 副手 B：挑战 + 风险 + 反证。 */
  deputyChallenge: string;
  deputyRisks: string[];
  /** 争议焦点。 */
  disputeFocus: string;
  /** 综合 + 尚书裁断。 */
  synthesis: string;
  ruling: string;
  signal: MinistrySignal;
  verdict: MinistryVerdict;
  conditionsToProceed: string[];
  missingEvidence: string[];
  needsHumanConfirmation: boolean;
  riskLevel: RiskLevel;
  sourceLabel: SourceLabel;
  confidence: number; // 0..1
}

/** 部门冲突（不强行平均，摊给老板）。 */
export interface MinistryConflict {
  between: [MinistryId, MinistryId];
  summary: string;
}

/** 六部会审汇总。 */
export interface MinistryReviewResult {
  taskId: string;
  selectedMinistries: MinistryId[];
  selectionReasons: Partial<Record<MinistryId, string>>;
  cards: RedBlueCard[];
  /** 行使否决（RED + vetoPower）的部门。 */
  vetoes: MinistryId[];
  conflicts: MinistryConflict[];
  missingEvidence: string[];
  humanApprovalRequired: boolean;
  overallSignal: MinistrySignal;
  overallSuggestion: string;
  sourceLabel: SourceLabel;
}

/** 御史台全局审计结果。 */
export interface YushitaiAuditResult {
  passed: boolean;
  blockingIssues: string[];
  warnings: string[];
  requiredActions: string[];
  needsHumanConfirmation: boolean;
  sourceLabel: SourceLabel;
}
