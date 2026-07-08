import type { SourceLabel } from '../types';
import type { IntelligencePack, UnifiedDraftEdict, UnifiedSignal, UnifiedVerdict } from '../unified/unified-types.ts';

export type HubuFinanceQuestionType =
  | '报价审查'
  | '投资评审'
  | '预算审批'
  | '现金流判断'
  | '成本毛利分析'
  | '回款与账期判断'
  | '合同财务条款审查'
  | '融资/借款判断'
  | '采购付款判断'
  | '招聘/组织成本判断'
  | '经营复盘'
  | '异常风险审计'
  | '其他财务问题';

export type HubuSubOfficeId =
  | 'cfo_chief'
  | 'fpna_budget'
  | 'treasury_cash'
  | 'controller_books'
  | 'cost_pricing'
  | 'investment_review'
  | 'audit_control';

export type HubuCFOPosition = '准奏' | '补证' | '复核' | '驳回';
export type HubuConfidence = '高' | '中' | '低';
export type HubuMetricStatus = 'available' | 'missing' | 'assumption' | 'blocked';

export interface HubuFinanceMetric {
  metric: string;
  value: string | null;
  unit?: string;
  status: HubuMetricStatus;
  meaningForEmperor: string;
  sourceRef?: string;
}

export interface HubuFinanceEvidence {
  title: string;
  sourceType: 'USER_INPUT' | 'USER_UPLOAD' | 'ARCHIVE' | 'WIKI_RULE' | 'TOOL_RESULT' | 'MODEL_INFERENCE' | 'FALLBACK';
  sourceRef?: string;
  usable: boolean;
  confidence: HubuConfidence;
}

export interface HubuSubOfficeOpinion {
  officeId: HubuSubOfficeId;
  officeName: string;
  position: HubuCFOPosition;
  finding: string;
  evidenceUsed: HubuFinanceEvidence[];
  missingEvidence: string[];
  assumptions: string[];
  risks: string[];
  keyNumbers: HubuFinanceMetric[];
}

export interface HubuCFOOpinion {
  department: '户部';
  cfoPosition: HubuCFOPosition;
  confidence: HubuConfidence;
  executiveSummary: string;
  financeQuestionType: HubuFinanceQuestionType;
  requiredSubOffices: HubuSubOfficeId[];
  keyNumbers: HubuFinanceMetric[];
  subOfficeOpinions: HubuSubOfficeOpinion[];
  evidenceUsed: HubuFinanceEvidence[];
  missingEvidence: string[];
  assumptions: string[];
  riskRegister: string[];
  recommendedNextAction: string;
  questionsForEmperor: string[];
  humanConfirmationRequired: boolean;
  sourceLabel: SourceLabel;
}

export interface HubuQualityGateResult {
  passed: boolean;
  signal: UnifiedSignal;
  verdict: UnifiedVerdict;
  blockingIssues: string[];
  warnings: string[];
}

export interface HubuDepartmentWorkOrder {
  taskId?: string;
  departmentId: 'finance';
  focusQuestion?: string;
  requiredEvidence?: string[];
  expectedOutputs?: string[];
  sourceLabel?: SourceLabel;
}

export interface HubuCFOOfficeLoopInput {
  confirmedEdict: UnifiedDraftEdict;
  intelligencePack?: IntelligencePack;
  departmentWorkOrder?: HubuDepartmentWorkOrder;
  sourceLabel?: SourceLabel;
}

export interface HubuCFOOfficeLoopResult {
  loopId: 'hubu_cfo_office_loop_v1';
  opinion: HubuCFOOpinion;
  qualityGate: HubuQualityGateResult;
}
