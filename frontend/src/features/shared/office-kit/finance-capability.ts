/**
 * 建部套件 · 能力菜单(设计① · 2026-07-01)
 *
 * 一个领域一个 owner(铁律6):算钱只归户部。此前招人/培训/编制各自硬算年成本/ROI = 户部的钱逻辑
 * 被三处复制。收口成户部单一能力,各部只"点用"不重算;协办徽从此菜单自动出(不再手写"户部")。
 * 纯函数,数据不出浏览器(铁律9 咨询侧);真发钱=后端产线,本能力只算不发。
 */

/** 户部社保公积金系数(月薪外加)。单一真相源。 */
export const SOCIAL_INSURANCE_COEFF = 1.4;

/** 户部能力:年人力成本 = 月薪×12×社保系数。缺月薪→null(不替算)。 */
export function annualLaborCost(monthlySalary: number | null): number | null {
  return monthlySalary != null && monthlySalary > 0 ? Math.round(monthlySalary * 12 * SOCIAL_INSURANCE_COEFF) : null;
}

/** 户部能力:ROI = 价值 / 成本(保留2位)。任一缺或成本≤0→null。 */
export function computeRoi(value: number | null, cost: number | null): number | null {
  return cost != null && cost > 0 && value != null ? Math.round((value / cost) * 100) / 100 : null;
}

/** 能力菜单条目:谁提供、什么色(协办徽用)、能算什么。 */
export interface CapabilityEntry {
  owner: string;
  accent: string;
  provides: string[];
}

/** 户部·财务能力(被吏部/兵部/工部等点用;协办徽从这里取 owner/accent)。 */
export const HUBU_FINANCE_CAPABILITY: CapabilityEntry = {
  owner: '户部',
  accent: '#3DD68C',
  provides: ['算年成本', '算ROI', '算成本占比'],
};

/**
 * 能力菜单(SSOT):各部登记"能被别人点的能力"。先只登记户部这一个真被反复需要的,
 * 跑通再扩(bezos:服务化从一两个真接口起,不先建大总线)。刑部合规/钦天监风险等后续登记。
 */
export const CAPABILITY_MENU: Record<string, CapabilityEntry> = {
  hubu_finance: HUBU_FINANCE_CAPABILITY,
};
