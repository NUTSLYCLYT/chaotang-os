/**
 * 决策回测引擎（纯函数 · 2026-06-29）
 *
 * 把史馆里老板的真历史决策(emperor_decisions + 原问题)重放过**当前引擎**，量化
 * "AI 当时会不会多抓出风险"。零新造判断逻辑——复用已接主决策环的 CRO 销售引擎
 * (runBingbuCROSalesOfficeReview) + 死法地图(ruinForSalesItem) + 结构化抽取(sales-extract)。
 *
 * 核心产出 = "你过去 N 个决定里，有 M 个老板拍了板、但引擎会提示风险"——能签单的 demo。
 *
 * 诚实：只回放有真问题文本的决策；"漏掉的风险"=老板采纳(adopt/signed/edited)但引擎判
 * 死法地图否决/升维复核/须人工确认。不编、不夸——引擎判什么就报什么。
 */
import { runBingbuCROSalesOfficeReview } from '@/core/courtos/bingbu/bingbu-cro-sales-office';
import { extractSalesFacts, gradeSalesRisk, inferStage } from '@/features/bingbu/lib/sales-extract';
import { ruinForSalesItem } from '@/features/qintian/lib/ruin-map';
import type { BingbuSalesItem } from '@/lib/contracts/bingbu-sales';

/** 一条历史决策（来自 emperor_decisions JOIN decision_tasks）。 */
export interface PastDecision {
  id: string;
  command: string;
  action: string;
  createdAt?: string;
}

export interface BacktestFinding {
  id: string;
  command: string;
  action: string;
  /** 引擎当时会给的裁决（推进/补证/复核…）。 */
  engineVerdict: string;
  /** 老板拍板时漏掉的风险（引擎会提示但被采纳）。 */
  missedRisks: string[];
}

export interface BacktestReport {
  total: number;
  /** 真正回放了的（有≥5字问题文本）。 */
  replayed: number;
  /** 老板采纳但引擎会提示风险的条数。 */
  missedCount: number;
  missed: BacktestFinding[];
}

/** 老板"采纳/放行"类动作（这些下引擎若提示风险=漏了）。 */
const ADOPTED = new Set(['adopt', 'signed', 'edited', 'approve', 'adopted']);

/** 从命令文本构最小销售事项（复用 sales-extract，喂死法地图/CRO）。 */
function itemFromCommand(id: string, command: string): BingbuSalesItem {
  const facts = extractSalesFacts(command);
  return {
    id,
    title: command.slice(0, 48),
    command,
    status: 'pending_review',
    priority: 'P1',
    counterparty: facts.counterparty ?? '—',
    stage: inferStage(command),
    amount: facts.amount ?? '—',
    risk_level: gradeSalesRisk(command, facts),
    recommendation: '',
    terms: facts.terms,
    industry: facts.industry ?? '—',
    delivery: facts.deliveryDays != null ? `${facts.deliveryDays} 天` : '—',
    prepayment: facts.prepayment ?? '—',
    asked_count: 1,
    created_at: '',
    updated_at: '',
  };
}

/** 回放一条决策，返回引擎当时会提示的风险（空数组=引擎也认为没问题）。 */
export function replayDecision(command: string, id = 't'): { engineVerdict: string; risks: string[] } {
  const text = command.trim();
  const item = itemFromCommand(id, text);
  const cro = runBingbuCROSalesOfficeReview({ text, sourceLabel: 'LIVE' });
  const ruin = ruinForSalesItem(item);

  const risks: string[] = [];
  if (ruin.verdict === 'veto') {
    risks.push(`死法地图否决（${ruin.redlinesHit.join('、')}）`);
  }
  if (cro.humanConfirmationRequired) {
    risks.push('高风险动作·须人工确认，不得自动外发');
  }
  if (cro.position === '复核' && !cro.humanConfirmationRequired) {
    risks.push('引擎裁为升维复核');
  }
  if (cro.crossDepartmentReviews.includes('justice')) {
    risks.push('涉合同/承诺·需刑部复核');
  }
  return { engineVerdict: cro.position, risks };
}

/** 回测一批历史决策：老板采纳但引擎会提示风险的，列为"漏掉的风险"。 */
export function backtestDecisions(decisions: PastDecision[]): BacktestReport {
  const missed: BacktestFinding[] = [];
  let replayed = 0;
  for (const d of decisions) {
    const text = d.command?.trim();
    if (!text || text.length < 5) continue;
    replayed += 1;
    const { engineVerdict, risks } = replayDecision(text, d.id);
    if (ADOPTED.has(d.action) && risks.length > 0) {
      missed.push({
        id: d.id,
        command: text.length > 60 ? `${text.slice(0, 60)}…` : text,
        action: d.action,
        engineVerdict,
        missedRisks: risks,
      });
    }
  }
  return { total: decisions.length, replayed, missedCount: missed.length, missed };
}
