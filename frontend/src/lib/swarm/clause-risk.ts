/**
 * clause-risk —— 刑部本命:条款风险扫描(规则匹配 + 风险评分 + 缺证检查)。
 *
 * 跨司骨架的"本命算法"刑部版(对照:户部=定量财务 / 兵部=概率博弈 / 刑部=规则匹配)。
 * 纯函数、零副作用、零网络——对【客户端已解析的合同条款文本】做初审,产脱敏风险结论
 * (符合铁律9 咨询面 + 混合架构:原文本地,只产风险结论)。
 *
 * 诚实(铁律13.2):这是【AI 初审】不是法律意见,高风险一律标人工复核;判不准的标"待人工判",不编。
 */

export type ClauseRiskType =
  | 'penalty_excessive' // 违约金过高
  | 'unlimited_liability' // 无限/连带责任
  | 'exclusive' // 独家/排他
  | 'auto_renew' // 自动续约陷阱
  | 'unilateral' // 单方解除/变更
  | 'jurisdiction' // 管辖地(需看是否不利)
  | 'prepayment' // 预付/付款前置
  | 'ip_assignment' // 知识产权归属
  | 'deposit_no_return' // 押金/定金"一律不退"(捞自明镜)
  | 'liability_shift' // 责任/费用甩给对方(捞自明镜)
  | 'final_interpretation'; // 最终解释权归对方(捞自明镜)

export type Severity = 'high' | 'medium' | 'low';

export interface ClauseRisk {
  type: ClauseRiskType;
  severity: Severity;
  /** 命中的条款片段(脱敏:仅该条款,不含全文)。 */
  snippet: string;
  reason: string;
  suggestion: string;
  /** 法条撑腰(有=法律定论级;无=经验提示,需人工判)。 */
  legalBasis?: string;
}

export interface MissingProtection {
  what: string;
  why: string;
}

export interface ClauseScanResult {
  risks: ClauseRisk[];
  /** 缺标准保护条款(缺证)。 */
  missing: MissingProtection[];
  /** 0-100,越高越危。 */
  riskScore: number;
  /** veto=一票否决(必人工)/ caution=谨慎 / pass=低风险。 */
  verdict: 'veto' | 'caution' | 'pass';
  rationale: string;
}

interface Rule {
  type: ClauseRiskType;
  severity: Severity;
  re: RegExp;
  reason: string;
  suggestion: string;
  /** 法条撑腰(吸收自「明镜」legal-verify-core 原则:有法条的才硬气)。 */
  legalBasis?: string;
}

