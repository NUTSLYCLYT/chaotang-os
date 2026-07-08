/**
 * HumanApprovalGate（AGENTS.md §13.2 规则5）—— 高风险不能一键静默采纳。
 *
 * 产品决策层的人工确认门，与 src/features/governance/lib/gate.ts 互补：
 *   - governance/gate.ts = agent 执行层（证据等级 L0-L4 + blast-radius signoff）。
 *   - 本文件 = 产品裁决层（采纳奏折时按关键词/风险/来源/缺证拦截）。
 *
 * 纯函数、无 @/ 运行时依赖 → 可离线单测。
 */
import type { CourtReportShape } from '../types';
import type { BlastRadius } from '@/features/governance/lib/gate';

/**
 * 高风险关键词（PRD §8.7）。命中即需人工确认。
 * 停扩(2026-06-20 会审 · 铁律5):在产品有真实高危决策前别再投机性扩词——
 * 风险徽只是上书房裁决属性,默认中性已诚实,够用。扩词须过产品确认 + 误报反例断言。
 */
export const HIGH_RISK_KEYWORDS: readonly string[] = [
  '股权', '合同', '法律责任', '重大付款', '不可逆', '对外报价', '客户承诺',
  '供应商锁定', '独家', '违约金', '保证收益', '最低采购量', '排他', '预付款',
  '签字', '法务',
  // 证券/仓位调整(2026-06-20 补):真金白银、不可逆的交易裁决须人工确认。
  // 仅收"投资专用、无歧义"词;会审删去 建仓/持仓/清仓 —— 它们子串命中
  // 新建仓库/支持仓储/清仓大促 等本仓制造-供应链常见低危语境,会造告警疲劳。
  '仓位', '减仓', '加仓', '股票', '证券',
];

export interface HighRiskResult {
  isHighRisk: boolean;
  matched: string[];
}

export function detectHighRisk(input: string | Array<string | undefined | null>): HighRiskResult {
  const text = (Array.isArray(input) ? input.filter(Boolean).join('\n') : input) ?? '';
  const matched = HIGH_RISK_KEYWORDS.filter((kw) => text.includes(kw));
  return { isHighRisk: matched.length > 0, matched };
}

/**
 * 把文本（皇上原问/拟旨）映射成 governance gate 的 blastRadius —— 风险分级单一真相源。
 * 命中 §8.7 高风险关键词即 fail-secure 取最严 'irreversible'（默认挡下、要签字），否则 'internal'。
 * 供裁决责任徽/呈现层判红，禁各处自造 seal/priority 启发式（铁律2，2026-06-20 会审 H1）。
 *
 * 注意：本函数刻意只产 internal/irreversible 二态（fail-secure 折叠 'external' 进 irreversible）。
 * 只喂"决策本身"（原问/拟旨/裁决），勿喂风险分析散文——后者会描述性提到关键词（如"无证券风险"）造成误报。
 */
export function blastRadiusFromText(input: string | Array<string | undefined | null>): BlastRadius {
  return detectHighRisk(input).isHighRisk ? 'irreversible' : 'internal';
}

export interface ApprovalContext {
  /** 用户是否正尝试"采纳"（accept）。补证/驳回等不触发严格门。 */
  attemptingAccept?: boolean;
  /** 关键视角是否存在明显冲突。 */
  hasConflict?: boolean;
  /** 额外待扫描文本（原问题/拟旨等）。 */
  extraText?: string;
}

/** 是否需要人工确认。 */
export function requiresHumanApproval(
  report: CourtReportShape,
  ctx: ApprovalContext = {},
): boolean {
  if (report.needsHumanConfirmation) return true;
  const scan = detectHighRisk([
    report.verdict,
    report.summary,
    report.nextAction,
    ctx.extraText,
    ...(report.risks ?? []).map((r) => (typeof r === 'string' ? r : JSON.stringify(r))),
  ]);
  if (scan.isHighRisk) return true;
  if (ctx.hasConflict) return true;
  // 采纳动作下的额外严格门：不实来源 / 缺证 不得静默采纳
  if (ctx.attemptingAccept) {
    if (report.sourceLabel === 'FALLBACK' || report.sourceLabel === 'DEMO') return true;
    if ((report.missingEvidence?.length ?? 0) > 0) return true;
  }
  return false;
}

export function buildHumanApprovalChecklist(report: CourtReportShape): string[] {
  const items: string[] = [];
  const scan = detectHighRisk([report.verdict, report.summary, report.nextAction]);
  if (scan.matched.length) items.push(`确认已审阅高风险点：${scan.matched.join('、')}`);
  if ((report.missingEvidence?.length ?? 0) > 0) {
    items.push(`确认在缺少证据（${report.missingEvidence!.join('、')}）的情况下仍继续`);
  }
  if (report.sourceLabel === 'FALLBACK' || report.sourceLabel === 'DEMO') {
    items.push(`确认此结果来源为 ${report.sourceLabel}（非真实链路），你仍据此裁决`);
  }
  items.push('确认你已理解此动作可能产生的后果');
  items.push('请填写人工确认说明');
  return items;
}

export class HumanApprovalRequiredError extends Error {
  readonly checklist: string[];
  constructor(checklist: string[]) {
    super('[HumanApprovalGate] 高风险事项需人工确认，禁止静默采纳');
    this.name = 'HumanApprovalRequiredError';
    this.checklist = checklist;
  }
}

export interface UserDecisionLike {
  humanConfirmed?: boolean;
  humanConfirmationNote?: string;
}

/** 采纳前的硬门：需要人工确认但未确认 → 抛错。 */
export function assertCanAcceptDecision(
  report: CourtReportShape,
  decision: UserDecisionLike,
  ctx: ApprovalContext = {},
): void {
  if (requiresHumanApproval(report, { ...ctx, attemptingAccept: true })) {
    if (!decision.humanConfirmed) {
      throw new HumanApprovalRequiredError(buildHumanApprovalChecklist(report));
    }
  }
}
