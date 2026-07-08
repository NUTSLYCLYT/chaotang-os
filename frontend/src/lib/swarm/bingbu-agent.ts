/**
 * 兵部单 agent（产品版）—— 数据源 = 真实 /api/court/bingbu/overview（待决销售事项）。
 * 镜像户部 hubu-agent.ts：核心范式（schema + 调大脑 + 数字接地校验 + 打回重写）复用
 * dept-agent.ts；本文件只负责兵部专属的数据源适配（buildBingbuContext）与角色。
 */

import type { BingbuSalesOverview, BingbuSalesItem } from '@/lib/contracts/bingbu-sales';
import { SALES_STATUS_LABEL, SALES_RISK_LABEL } from '@/lib/contracts/bingbu-sales';
import { runAgent, type AgentResult } from './dept-agent';
import { formatBlackboard, type PriorSignal } from './decision-ledger';

export type BingbuAgentResult = AgentResult;

function itemLine(i: BingbuSalesItem): string {
  return `· ${i.title}(${i.id})｜状态 ${SALES_STATUS_LABEL[i.status]}｜客户 ${i.counterparty}｜阶段 ${i.stage}｜金额 ${i.amount}｜优先级 ${i.priority}｜风险 ${SALES_RISK_LABEL[i.risk_level]}`;
}

/**
 * buildBingbuContext —— 数据源适配点：把真实销售总览组装成 agent 的事实底座。
 * context 里出现的每个数字，都会成为 number-verifier 判定 answer "接地"的依据。
 */
export function buildBingbuContext(ov: BingbuSalesOverview, priorSignals: PriorSignal[] = []): string {
  const s = ov.summary;
  const itemLines = ov.items.map(itemLine).join('\n') || '（当前无待决销售事项）';

  const computed = [
    `销售事项合计 ${s.total_items} 项｜待决 ${s.pending_count} 项｜高危 ${s.high_risk_count} 项`,
  ].join('\n');

  return [
    '【已核算指标（直接引用，勿心算）】',
    computed,
    '',
    '【待决销售事项明细（原始数据）】',
    itemLines,
    '',
    `【兵部现行建议】${s.recommendation}`,
    formatBlackboard(priorSignals), // stigmergy：他部近期冲突信号
  ].join('\n');
}

const BINGBU_ROLE =
  '你是兵部尚书——CRO 级销售决策官。销售事项已为你核账（见"已核算指标/原始数据"），' +
  '你只做分析与拍板，**绝不自己心算、绝不推算新数字**；结论里的每个数字都必须能在' +
  '"已核算指标"或"原始数据"里逐字找到，否则不要写。涉及报价/折扣/承诺/合同/对外消息' +
  '一律标「需跨部门复核 + 人工确认」，绝不替陛下自动外发或承诺。';

/** 跑一次兵部单 agent。priorSignals = 共享黑板他部信号。 */
export function askBingbu(
  command: string,
  ov: BingbuSalesOverview,
  priorSignals: PriorSignal[] = [],
): Promise<BingbuAgentResult> {
  return runAgent({ role: BINGBU_ROLE, context: buildBingbuContext(ov, priorSignals), command });
}
