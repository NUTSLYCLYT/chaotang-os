/**
 * 户部单 agent（产品版）—— 数据源 = 真实 /api/court/hubu/overview（预算池/待批项目/ROI/现金储备）。
 * 核心范式（schema + 调大脑 + 数字接地校验 + 打回重写）已抽到 dept-agent.ts；本文件只负责
 * 户部专属的数据源适配（buildHubuContext，算分离）与角色。
 */

import type { HubuOverview, HubuProject } from '@/lib/contracts/hubu';
import { FINANCE_STATUS_LABEL, FINANCE_RISK_LABEL } from '@/lib/contracts/hubu';
import { runAgent, type AgentResult } from './dept-agent';
import { formatBlackboard, type PriorSignal } from './decision-ledger';

export type HubuAgentResult = AgentResult;

/* ── 算分离：从字符串预算/ROI 里抽数值，确定性算好喂给 LLM ──────────────────── */
/** 抽取字符串里第一个数值（"16.8 万" → 16.8，"3.2x" → 3.2，"71%" → 71）。失败返回 null。 */
function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

interface DerivedProject {
  p: HubuProject;
  budget: number | null;
  roi: number | null;
  /** ROI×预算 的"性价比权重"——确定性算好，供 LLM 引用而非心算。 */
  roiBudget: number | null;
}

function deriveProjects(projects: HubuProject[]): DerivedProject[] {
  return projects.map((p) => {
    const budget = parseNum(p.requested_budget);
    const roi = parseNum(p.estimated_roi);
    return { p, budget, roi, roiBudget: budget != null && roi != null ? +(budget * roi).toFixed(1) : null };
  });
}

/**
 * buildHubuContext —— 数据源适配点：把真实总览数据 + JS 预算好的指标，组装成 agent 的事实底座。
 * context 里出现的每个数字，都会成为 number-verifier 判定 answer "接地"的依据。
 */
export function buildHubuContext(ov: HubuOverview, priorSignals: PriorSignal[] = []): string {
  const s = ov.summary;
  const derived = deriveProjects(ov.projects);

  const pending = derived.filter((d) => d.p.status === 'pending_review');
  const totalPendingBudget = pending.reduce((sum, d) => sum + (d.budget ?? 0), 0);
  const rankByRoi = [...pending]
    .filter((d) => d.roi != null)
    .sort((a, b) => (b.roi! - a.roi!));

  const projLines = derived
    .map((d) => {
      const { p } = d;
      return `· ${p.title}(${p.id})｜状态 ${FINANCE_STATUS_LABEL[p.status]}｜申请预算 ${p.requested_budget}｜预期ROI ${p.estimated_roi}｜回收期 ${p.payback_window}｜现金流压力 ${p.cash_flow_pressure}｜优先级 ${p.priority}｜风险 ${FINANCE_RISK_LABEL[p.risk_level]}｜部门 ${p.target_dept}`;
    })
    .join('\n');

  const computed = [
    `本周已请款 ${s.total_requested}｜本周已批 ${s.approved_this_week}｜待批 ${s.pending_count} 项｜平均ROI ${s.avg_roi}｜现金储备 ${s.cash_reserve}`,
    `待批项目预算合计 ${totalPendingBudget.toFixed(1)} 万`,
    '待批项目按预期ROI降序：' +
      (rankByRoi.length
        ? rankByRoi.map((d, i) => `${i + 1}) ${d.p.title} ROI ${d.p.estimated_roi}(预算 ${d.p.requested_budget}，ROI×预算 ${d.roiBudget} 万)`).join('；')
        : '（无可比 ROI）'),
  ].join('\n');

  return [
    '【已核算指标（直接引用，勿心算）】',
    computed,
    '',
    '【待批/在投项目明细（原始数据）】',
    projLines,
    '',
    `【户部现行建议】${s.recommendation}`,
    formatBlackboard(priorSignals), // stigmergy：他部近期冲突信号
  ].join('\n');
}

const HUBU_ROLE =
  '你是户部尚书——CFO 级财政决策官。预算合计/ROI 排名等已为你算好（见"已核算指标"），' +
  '你只做分析与拍板，**绝不自己心算、绝不推算新数字**；结论里出现的每个数字都必须能在' +
  '"已核算指标"或"原始数据"里逐字找到，否则不要写。';

/** 跑一次户部单 agent。priorSignals = 共享黑板他部信号。 */
export function askHubu(
  command: string,
  ov: HubuOverview,
  priorSignals: PriorSignal[] = [],
): Promise<HubuAgentResult> {
  return runAgent({ role: HUBU_ROLE, context: buildHubuContext(ov, priorSignals), command });
}
