/**
 * 工部 · 项目交付完整度引擎（project-delivery）
 *
 * 接真数据：H盘 各部门备份/项目部/项目清单（2018~2025）.xls（按年分表的真项目台账）。
 * 对标户部 bom-cost：真表 → 解析 → 核查每个项目交付件("有"/缺) → 缺件清单。
 * 诚实：缺件即缺件（不标"有"）；工部只核对台账登记，不替补文件。
 *
 * 纯函数（入参已解析 rows，IO/xlsx 由适配层）→ 可单测、不碰 fs。
 */

/** 核心交付件（工部交付质量看这 6 项是否齐）。 */
export const CORE_DELIVERABLES = ['工艺', 'BOM', '图纸', '技术方案', '成品规格书', '测试报告'] as const;
export type Deliverable = (typeof CORE_DELIVERABLES)[number];

export interface ProjectRecord {
  no: string;
  customer: string;
  model: string;
  year: string;
  present: Deliverable[];
  missing: Deliverable[];
  completeness: number; // 0..1
}

const str = (v: unknown): string => (v == null ? '' : String(v).replace(/\s+/g, '').trim());
const has = (v: unknown): boolean => /有|完成|已/.test(str(v));

/** 解析一个年份表：定位表头 + 各交付件列，逐行核对。 */
export function parseProjectLedger(rows: unknown[][], year = ''): ProjectRecord[] {
  let h = -1;
  let noCol = -1;
  let custCol = -1;
  let modelCol = -1;
  const delCol: Partial<Record<Deliverable, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const row = (rows[i] ?? []).map(str);
    const nc = row.findIndex((c) => /项目编号|编号/.test(c));
    const cc = row.findIndex((c) => /客户/.test(c));
    if (nc >= 0 && cc >= 0) {
      h = i;
      noCol = nc;
      custCol = cc;
      modelCol = row.findIndex((c) => /型号|电池型号/.test(c));
      for (const d of CORE_DELIVERABLES) {
        const idx = row.findIndex((c) => c === d || c.includes(d));
        if (idx >= 0) delCol[d] = idx;
      }
      break;
    }
  }
  if (h < 0) return [];

  const out: ProjectRecord[] = [];
  for (let i = h + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const no = str(row[noCol]);
    const customer = str(row[custCol]);
    if (!no && !customer) continue; // 空行
    const present: Deliverable[] = [];
    const missing: Deliverable[] = [];
    for (const d of CORE_DELIVERABLES) {
      const col = delCol[d];
      if (col == null) continue; // 该表无此列，不评
      if (has(row[col])) present.push(d);
      else missing.push(d);
    }
    const tracked = present.length + missing.length;
    out.push({
      no,
      customer,
      model: modelCol >= 0 ? str(row[modelCol]) : '',
      year,
      present,
      missing,
      completeness: tracked ? present.length / tracked : 0,
    });
  }
  return out;
}

export interface DeliveryPortfolio {
  projects: ProjectRecord[];
  /** 交付件齐全（无缺件）。 */
  complete: ProjectRecord[];
  /** 有缺件（工部需追）。 */
  incomplete: ProjectRecord[];
  summary: { total: number; complete: number; incomplete: number; avgCompleteness: number };
}

/** 多年份项目 → 交付完整度组合（缺件优先，工部追缺）。 */
export function buildDeliveryPortfolio(projects: ProjectRecord[]): DeliveryPortfolio {
  const complete = projects.filter((p) => p.missing.length === 0);
  const incomplete = projects
    .filter((p) => p.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length);
  const avg = projects.length ? projects.reduce((s, p) => s + p.completeness, 0) / projects.length : 0;
  return {
    projects,
    complete,
    incomplete,
    summary: {
      total: projects.length,
      complete: complete.length,
      incomplete: incomplete.length,
      avgCompleteness: Math.round(avg * 1000) / 10, // %
    },
  };
}
