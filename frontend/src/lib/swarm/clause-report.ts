/**
 * clause-report —— 刑部交付物层:把条款扫描+史馆踩坑率渲染成【可下载合规审查报告】。
 * 对照户部 deliverable.renderReport;完成刑部 L1顾问→L2执行者(交一份能用的报告)。
 *
 * 诚实(铁律13.2):报告头明标"AI 初审,非法律意见,高风险必人工复核";
 * 先外后内:先列史馆同类条款踩坑率(外部视角),再列本份具体风险(内部视角)。
 */

import type { ClauseHistoryResult } from './clause-history';

export interface ClauseReportMeta {
  /** 合同名/对象(脱敏:仅标识,不含敏感数值)。 */
  subject: string;
  /** ISO 时间(调用方传,本层不调 Date)。 */
  generatedAt: string;
}

// 本报告恒为本地规则引擎初审(铁律13.2.3 诚实:不暗示后端 LIVE,不立平行 SourceLabel 类型)。
const SOURCE_NOTE = '本地规则引擎(《民法典》规则库)初审 · 未经后端/法务验证';

const VERDICT_BANNER: Record<ClauseHistoryResult['scan']['verdict'], string> = {
  veto: '> 🔴 **一票否决**:命中高危条款,**禁止径自签署,必须人工/法务复核**。',
  caution: '> 🟡 **谨慎**:存在风险条款,逐条人工确认后再定。',
  pass: '> 🟢 **低风险**:未命中已知高危,标准保护齐备;仍建议人工抽查。',
};

export function renderClauseReport(result: ClauseHistoryResult, meta: ClauseReportMeta): string {
  const { scan, topRiskType, topRiskHistory } = result;
  const L: string[] = [];
  L.push('# 刑部 · 合同合规审查报告');
  L.push('');
  L.push('> ⚠️ 本报告由 AI 初审生成,**不构成法律意见**;高风险条款以人工/法务复核为准。');
  L.push(VERDICT_BANNER[scan.verdict]);
  L.push('');
  L.push(`**审查对象**:${meta.subject}　**风险分**:${scan.riskScore}/100　**来源**:${SOURCE_NOTE}　**生成**:${meta.generatedAt}`);
  L.push('');

  // 先外:史馆同类条款踩坑率
  if (topRiskType && topRiskHistory) {
    L.push('## 一、外部视角 · 史馆同类条款踩坑率(先看历史)');
    if (topRiskHistory.mode === 'base_rate') {
      const fail = Math.round(((topRiskHistory.distribution.failed ?? 0) + (topRiskHistory.distribution.blocked ?? 0)) * 100);
      L.push(`最高危条款类型「${topRiskType}」:史馆同类案 ${topRiskHistory.usedCaseIds.length} 条,**约 ${fail}% 出过纠纷/被阻**(已兑现 ${topRiskHistory.effectiveN} 条)。`);
      L.push(`> ${topRiskHistory.rationale}`);
    } else {
      L.push(`最高危条款类型「${topRiskType}」:史馆同类案不足(${topRiskHistory.effectiveN} 条),**只作参考类比,不给踩坑率**(防假统计)。`);
    }
    L.push('');
  }

  // 内部:本份风险条款
  L.push('## 二、内部视角 · 本合同风险条款');
  if (scan.risks.length === 0) {
    L.push('未命中已知高危条款。');
  } else {
    for (const r of scan.risks) {
      const tag = r.severity === 'high' ? '🔴高' : r.severity === 'medium' ? '🟡中' : '⚪低';
      L.push(`- ${tag}【${r.type}】${r.reason}`);
      L.push(`  - 命中:${r.snippet}`);
      if (r.legalBasis) L.push(`  - 法条:${r.legalBasis}`);
      L.push(`  - 建议:${r.suggestion}`);
    }
  }
  L.push('');

  // 缺证
  L.push('## 三、缺标准保护条款(缺证)');
  if (scan.missing.length === 0) {
    L.push('标准保护齐备(验收/争议/责任上限/保密)。');
  } else {
    for (const m of scan.missing) L.push(`- 缺「${m.what}」:${m.why}`);
  }
  L.push('');
  L.push('---');
  L.push('*刑部 AI 初审 · 规则匹配 + 史馆 base rate。仅供决策参考,签署前请人工/法务终审。*');
  return L.join('\n');
}

export function clauseReportFilename(subject: string, isoDate: string): string {
  return `合规审查报告-${subject}-${isoDate.slice(0, 10)}.md`;
}