// 风险规则。带 legalBasis 的=有法律依据(real 级);无的=经验性提示(疑似,需人工判)。
// 非对称保守(taleb·吸收自明镜):宁可多报疑似,绝不把经验提示冒充成"法律定论"。
const RULES: Rule[] = [
  { type: 'unlimited_liability', severity: 'high', re: /无限(责任|连带)|连带责任|赔偿.*全部(损失|责任)|承担一切/, reason: '无限/连带责任,赔偿无上限', suggestion: '加责任上限(如不超过合同金额)', legalBasis: '《民法典》497条:格式条款加重对方责任、排除主要权利的无效' },
  { type: 'unilateral', severity: 'high', re: /单方(解除|终止|变更|调整)|有权随时(解除|终止|变更)/, reason: '对方可单方解除/变更,你被动', suggestion: '改为双方协商或加触发条件+通知期', legalBasis: '《民法典》497条:格式条款排除对方主要权利的无效' },
  { type: 'penalty_excessive', severity: 'high', re: /违约金.*?(百分之[三四五六七八九]十|[3-9]0%|[一二三四五]倍|日.*?[千万])/, reason: '违约金畸高', suggestion: '违约金一般不超实际损失,过高可主张调减', legalBasis: '《民法典》585条:违约金过分高于损失的,可请求法院/仲裁适当减少' },
  { type: 'auto_renew', severity: 'medium', re: /自动(续约|续期|展期|延续)/, reason: '自动续约,易被动锁定', suggestion: '改为到期需双方书面确认续约' },
  { type: 'exclusive', severity: 'medium', re: /独家|排他|唯一(供应商|代理|渠道)/, reason: '排他条款,限制你另寻方', suggestion: '限定范围/期限,或换非排他' },
  { type: 'prepayment', severity: 'medium', re: /预付(全款|100%|全部)|付款.*?(先于|前置).*?(交付|发货|验收)|全款.*预付/, reason: '全额预付,资金与履约风险前置', suggestion: '改分期/里程碑付款,验收后尾款' },
  { type: 'ip_assignment', severity: 'medium', re: /知识产权.*?(归|属于|转让给).*?(甲方|对方|委托方)/, reason: '知识产权归对方,需确认是否本意', suggestion: '明确归属范围,保留必要许可' },
  { type: 'jurisdiction', severity: 'low', re: /管辖.*?(甲方|对方|卖方|供应方|委托方)(所在地|住所地|法院)/, reason: '约定在对方所在地管辖,争议时你异地应诉不利', suggestion: '争取中立地/你方所在地管辖' },
  // ↓ 捞自明镜 rental_pits,提炼为通用合同规则
  { type: 'deposit_no_return', severity: 'high', re: /(押金|定金|保证金).*(一律不退|概不退还|不予退还|不退)|(一律不退|概不退还).*(押金|定金|保证金)/, reason: '押金/保证金"一律不退",剥夺你应得返还', suggestion: '改为:无违约和损坏、关系结束时应全额退还;扣减须列明项目金额', legalBasis: '《民法典》497条:格式条款排除对方主要权利(押金担保性质应退)无效' },
  { type: 'liability_shift', severity: 'medium', re: /(一切|所有|全部)(维修|损失|费用|责任).*(由|归).*(乙方|对方|承租|你方)|(乙方|对方|承租).*(承担|负责)(一切|所有|全部)/, reason: '把一切责任/费用甩给你方,加重你责任', suggestion: '按过错/约定分担,删除"一切由乙方承担"式兜底', legalBasis: '《民法典》497条:格式条款不合理加重对方责任的无效' },
  { type: 'final_interpretation', severity: 'high', re: /最终解释权(归|属于|由)?.*(甲方|对方|本公司|商家|卖方)|(甲方|本公司|商家).*(享有|保留).*最终解释权/, reason: '"最终解释权归对方"——经典格式条款陷阱,把争议解释权单方握死', suggestion: '删除该条;争议条款应作不利于条款提供方的解释', legalBasis: '《民法典》498条:格式条款有两种以上解释的,作不利于提供格式条款一方的解释' },
];

/** 标准保护条款(缺则提示)。 */
const PROTECTIONS: Array<{ what: string; re: RegExp; why: string }> = [
  { what: '验收/质量标准', re: /验收|检验|质量标准|合格标准/, why: '无验收标准,交付争议时无依据' },
  { what: '争议解决', re: /争议|仲裁|诉讼|管辖/, why: '无争议解决条款,出事不知去哪打' },
  { what: '责任上限', re: /责任(上限|限于|不超过|以.*为限)/, why: '无责任上限,赔偿敞口不可控' },
  { what: '保密', re: /保密|机密|不得披露/, why: '无保密条款,商业信息无保护' },
];

const SEV_WEIGHT: Record<Severity, number> = { high: 30, medium: 12, low: 4 };

/** 扫描合同条款文本,出风险结论。contractText = 客户端解析后的条款文本。 */
export function scanClauses(contractText: string): ClauseScanResult {
  const text = contractText ?? '';
  const risks: ClauseRisk[] = [];
  for (const r of RULES) {
    const m = text.match(r.re);
    if (m) {
      const idx = m.index ?? 0;
      const snippet = text.slice(Math.max(0, idx - 8), idx + 40).replace(/\s+/g, ' ').trim();
      risks.push({ type: r.type, severity: r.severity, snippet, reason: r.reason, suggestion: r.suggestion, legalBasis: r.legalBasis });
    }
  }
  const missing = PROTECTIONS.filter((p) => !p.re.test(text)).map((p) => ({ what: p.what, why: p.why }));

  let score = risks.reduce((s, r) => s + SEV_WEIGHT[r.severity], 0) + missing.length * 6;
  score = Math.min(100, score);

  const highCount = risks.filter((r) => r.severity === 'high').length;
  const verdict: ClauseScanResult['verdict'] =
    highCount >= 2 || (highCount >= 1 && missing.some((m) => m.what === '责任上限')) ? 'veto' : score >= 25 ? 'caution' : 'pass';

  const rationale =
    risks.length === 0 && missing.length === 0
      ? '未命中已知高危条款,标准保护齐备。仍建议人工终审(AI初审不替代法律意见)。'
      : `命中 ${risks.length} 项风险(${highCount} 高危)、缺 ${missing.length} 项标准保护。${verdict === 'veto' ? '判:一票否决,必人工复核。' : verdict === 'caution' ? '判:谨慎,逐条人工确认。' : '判:低风险,抽查即可。'}`;

  return { risks, missing, riskScore: score, verdict, rationale };
}
