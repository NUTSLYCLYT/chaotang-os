/**
 * evidence-classify —— 上传证据自动三维分类。
 * 规则优先(命中=高置信、零成本、可测),未命中再 LLM 兜底(中置信)。
 * 张小龙建议:自动猜一个标签,让用户一键确认/改 —— 人改的那一下是最准的分类信号。
 */

import type { AgentCode } from '@/lib/contracts/agent';
import type {
  EvidenceClassification,
  EvidenceTrust,
  EvidenceType,
} from '@/lib/contracts/evidence';

/** 证据类型 → 司归属(单一映射,禁平行表)。 */
const TYPE_TO_DEPTS: Record<EvidenceType, AgentCode[]> = {
  financial_statement: ['hu_bu'],
  contract: ['xing_bu'],
  legal_doc: ['xing_bu'],
  market_data: ['hu_bu', 'qin_tian_jian'],
  intel: ['jin_yi_wei', 'bing_bu'],
  spec: ['gong_bu'],
  brand_asset: ['li_bu_rites'],
  health_doc: ['tai_yi_yuan'],
  other: ['prime_minister'],
};

/** 关键词 → 类型(中英)。顺序即优先级。 */
const RULES: Array<{ type: EvidenceType; re: RegExp }> = [
  { type: 'financial_statement', re: /财报|财务报表|资产负债|利润表|现金流|科目余额|balance\s?sheet|income\s?statement|cash\s?flow/i },
  { type: 'contract', re: /合同|协议书|条款|contract|agreement/i },
  { type: 'legal_doc', re: /法规|法律|合规|监管|regulation|compliance|\blegal\b/i },
  { type: 'market_data', re: /行情|股价|K线|market\s?data|quote|ticker|股票/i },
  { type: 'intel', re: /情报|竞品|对标|competitor|\bintel\b/i },
  { type: 'spec', re: /需求文档|PRD|技术方案|接口文档|\bAPI\b|requirement|\bspec\b/i },
  { type: 'brand_asset', re: /品牌|营销|小红书|抖音|文案|brand|marketing/i },
  { type: 'health_doc', re: /健康|医疗|体检|health|medical/i },
];

/** 规则分类(命中返回高置信结果,未命中返回 null)。trust 由调用方决定(上传 vs 锦衣卫)。 */
export function classifyByRules(
  filename: string,
  snippet: string,
  trust: EvidenceTrust,
): EvidenceClassification | null {
  const hay = `${filename}\n${snippet}`;
  for (const { type, re } of RULES) {
    if (re.test(hay)) {
      return {
        evidenceType: type,
        deptAffinity: TYPE_TO_DEPTS[type],
        trust,
        confidence: 0.9,
        rationale: `规则命中「${type}」(${re.source.slice(0, 24)}…)`,
      };
    }
  }
  return null;
}

/** other 兜底(规则与 LLM 都没把握时)。 */
export function fallbackOther(trust: EvidenceTrust): EvidenceClassification {
  return {
    evidenceType: 'other',
    deptAffinity: TYPE_TO_DEPTS.other,
    trust,
    confidence: 0.3,
    rationale: '规则未命中,暂归 other(交丞相,待用户确认/改)',
  };
}

/**
 * 完整分类:规则优先 → 未命中走 LLM 兜底 → 仍不确定归 other。
 * llmClassify 注入(便于测试 mock);不传则只用规则 + other 兜底。
 */
export async function classifyEvidence(
  filename: string,
  snippet: string,
  trust: EvidenceTrust,
  llmClassify?: (filename: string, snippet: string) => Promise<EvidenceType | null>,
): Promise<EvidenceClassification> {
  const ruled = classifyByRules(filename, snippet, trust);
  if (ruled) return ruled;
  if (llmClassify) {
    const t = await llmClassify(filename, snippet).catch(() => null);
    if (t && t !== 'other') {
      return {
        evidenceType: t,
        deptAffinity: TYPE_TO_DEPTS[t],
        trust,
        confidence: 0.6,
        rationale: 'LLM 兜底分类',
      };
    }
  }
  return fallbackOther(trust);
}
