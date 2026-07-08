#!/usr/bin/env -S npx tsx
/**
 * 朝堂 · 六部真数据统一入口（ingest-all）· 2026-07-01
 *
 * 一条命令看六部真数据一览。文件发现用系统 find（有界 maxdepth，秒级），
 * 不再 JS 递归 walk（曾在整盘备份目录 本地磁盘(E) 上挂死）。逻辑在各部 lib（已单测）。
 *
 * 用法：pnpm ingest:all [根目录=/mnt/h/各部门备份] [out.json]
 */
import * as XLSX from 'xlsx';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { buildCostPortfolio } from '../src/features/hubu/lib/cost-portfolio';
import { parseDisciplinePolicy } from '../src/features/libu/lib/discipline-policy';
import { parseSalesContracts, buildSalesPortfolio } from '../src/features/lifu/lib/sales-ledger';
import { parseProjectLedger, buildDeliveryPortfolio } from '../src/features/gongbu/lib/project-delivery';
import { buildComplianceScan } from '../src/features/xingbu/lib/payment-compliance';

const ROOT = process.argv[2] || '/mnt/h/各部门备份';

/** 系统 find：有界 maxdepth、秒级、不 stat 风暴。 */
function find(dir: string, iname: string, maxdepth = 6): string[] {
  try {
    const out = execSync(`find "${dir}" -maxdepth ${maxdepth} -type f -iname "${iname}" -not -path "*RECYCLE*" 2>/dev/null | head -400`, {
      encoding: 'utf8',
      timeout: 30_000,
    });
    return out.split('\n').filter((l) => l && !l.includes('~$'));
  } catch {
    return [];
  }
}
const sheetRows = (path: string, sheet?: string): unknown[][] => {
  const wb = XLSX.readFile(path);
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet ?? wb.SheetNames[0]], { header: 1, raw: false }) as unknown[][];
};

const snap: Record<string, unknown> = {};

// 户部：成本（项目成本核算 BOM）
try {
  const boms = find('/mnt/h/郭/采购供应链/项目成本核算', '*.xls').map((f) => {
    const wb = XLSX.readFile(f);
    let best: unknown[][] = [];
    let bt = -1;
    for (const sn of wb.SheetNames) {
      const r = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true }) as unknown[][];
      const t = buildCostPortfolio([{ file: f, product: 'x', rows: r }]).entries[0]?.totalCost ?? -1;
      if (t > bt) { bt = t; best = r; }
    }
    return { file: f, product: f.split('/').pop()!, rows: best };
  });
  snap.hubu = { 部: '户部·成本', ...buildCostPortfolio(boms).summary };
} catch (e) { snap.hubu = { 部: '户部·成本', error: String(e) }; }

// 吏部：违纪处罚标准
try {
  const f = find(ROOT, '*违纪*处罚*.xlsx')[0];
  snap.libu = { 部: '吏部·人事', 违纪标准条数: f ? parseDisciplinePolicy(sheetRows(f)).length : 0 };
} catch (e) { snap.libu = { 部: '吏部·人事', error: String(e) }; }

// 礼部：销售合同 → 客户经营
try {
  const contracts: ReturnType<typeof parseSalesContracts> = [];
  for (const f of find(`${ROOT}/市场部`, '*合同*.xlsx').concat(find(`${ROOT}/市场部`, '*销售*.xlsx'))) {
    const wb = XLSX.readFile(f);
    for (const sn of wb.SheetNames) contracts.push(...parseSalesContracts(sheetRows(f, sn)));
  }
  snap.lifu = { 部: '礼部·客户经营', ...buildSalesPortfolio(contracts).summary };
} catch (e) { snap.lifu = { 部: '礼部·客户经营', error: String(e) }; }

// 工部：项目台账 → 交付完整度
try {
  const f = find(`${ROOT}/项目部`, '项目清单*.xls', 8).sort().pop();
  const projects: ReturnType<typeof parseProjectLedger> = [];
  if (f) { const wb = XLSX.readFile(f); for (const sn of wb.SheetNames) if (/20\d\d/.test(sn)) projects.push(...parseProjectLedger(sheetRows(f, sn), sn)); }
  snap.gongbu = { 部: '工部·交付', ...buildDeliveryPortfolio(projects).summary };
} catch (e) { snap.gongbu = { 部: '工部·交付', error: String(e) }; }

// 刑部：合同付款合规
try {
  const items: Array<{ customer: string; amount: number | null; terms: string }> = [];
  for (const f of find(`${ROOT}/市场部`, '*合同*.xlsx').concat(find(`${ROOT}/市场部`, '*销售*.xlsx'))) {
    const wb = XLSX.readFile(f);
    for (const sn of wb.SheetNames) {
      const r = sheetRows(f, sn);
      const hdr = (r.find((x) => x?.some((c) => /客户/.test(String(c ?? '')))) ?? []).map((c) => String(c ?? ''));
      const ci = hdr.findIndex((c) => /客户/.test(c));
      const ai = hdr.findIndex((c) => /金额/.test(c));
      const pi = hdr.findIndex((c) => /付款/.test(c));
      if (pi < 0) continue;
      let last = '';
      for (const row of r) {
        const cust = String(row?.[ci] ?? '').trim();
        if (cust) last = cust;
        const terms = String(row?.[pi] ?? '');
        if (!terms || /付款方式/.test(terms) || !/预付|货|款|%/.test(terms)) continue;
        const amt = String(row?.[ai] ?? '').replace(/[￥¥,\s]/g, '').match(/[\d.]+/);
        items.push({ customer: last, amount: amt ? Number(amt[0]) : null, terms });
      }
    }
  }
  snap.xingbu = { 部: '刑部·合规', ...buildComplianceScan(items).summary };
} catch (e) { snap.xingbu = { 部: '刑部·合规', error: String(e) }; }

console.log('══ 朝堂六部 · 你的真数据一览（H盘） ══');
for (const k of ['hubu', 'lifu', 'gongbu', 'xingbu', 'libu']) console.log(' ', JSON.stringify(snap[k]));
console.log('  兵部·报价 = 读户部真成本×毛利红线派生（不重算·铁律6）');

const out = process.argv[3];
if (out) { writeFileSync(out, JSON.stringify(snap, null, 1)); console.log(`\n快照已写：${out}`); }
