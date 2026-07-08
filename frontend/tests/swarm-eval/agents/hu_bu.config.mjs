/** 户部(财务) · 单 agent 配置。数据源 = data/hubu-financials.json；算分离=JS 确定性算好比率。 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const pct = (c, p) => `${(((c - p) / p) * 100).toFixed(1)}%`;
const rate = (n, d, p = 1) => `${((n / d) * 100).toFixed(p)}%`;

export default {
  deptName: '户部', deptCode: 'hu_bu',
  // ③ accuracy 收紧：只准引用已核算指标，禁止自行推算新数字
  role: `你是户部尚书——CFO 级财务分析师。所有比率/同比/覆盖率【已为你算好】（见"已核算指标"），你只做分析与决策，**绝不自己心算、绝不推算新数字**；结论里出现的每个数字都必须能在"已核算指标"或"原始数据"里逐字找到，否则不要写。`,
  questions: [
    { id: 'hubu-q1-health', q: '核算 Q1 财务三大指标(收入/成本/利润)并指出主要现金流风险。' },
    { id: 'hubu-margin', q: '净利率同比下滑的根因是什么？给出可量化的改善路径。' },
    { id: 'hubu-cashrisk', q: '评估 6 月 800 万短贷到期的偿付风险与应对预案。' },
    { id: 'hubu-channel', q: '哪个收入渠道最该优化？是否应砍？给数据支撑的结论。' },
    { id: 'hubu-budget', q: '结合【实时预算池】(已请款/已批/现金储备)与待批项目，3 个待批项目先批哪个？给数据依据。' },
  ],
  async buildContext() {
    const d = JSON.parse(await readFile(join(HERE, '..', 'data', 'hubu-financials.json'), 'utf8'));
    const r = d.pnl.revenue, c = d.pnl.totalCost, gp = d.pnl.grossProfit, np = d.pnl.netProfit, cf = d.cashFlow, loan = d.debt.shortTermLoan;
    const M = [
      `收入 ${r.curr}(YoY ${pct(r.curr, r.prior)}) · 总成本 ${c.curr}(YoY ${pct(c.curr, c.prior)})`,
      `毛利率 ${rate(gp.curr, r.curr)}(上年 ${rate(gp.prior, r.prior)}) · 净利率 ${rate(np.curr, r.curr)}(上年 ${rate(np.prior, r.prior)}，变动 ${(np.curr / r.curr * 100 - np.prior / r.prior * 100).toFixed(1)}pct)`,
      '各成本项 YoY：' + Object.values(d.costs).map((x) => `${x.label} ${pct(x.curr, x.prior)}(占收入 ${rate(x.curr, r.curr)})`).join(' / '),
      '各渠道：' + Object.values(d.revenueByChannel).map((x) => `${x.label} 收入 ${x.curr}(YoY ${pct(x.curr, x.prior)})·毛利率 ${rate(x.curr - x.cogs, x.curr)}·毛利额 ${x.curr - x.cogs}`).join(' / '),
      `经营现金流净额 ${cf.operatingCashFlowNet.curr}(YoY ${pct(cf.operatingCashFlowNet.curr, cf.operatingCashFlowNet.prior)}) · DSO ${cf.accountsReceivable.dsoDays}天(上年 ${cf.accountsReceivable.priorDsoDays}天) · 应收 ${cf.accountsReceivable.curr}(YoY ${pct(cf.accountsReceivable.curr, cf.accountsReceivable.prior)})`,
      `货币资金 ${cf.cashAndEquivalents.curr} · 6月到期短贷 ${loan.amount}(年息 ${loan.rateAnnualPct}%) · 现金/短贷覆盖 ${(cf.cashAndEquivalents.curr / loan.amount).toFixed(2)}x · 现金/(短贷+应付) ${(cf.cashAndEquivalents.curr / (loan.amount + cf.accountsPayable.curr)).toFixed(2)}x`,
    ].join('\n');
    const live = await liveSnapshot();  // 数据源适配：从真实后端 API 拉实时预算池
    return `【已核算指标（单位万元，直接引用，勿心算）】\n${M}\n\n【原始数据】${JSON.stringify({ revenueByChannel: d.revenueByChannel, costs: d.costs, pnl: d.pnl, cashFlow: d.cashFlow, debt: d.debt })}${live}`;
  },
};

/** 数据源适配（生产链路）：实时拉取后端 /api/court/hubu/overview（预算/项目/ROI/现金储备）。
 *  这就是"接真实 API"的接入点——把读文件换成读后端，agent 即用上实时数据。失败则静默降级。 */
async function liveSnapshot() {
  const BASE = process.env.SWARM_BASE || 'http://localhost:3002';
  try {
    const tk = (await (await fetch(`${BASE}/api/auth/local-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }), signal: AbortSignal.timeout(8000) })).json()).accessToken;
    const r = await fetch(`${BASE}/api/court/hubu/overview`, { headers: { Authorization: `Bearer ${tk}`, Cookie: `courtos.access_token=${tk}` }, signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const s = j?.data?.summary, projects = (j?.data?.projects || []).slice(0, 4).map((p) => `${p.title}(${p.id})`);
    if (!s) return '';
    return `\n\n【实时数据源 · /api/court/hubu/overview（真实后端 API，实时拉取）】\n本周已请款 ${s.total_requested} · 已批 ${s.approved_this_week} · 待批 ${s.pending_count} 项 · 平均ROI ${s.avg_roi} · 现金储备 ${s.cash_reserve}\n待批项目：${projects.join(' / ')}`;
  } catch { return ''; }
}
