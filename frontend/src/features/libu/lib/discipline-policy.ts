/**
 * 吏部 · 违纪处罚查询引擎（discipline-policy）
 *
 * 接真数据：H盘 各部门备份/人事/制度、考核/员工违纪处罚标准.xlsx（27 条真公司标准）。
 * 对标户部 bom-cost：真表 → 解析 → 查询命中 → 返你公司真标准；查不到标"需人事裁量"，绝不编罚则。
 *
 * 纯函数（入参已解析 rows，IO/xlsx 由适配层）→ 可单测、不碰 fs。
 */
export interface DisciplineRule {
  no: number;
  violation: string;
  penalty: string;
}

const norm = (v: unknown): string => (v == null ? '' : String(v).replace(/\s+/g, '').trim());

/** 解析违纪处罚表：定位表头(违纪内容/惩处标准)，逐行取 [序号,违纪,处罚]。 */
export function parseDisciplinePolicy(rows: unknown[][]): DisciplineRule[] {
  let headerIdx = -1;
  let vCol = -1;
  let pCol = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] ?? [];
    let v = -1;
    let p = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]);
      if (v < 0 && /违纪|违规|事项/.test(cell)) {
        v = c;
        continue; // 同一格不得又当处罚列（防标题行"违纪…惩处"挤在一格被误判）
      }
      if (p < 0 && /惩处|处罚|惩罚|标准/.test(cell)) p = c;
    }
    if (v >= 0 && p >= 0 && v !== p) {
      headerIdx = i;
      vCol = v;
      pCol = p;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const rules: DisciplineRule[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const violation = norm(row[vCol]);
    const penalty = norm(row[pCol]);
    if (!violation || !penalty) continue;
    const noRaw = norm(row[0]);
    const no = /^\d+$/.test(noRaw) ? Number(noRaw) : rules.length + 1;
    rules.push({ no, violation, penalty });
  }
  return rules;
}

export interface DisciplineMatch {
  matched: boolean;
  rule: DisciplineRule | null;
  /** 命中置信：命中的关键片段数（0=未命中）。 */
  score: number;
  note: string;
}

/** 2 字滑窗片段（中文关键匹配，避免整串比对漏词）。 */
function grams(s: string): Set<string> {
  const g = new Set<string>();
  const t = norm(s);
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
}

/**
 * 查询违纪 → 返你公司真标准。查不到返 null 并标"需人事裁量"——吏部不替编罚则（诚实边界）。
 */
export function matchDiscipline(rules: DisciplineRule[], query: string): DisciplineMatch {
  const q = grams(query);
  if (q.size === 0 || rules.length === 0) {
    return { matched: false, rule: null, score: 0, note: '查询为空或无标准表。' };
  }
  let best: DisciplineRule | null = null;
  let bestScore = 0;
  for (const r of rules) {
    const rg = grams(r.violation);
    let overlap = 0;
    for (const g of q) if (rg.has(g)) overlap++;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = r;
    }
  }
  if (!best || bestScore === 0) {
    return { matched: false, rule: null, score: 0, note: '该违纪未在公司标准中，需人事裁量（吏部不替编罚则）。' };
  }
  return {
    matched: true,
    rule: best,
    score: bestScore,
    note: `依《员工违纪惩处标准》第 ${best.no} 条：${best.penalty}`,
  };
}
