/**
 * 兵部 · 商机司 · 客户名单批量验客（2026-06-28）
 *
 * 第二条真数据闭环：解析真实客户名单(Excel) → 逐个验客(目标/待定/非目标) → 批量结论 + 合规。
 * 复用已建的 qualifyProspect（合法 by design：不抓取、人扳机、缺则标缺）。
 * 解析按**表头关键词**定位列（鲁棒：跨不同客户表排版通用）；纯函数本地，数据不外传。
 */
import { qualifyProspect, QUALIFY_VERDICT_CN, type IcpProfile, type Prospect, type QualifyResult } from './prospect-qualify';

const HEADER_KEYS = {
  name: ['单位', '公司名称', '客户名称', '客户', '公司'],
  region: ['地区', '省市', '区域', '所在地'],
  source: ['信息来源', '来源', '渠道'],
  category: ['客户分类', '分类', '等级'],
  contact: ['姓名', '联系人', '对接人'],
  role: ['职位', '岗位'],
  demand: ['项目需求', '需求', '产品需求'],
};

function matchCol(cell: unknown, keys: string[]): boolean {
  const s = String(cell ?? '').replace(/\s|\n/g, '');
  return keys.some((k) => s.includes(k));
}

/** 信息来源/分类文本 → 采购信号关键词（"列装竞标"→["列装","竞标"]）。 */
function extractSignals(...texts: string[]): string[] {
  const joined = texts.join(' ');
  const SIGNALS = ['竞标', '采购', '列装', '招标', '样品', '项目', '需求', '量产', '送样', '中标', '扩产'];
  return SIGNALS.filter((s) => joined.includes(s));
}

/** 解析客户名单 rows(header:1) → Prospect[]。source 标 user_provided（用户上传=真实证据）。 */
export function parseCustomerRows(rows: unknown[][]): { prospects: Prospect[]; missing: string[] } {
  const missing: string[] = [];
  let headerIdx = -1;
  let col = { name: -1, region: -1, source: -1, category: -1, contact: -1, role: -1, demand: -1 };
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] ?? [];
    const nameC = r.findIndex((c) => matchCol(c, HEADER_KEYS.name));
    if (nameC >= 0) {
      headerIdx = i;
      col = {
        name: nameC,
        region: r.findIndex((c) => matchCol(c, HEADER_KEYS.region)),
        source: r.findIndex((c) => matchCol(c, HEADER_KEYS.source)),
        category: r.findIndex((c) => matchCol(c, HEADER_KEYS.category)),
        contact: r.findIndex((c) => matchCol(c, HEADER_KEYS.contact)),
        role: r.findIndex((c) => matchCol(c, HEADER_KEYS.role)),
        demand: r.findIndex((c) => matchCol(c, HEADER_KEYS.demand)),
      };
      break;
    }
  }
  if (headerIdx < 0) return { prospects: [], missing: ['未识别到客户表头(单位/公司名称列)'] };

  const prospects: Prospect[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = String(r[col.name] ?? '').trim();
    // 跳过空行/合计行/把表头词当值的脏行(单位/公司名称等)。
    if (!name || name.length < 2 || /合计|备注|小计|^序号$/.test(name) || HEADER_KEYS.name.includes(name)) continue;
    const source = col.source >= 0 ? String(r[col.source] ?? '') : '';
    const category = col.category >= 0 ? String(r[col.category] ?? '') : '';
    const demand = col.demand >= 0 ? String(r[col.demand] ?? '') : '';
    const region = col.region >= 0 ? String(r[col.region] ?? '').trim() : '';
    const signals = extractSignals(source, category, demand);
    prospects.push({
      id: `cust-${i}`,
      name,
      observedSignals: signals,
      source: 'user_provided', // 用户上传 = 真实证据(T1)
      notes: [region && `地区:${region}`, source && `来源:${source}`, demand && `需求:${demand}`].filter(Boolean).join(' '),
    });
  }
  if (prospects.length === 0) missing.push('表里没有可识别的客户行');
  return { prospects, missing };
}

export interface BatchQualifyResult {
  total: number;
  summary: { target: number; maybe: number; not_target: number };
  results: { prospect: Prospect; result: QualifyResult }[];
  /** 一句话结论。 */
  headline: string;
}

/** 批量验客：逐个 qualify + 汇总（纯函数）。 */
export function batchQualify(prospects: Prospect[], icp: IcpProfile): BatchQualifyResult {
  const results = prospects.map((p) => ({ prospect: p, result: qualifyProspect(p, icp) }));
  const summary = { target: 0, maybe: 0, not_target: 0 };
  for (const { result } of results) summary[result.verdict]++;
  const headline = `${prospects.length} 个客户验完：${summary.target} 个目标客户${QUALIFY_VERDICT_CN ? '' : ''}、${summary.maybe} 个待定、${summary.not_target} 个非目标——先打目标客户那 ${summary.target} 个`;
  return { total: prospects.length, summary, results, headline };
}
